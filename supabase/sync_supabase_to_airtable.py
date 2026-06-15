#!/usr/bin/env python3
# =====================================================================
# WARNING: FIRST CUT — review before live use; writes to production
# Airtable. This script can PATCH and POST records in the production
# Airtable base (app4ZpoxaWOyV4RnR) when --load is passed. The DEFAULT
# is --dry-run, which performs NO writes. Do NOT run --load until a
# human has reviewed the inverse field mapping and FK resolution below.
# =====================================================================
"""Supabase -> Airtable REVERSE sync for the ProEv project (FIRST CUT).

During the big-bang cutover, Supabase becomes the primary store and
Airtable is demoted to a *warm rollback target*. This script pushes
Postgres rows back into Airtable so a rollback to Airtable would land on
fresh data. It is the mirror image of ``migrate_airtable_data.py`` and
imports that module read-only for every source of truth:

  * AIRTABLE_TABLES   -> Airtable table ids per logical table
  * FIELD_MAP         -> Airtable field name -> Postgres column (INVERTED here)
  * TABLE_COLUMNS     -> per-table {column: ColSpec} (kind / enum / fk / self_fk)
  * LOAD_ORDER        -> FK-safe parent->child processing order
  * RateLimiter       -> ~5 req/s spacing limiter
  * env handling      -> AIRTABLE_PAT, AIRTABLE_BASE_ID, SUPABASE_DB_URL

Direction of data flow (OPPOSITE of the migrator):

    Postgres row  --(invert FIELD_MAP)-->  Airtable fields
    pg FK UUID    --({uuid: airtable_id})->  Airtable recId link

UPSERT SEMANTICS (Airtable has NO native upsert by external id):
  * Supabase row HAS ``airtable_id``  -> PATCH that Airtable record.
  * Supabase row has NO ``airtable_id`` (created while Supabase was
    primary) -> POST create in Airtable, then (only under --load) write
    the returned recId back into Supabase ``airtable_id`` so the row is
    PATCHed (not duplicated) on the next sync.

Tables are processed parent->child (LOAD_ORDER) so a child row's FK can
resolve to a parent recId that was just created in the same run.

=====================  DOCUMENTED ASSUMPTIONS  =======================
1. FIELD_MAP is many-to-one in a few cases (e.g. both "Descripcion" and
   "Descripcion Detallada" -> descripcion; "Tipo de Accion" and
   "Tipo Accion" -> tipo_accion). Inverting blindly would be ambiguous,
   so COLUMN_TO_AIRTABLE_FIELD below is a CURATED inverse that names the
   single canonical Airtable field to WRITE for each column. Columns
   with no safe writable target (computed/lookup/rollup in Airtable) are
   intentionally omitted and reported as skipped.
2. FK columns hold a Postgres UUID. We resolve UUID -> Airtable recId via
   a {uuid: airtable_id} map built per parent table from
   ``SELECT id, airtable_id FROM <parent>``. A FK whose parent row has no
   airtable_id yet CANNOT be linked; that field is dropped from the
   payload and logged (the row still PATCHes/POSTs its other fields).
3. self_fk columns (alumnos.pareja_alumno_id) are resolved exactly like
   normal FKs here (the parent map is built up-front from the whole
   parent table), so no separate backfill pass is needed.
4. Airtable computed/lookup fields are NOT writable. The curated map only
   targets editable fields; sending a computed field would 422. This is a
   FIRST CUT and the writable-field list needs human verification against
   the live base before --load.
5. text[] columns are written back as Airtable arrays; enum/text columns
   pass through as-is (values already validated on the way in).
6. Airtable batch limit is 10 records/request for POST and PATCH; we
   chunk accordingly and rate-limit each request via RateLimiter.

NON-DESTRUCTIVE BY DEFAULT: --dry-run is the default and performs NO
network writes. Only --load issues PATCH/POST and writes recIds back.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass, field as dc_field
from typing import Any, Callable

# Import the migrator read-only as the single source of truth. The import
# is guarded so the self-test runs even if the sibling module's optional
# deps (requests/psycopg2) are missing — those are lazily imported there.
import migrate_airtable_data as mig

# requests / psycopg2 are imported lazily + guarded so the dry-run and
# self-test paths work without them installed.
try:  # pragma: no cover - import guard
    import requests  # type: ignore
except ImportError:  # pragma: no cover
    requests = None  # type: ignore

try:  # pragma: no cover - import guard
    import psycopg2  # type: ignore
    from psycopg2 import sql as psql  # type: ignore
except ImportError:  # pragma: no cover
    psycopg2 = None  # type: ignore
    psql = None  # type: ignore


# Re-export the migrator's constants/structures so this module reads
# self-contained while staying a thin, read-only consumer of the source.
AIRTABLE_BASE_ID_DEFAULT = mig.AIRTABLE_BASE_ID_DEFAULT
AIRTABLE_API_ROOT = mig.AIRTABLE_API_ROOT
MAX_REQUESTS_PER_SECOND = mig.MAX_REQUESTS_PER_SECOND
AIRTABLE_TABLES = mig.AIRTABLE_TABLES
TABLE_COLUMNS = mig.TABLE_COLUMNS
FIELD_MAP = mig.FIELD_MAP
LOAD_ORDER = mig.LOAD_ORDER
RateLimiter = mig.RateLimiter
ColSpec = mig.ColSpec
_first = mig._first

DEFAULT_REPORT_PATH = "reverse_sync_report.md"
# Airtable allows up to 10 records per create/update request.
AIRTABLE_BATCH_SIZE = 10


# ------------------------------------------------------------------
# CURATED inverse of FIELD_MAP (Postgres column -> Airtable field name).
#
# FIELD_MAP is many-to-one; a blind inversion is ambiguous. This explicit
# map names the single canonical, WRITABLE Airtable field for each column
# we push back. Columns absent here are intentionally NOT written (either
# computed/lookup in Airtable, or identity columns like id/airtable_id).
# Built per table so the same column name in two tables (e.g. "estado",
# "origen", "mensaje", "descripcion", "resumen_inteligente") can target a
# different Airtable field if needed.
#
# FIRST CUT: derived by inverting FIELD_MAP and choosing the canonical
# Airtable name per column. The set of WRITABLE fields must be verified
# against the live base before --load (lookups/rollups would 422).
#
# !!!  READ-ONLY FIELDS STRIPPED  !!!  Known Airtable lookup / rollup / AI
# (computed) fields have been REMOVED below because PATCH/POSTing them returns
# HTTP 422 ("Field ... cannot accept a value / is computed"). Removed so far:
#   * revisiones_video: "Email del Alumno" (lookup), "Perfiles Redes Sociales"
#     (lookup), "Resumen Inteligente de Feedback" (AI), "Clasificacion
#     Automatica de Video" (AI)
#   * cola_emails: "Alumno Nombre" (lookup of Alumno.Nombre)
#   * alumnos: "Engagement Score" (rollup), "Resumen Feedback Video (AI)" (AI),
#     "Siguiente Accion Recomendada (AI)" (AI)
# THIS IS NOT EXHAUSTIVE. A FULL writable-field audit via the Airtable Metadata
# API (field types per table) is STILL REQUIRED before any --load — any
# remaining lookup/rollup/formula/AI field left here will 422 the whole batch.
# ------------------------------------------------------------------
COLUMN_TO_AIRTABLE_FIELD: dict[str, dict[str, str]] = {
    "ediciones": {
        "nombre": "Nombre",
        "estado": "Estado",
        "es_edicion_activa": "Es Edicion Activa",
        "fecha_inicio_inscripcion": "Fecha Inicio Inscripcion",
        "fecha_fin_inscripcion": "Fecha Fin Inscripcion",
        "fecha_inicio_curso": "Fecha Inicio Curso",
        "fecha_fin_curso": "Fecha Fin Curso",
        "modulos_disponibles": "Modulos Disponibles",
        "fecha_inicio_prelanzamiento": "Fecha Inicio Prelanzamiento",
        "plazos_revision": "Plazos Revision",
    },
    "modulos": {
        "modulo_id": "ID",
        "nombre": "Nombre",
        "precio_online": "Precio Online",
        "precio_efectivo": "Precio Efectivo",
        "activo": "Activo",
        "capacidad": "Capacidad",
        "reserva_prelanzamiento_plazas": "Reserva Prelanzamiento",
    },
    "alumnos": {
        # READ-ONLY in Airtable (removed after Metadata-API audit, would 422):
        #   nombre   -> "Nombre"       (multipleLookupValues)
        #   email    -> "Email"        (multipleLookupValues)
        #   telefono -> "Phone Number" (multipleLookupValues)
        "estado_general": "Estado General",
        "idioma": "Idioma",
        "modulo_solicitado": "Modulo Solicitado",
        "modulos_completados": "Modulos Completados",
        "edicion_id": "Edicion",
        "foto_perfil": "Foto de Perfil",
        "plazo_revision": "Plazo Revision",
        "fecha_plazo": "Fecha Plazo",
        # fecha_preinscripcion -> "Fecha Preinscripcion" is a createdTime field
        # in Airtable (READ-ONLY) — removed after Metadata-API audit, would 422.
        "modulo_reserva": "Modulo Reserva",
        "fecha_entrada_reserva": "Fecha Entrada Reserva",
        # engagement_score (rollup), resumen_feedback_ia + siguiente_accion_ia
        # (AI/computed) are READ-ONLY in Airtable — removed (would 422 on --load).
        "notas_internas": "Notas Internas",
        "admin_responsable": "Admin Responsable",
        "pareja_email": "Pareja Email",
        "pareja_alumno_id": "Pareja (Link)",
        "onboarding_enviado": "Onboarding Enviado",
        "bloqueado_proev26": "Bloqueado ProEv26",
        "disculpa_enviada": "Disculpa Enviada",
        "prelanzamiento_enviado": "Prelanzamiento Enviado",
        "followup_prelanzamiento": "Followup Prelanzamiento",
    },
    "revisiones_video": {
        "alumno_id": "Alumno",
        "video_enviado": "Video Enviado",
        "redes_sociales": "Redes Sociales",
        "usuarios_rrss": "Usuarios RRSS",
        "estado_revision": "Estado de Revisión",  # audit: accent added (live name)
        "puntuacion": "Puntuacion",
        "feedback": "Feedback",
        "revisor_responsable": "Revisor Responsable",
        "fecha_revision": "Fecha de Revisión",  # audit: accent added (live name)
        # READ-ONLY in Airtable (removed, would 422 on --load):
        #   resumen_inteligente -> "Resumen Inteligente de Feedback" (AI)
        #   clasificacion_automatica -> "Clasificacion Automatica de Video" (AI)
        #   email_alumno -> "Email del Alumno" (lookup of Alumno.Email)
        #   perfiles_rrss -> "Perfiles Redes Sociales" (lookup)
    },
    "pagos": {
        "alumno_id": "Alumno",
        "importe": "Importe",
        "moneda": "Moneda",
        "estado_pago": "Estado de Pago",
        "fecha_pago": "Fecha de Pago",
        "link_pago_stripe": "Link Pago Stripe",
        "id_sesion_stripe": "ID Sesión Stripe",  # audit: accent added (live name)
        "link_recibo": "Link Recibo",
        # resumen_inteligente / analisis_riesgo -> AI/computed fields in Airtable
        # (READ-ONLY) — removed, would 422 on --load. Full Metadata-API audit pending.
    },
    "envios_emails": {
        "tipo": "Tipo",
        "mensaje": "Mensaje",
        "descripcion": "Descripcion",
        "estado": "Estado",
        "total_emails": "Total Emails",
        "emails_creados": "Emails Creados",
        "fecha_completado": "Fecha Completado",
    },
    "cola_emails": {
        "alumno_id": "Alumno",
        # alumno_nombre -> "Alumno Nombre" is a lookup of Alumno.Nombre in
        # Airtable (READ-ONLY) — removed, would 422 on --load.
        "tipo": "Tipo",
        # asunto -> "Asunto" does NOT exist on Cola de Emails (only "Asunto
        # Generado") — removed after Metadata-API audit (MISSING field).
        "asunto_generado": "Asunto Generado",
        "email_generado": "Email Generado",
        "mensaje": "Mensaje",
        "estado": "Estado",
        "origen": "Origen",
        # descripcion -> "Descripcion" does NOT exist on Cola de Emails —
        # removed after Metadata-API audit (MISSING field).
        "fecha_envio": "Fecha Envio",
        "reprogramado": "Reprogramado",
        "ultimo_reproceso": "Ultimo Reproceso",
    },
    "inbox": {
        "de": "De",
        "para": "Para",
        "asunto": "Asunto",
        "fecha": "Fecha",
        "contenido": "Contenido",
        "contenido_html": "Contenido HTML",
        "message_id": "messageId",
        "thread_id": "threadId",
        "direccion": "Direccion",
        "estado": "Estado",
        "origen": "Origen",
        "alumno_id": "Alumno",
        "resumen_ia": "Resumen AI",
        "tipo_consulta": "Tipo Consulta",
        "requiere_atencion": "Requiere Atencion",
        "respuesta_sugerida": "Respuesta Sugerida",
        "respuesta_final": "Respuesta Final",
        "respuesta_enviada": "Respuesta Enviada",
        "fecha_apertura": "Fecha Apertura",
        "gmail_leido": "Gmail Leido",
        "gmail_eliminado": "Gmail Eliminado",
    },
    "historial": {
        "alumno_id": "Alumno",
        "descripcion": "Descripción Detallada",  # audit: live name (was "Descripcion")
        "tipo_accion": "Tipo de Acción",  # audit: accent added (live name)
        "origen_evento": "Origen del Evento",
        "error_log": "Error Log",
        "workflow": "workflow",
        # resumen_automatico / clasificacion_importancia -> AI/computed fields in
        # Airtable (READ-ONLY) — removed, would 422 on --load. Audit pending.
    },
}


# ------------------------------------------------------------------
# Per-table accumulated reverse-sync result
# ------------------------------------------------------------------
@dataclass
class SyncResult:
    """Counters + skip/error details for one table's reverse-sync pass."""

    table: str
    fetched: int = 0          # rows read from Supabase
    to_patch: int = 0         # rows with airtable_id -> PATCH
    to_create: int = 0        # rows without airtable_id -> POST
    skipped_fk: list[tuple[str, list[str]]] = dc_field(default_factory=list)
    written: int = 0          # records actually PATCHed/POSTed (live only)

    @property
    def planned(self) -> int:
        return self.to_patch + self.to_create


# ------------------------------------------------------------------
# Core inversion: a Postgres row -> Airtable {fields} payload.
# ------------------------------------------------------------------
def build_airtable_fields(
    table: str,
    row: dict[str, Any],
    fk_maps: dict[str, dict[str, str]],
) -> tuple[dict[str, Any], list[str]]:
    """Invert one Supabase row into an Airtable ``fields`` payload.

    PURE function (no DB / no network): the single source of truth for how
    a Postgres row becomes an Airtable write payload, shared by the live
    path AND the self-test so the test exercises the real code path.

    For each column in TABLE_COLUMNS[table] that has a curated writable
    Airtable target (COLUMN_TO_AIRTABLE_FIELD):
      * FK / self_fk columns: resolve the row's UUID to the parent's
        Airtable recId via ``fk_maps[parent_table][uuid]`` and write it as
        a single-element link array ``[recId]``. If the parent has no
        airtable_id yet, the field is DROPPED and a skip reason recorded.
      * text[] columns: written as an Airtable array.
      * everything else: written as-is (None values are dropped so we don't
        clobber Airtable with nulls).

    Returns ``(fields, skipped)``. ``skipped`` lists human-readable reasons
    for any FK fields that could not be linked (the row is still written
    with its remaining fields).
    """
    columns = TABLE_COLUMNS[table]
    targets = COLUMN_TO_AIRTABLE_FIELD.get(table, {})
    fields: dict[str, Any] = {}
    skipped: list[str] = []
    for col, spec in columns.items():
        at_field = targets.get(col)
        if at_field is None:
            # No curated writable target for this column -> never write it.
            continue
        val = row.get(col)
        if val is None:
            # Do not clobber Airtable with explicit nulls on PATCH.
            continue
        if spec.fk:
            # UUID -> parent Airtable recId (self_fk resolves the same way:
            # the parent map covers the whole parent table up-front).
            parent_table = spec.fk
            parent_uuid = _first(val)
            rec_id = fk_maps.get(parent_table, {}).get(str(parent_uuid))
            if rec_id is None:
                skipped.append(
                    f"{col}: parent {parent_table} {parent_uuid} has no "
                    f"airtable_id yet -> link dropped"
                )
                continue
            fields[at_field] = [rec_id]
        elif spec.kind == "text[]":
            fields[at_field] = val if isinstance(val, list) else [val]
        else:
            fields[at_field] = val
    return fields, skipped


def plan_row(
    table: str,
    row: dict[str, Any],
    fk_maps: dict[str, dict[str, str]],
) -> tuple[str, dict[str, Any], list[str]]:
    """Decide PATCH vs CREATE for one row and build its payload.

    Returns ``(action, payload, skipped)`` where:
      * action is ``"patch"`` when the row has an ``airtable_id`` (the
        payload includes that recId), or ``"create"`` otherwise.
      * payload is the Airtable request body fragment:
          - patch:  {"id": <recId>, "fields": {...}}
          - create: {"fields": {...}, "__pg_id": <pg uuid>}  (the __pg_id is
            stripped before the request; it lets --load write the returned
            recId back into Supabase.)
      * skipped is the list of dropped-FK reasons from build_airtable_fields.
    """
    fields, skipped = build_airtable_fields(table, row, fk_maps)
    airtable_id = row.get("airtable_id")
    if airtable_id:
        return "patch", {"id": airtable_id, "fields": fields}, skipped
    return "create", {"fields": fields, "__pg_id": row.get("id")}, skipped


# ------------------------------------------------------------------
# Supabase source (guarded — only used for a live read)
# ------------------------------------------------------------------
def build_fk_maps(
    conn: Any,
    tables: list[str],
) -> dict[str, dict[str, str]]:
    """Build {parent_table: {pg_uuid: airtable_id}} for every FK parent.

    A row's FK column holds a Postgres UUID; to write it back to Airtable we
    need the parent's Airtable recId. We read ``SELECT id, airtable_id`` from
    each parent table referenced by any selected table's FK columns (plus the
    tables themselves, so self-FKs resolve). Parents missing an airtable_id
    are simply absent from the map (their children's links get dropped).
    """
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is required to read Supabase FK parents")
    parents: set[str] = set()
    for table in tables:
        for spec in TABLE_COLUMNS[table].values():
            if spec.fk:
                parents.add(spec.fk)
    maps: dict[str, dict[str, str]] = {}
    with conn.cursor() as cur:
        for parent in sorted(parents):
            # ``parent`` is an internal whitelist table name (a key of
            # TABLE_COLUMNS, never user input). It is composed via
            # psycopg2.sql.Identifier so the statement is injection-safe by
            # construction (quoted identifier, no string concatenation).
            cur.execute(  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
                psql.SQL(
                    "SELECT id, airtable_id FROM {table} "
                    "WHERE airtable_id IS NOT NULL"
                ).format(table=psql.Identifier(parent))
            )
            maps[parent] = {str(pk): aid for pk, aid in cur.fetchall()}
    return maps


def read_supabase_rows(conn: Any, table: str) -> list[dict[str, Any]]:
    """Read all rows for ``table`` from Supabase as column->value dicts.

    Selects ``id``, ``airtable_id`` and every column in TABLE_COLUMNS[table]
    so build_airtable_fields can invert the row. Returns dicts keyed by
    Postgres column name.
    """
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is required for a live Supabase read")
    cols = ["id", "airtable_id"] + list(TABLE_COLUMNS[table].keys())
    with conn.cursor() as cur:
        # ``table`` and ``cols`` are internal whitelist identifiers (keys of
        # TABLE_COLUMNS, never user input), composed via psycopg2.sql so the
        # statement is injection-safe by construction (quoted identifiers).
        cur.execute(  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
            psql.SQL("SELECT {cols} FROM {table}").format(
                cols=psql.SQL(", ").join(psql.Identifier(c) for c in cols),
                table=psql.Identifier(table),
            )
        )
        col_names = [d[0] for d in cur.description]
        return [dict(zip(col_names, r)) for r in cur.fetchall()]


def _chunks(items: list[Any], size: int) -> list[list[Any]]:
    """Split ``items`` into consecutive chunks of at most ``size``."""
    return [items[i:i + size] for i in range(0, len(items), size)]


# ------------------------------------------------------------------
# Airtable target writers (guarded — only used with --load)
# ------------------------------------------------------------------
def patch_airtable_records(
    base_id: str,
    table_id: str,
    pat: str,
    limiter: RateLimiter,
    patches: list[dict[str, Any]],
) -> int:
    """PATCH up to 10 records/request. ``patches`` are {"id", "fields"} dicts.

    Returns the number of records updated. Raises RuntimeError if ``requests``
    is unavailable (live writes need it).
    """
    if requests is None:
        raise RuntimeError("the 'requests' package is required for --load")
    url = f"{AIRTABLE_API_ROOT}/{base_id}/{table_id}"
    headers = {
        "Authorization": f"Bearer {pat}",
        "Content-Type": "application/json",
    }
    updated = 0
    for chunk in _chunks(patches, AIRTABLE_BATCH_SIZE):
        limiter.wait()
        resp = requests.patch(
            url, headers=headers, json={"records": chunk}, timeout=30,
        )
        resp.raise_for_status()
        updated += len(resp.json().get("records", []))
    return updated


def create_airtable_records(
    base_id: str,
    table_id: str,
    pat: str,
    limiter: RateLimiter,
    creates: list[dict[str, Any]],
    on_chunk: Callable[[list[tuple[str, str]]], None] | None = None,
) -> list[tuple[str, str]]:
    """POST up to 10 records/request. ``creates`` are {"fields", "__pg_id"}.

    The ``__pg_id`` is stripped before the request and paired with the
    Airtable-assigned recId in the return value so the caller can write the
    recId back into Supabase. Returns a list of ``(pg_id, new_rec_id)``.

    PER-CHUNK WRITEBACK (data-safety): when ``on_chunk`` is given it is invoked
    with *this chunk's* ``(pg_id, rec_id)`` pairs immediately after each
    successful POST, BEFORE the next chunk is sent. The caller uses it to write
    those recIds back into Supabase and COMMIT, so a failure mid-table leaves
    every already-created row correctly linked (its airtable_id persisted) and
    the run is safely re-runnable — re-running PATCHes those rows instead of
    POSTing duplicates into production Airtable.
    """
    if requests is None:
        raise RuntimeError("the 'requests' package is required for --load")
    url = f"{AIRTABLE_API_ROOT}/{base_id}/{table_id}"
    headers = {
        "Authorization": f"Bearer {pat}",
        "Content-Type": "application/json",
    }
    pairs: list[tuple[str, str]] = []
    for chunk in _chunks(creates, AIRTABLE_BATCH_SIZE):
        pg_ids = [c["__pg_id"] for c in chunk]
        body = {"records": [{"fields": c["fields"]} for c in chunk]}
        limiter.wait()
        resp = requests.post(url, headers=headers, json=body, timeout=30)
        resp.raise_for_status()
        returned = resp.json().get("records", [])
        # Airtable returns created records in request order, so we zip the pg ids
        # back to the new recIds positionally. If the counts ever differ, the
        # positional zip would silently mis-pair (and drop) recIds, corrupting
        # the writeback — fail loudly instead.
        if len(returned) != len(chunk):
            raise RuntimeError(
                f"Airtable POST returned {len(returned)} record(s) for a chunk "
                f"of {len(chunk)} — refusing to positionally zip recIds "
                f"(would mis-link/drop airtable_id writebacks)"
            )
        chunk_pairs = [
            (str(pg_id), rec["id"]) for pg_id, rec in zip(pg_ids, returned)
        ]
        # Persist THIS chunk's recIds before the next POST so a later failure
        # cannot orphan already-created Airtable rows (re-run would duplicate).
        if on_chunk is not None:
            on_chunk(chunk_pairs)
        pairs.extend(chunk_pairs)
    return pairs


def write_back_airtable_ids(
    conn: Any,
    table: str,
    pairs: list[tuple[str, str]],
) -> None:
    """Write Airtable recIds back into Supabase ``airtable_id`` for new rows.

    Called only under --load after create_airtable_records, so the next sync
    PATCHes those rows instead of creating duplicates. ``pairs`` is a list of
    ``(pg_id, rec_id)``.
    """
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is required to write recIds back")
    with conn.cursor() as cur:
        for pg_id, rec_id in pairs:
            # ``table`` is an internal whitelist identifier composed via
            # psycopg2.sql; pg_id / rec_id stay %s-bound (parameterized).
            cur.execute(  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
                psql.SQL(
                    "UPDATE {table} SET airtable_id = %s WHERE id = %s"
                ).format(table=psql.Identifier(table)),
                (rec_id, pg_id),
            )
    conn.commit()


# ------------------------------------------------------------------
# Core reverse-sync pass
# ------------------------------------------------------------------
def plan_table(
    table: str,
    rows: list[dict[str, Any]],
    fk_maps: dict[str, dict[str, str]],
) -> tuple[SyncResult, list[dict[str, Any]], list[dict[str, Any]]]:
    """Plan PATCH/CREATE for every row of one table.

    Returns ``(result, patches, creates)`` where ``patches`` are
    {"id", "fields"} dicts and ``creates`` are {"fields", "__pg_id"} dicts,
    ready for the Airtable writers. No network/DB here.
    """
    result = SyncResult(table=table, fetched=len(rows))
    patches: list[dict[str, Any]] = []
    creates: list[dict[str, Any]] = []
    for row in rows:
        action, payload, skipped = plan_row(table, row, fk_maps)
        if skipped:
            ident = str(row.get("airtable_id") or row.get("id") or "<no-id>")
            result.skipped_fk.append((ident, skipped))
        if action == "patch":
            result.to_patch += 1
            patches.append(payload)
        else:
            result.to_create += 1
            creates.append(payload)
    return result, patches, creates


def write_report(results: list[SyncResult], path: str, dry_run: bool) -> None:
    """Write a per-table Markdown report of the reverse-sync plan/outcome."""
    mode = "DRY-RUN (no Airtable writes)" if dry_run else "LOAD (live writes)"
    total_fetched = sum(r.fetched for r in results)
    total_patch = sum(r.to_patch for r in results)
    total_create = sum(r.to_create for r in results)
    total_written = sum(r.written for r in results)
    lines: list[str] = [
        "# ProEv Supabase -> Airtable REVERSE sync report",
        "",
        "> FIRST CUT — review the inverse field map + FK resolution before "
        "any live `--load`.",
        "",
        f"- Mode: **{mode}**",
        f"- Tables processed: {len(results)}",
        f"- Rows read (Supabase): {total_fetched}",
        f"- Planned PATCH: {total_patch} | Planned CREATE: {total_create}",
        f"- Records written (live): {total_written}",
        "",
        "## Per-table plan",
        "",
        "| Table | Rows | PATCH | CREATE | FK-skips | Written |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for r in results:
        lines.append(
            f"| {r.table} | {r.fetched} | {r.to_patch} | {r.to_create} "
            f"| {len(r.skipped_fk)} | {r.written} |"
        )
    lines.append("")
    for r in results:
        if not r.skipped_fk:
            continue
        lines.append(f"## Dropped FK links — {r.table}")
        lines.append("")
        for ident, reasons in r.skipped_fk:
            lines.append(f"- `{ident}`: {'; '.join(reasons)}")
        lines.append("")

    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def run(
    tables: list[str],
    dry_run: bool,
    report_path: str,
    base_id: str,
    pat: str | None,
    db_url: str | None,
    rows_provider: Callable[[str], list[dict[str, Any]]] | None = None,
    fk_maps_override: dict[str, dict[str, str]] | None = None,
) -> int:
    """Run the reverse-sync over the selected tables (parent->child order).

    ``rows_provider`` / ``fk_maps_override`` let the self-test inject mock
    data with no DB. When both are None, rows + FK maps are read live from
    Supabase. Writes to Airtable happen ONLY when ``dry_run`` is False.
    """
    limiter = RateLimiter(MAX_REQUESTS_PER_SECOND)
    # Preserve FK-safe parent->child order regardless of --tables ordering.
    ordered = [t for t in LOAD_ORDER if t in tables]
    for t in tables:  # keep any explicitly-named unknown-order tables last
        if t not in ordered and t in TABLE_COLUMNS:
            ordered.append(t)

    conn = None
    if rows_provider is None or (not dry_run):
        # A live read (or any live write) needs a real DB connection.
        if db_url is None:
            print("[error] SUPABASE_DB_URL not set; cannot read/write Supabase")
            return 2
        if psycopg2 is None:
            print("[error] psycopg2 not installed; cannot reach Supabase")
            return 2
        conn = psycopg2.connect(db_url)

    results: list[SyncResult] = []
    try:
        if fk_maps_override is not None:
            fk_maps = fk_maps_override
        elif conn is not None:
            fk_maps = build_fk_maps(conn, ordered)
        else:
            fk_maps = {}

        for table in ordered:
            if rows_provider is not None:
                rows = rows_provider(table)
            else:
                rows = read_supabase_rows(conn, table)
            result, patches, creates = plan_table(table, rows, fk_maps)

            if not dry_run:
                if pat is None:
                    print("[error] AIRTABLE_PAT not set; cannot write")
                    return 2
                table_id = AIRTABLE_TABLES[table]
                n_patched = patch_airtable_records(
                    base_id, table_id, pat, limiter, patches,
                )

                # Per-chunk writeback: persist each chunk's recIds into Supabase
                # (and commit) the instant its POST succeeds, so a mid-table
                # failure leaves created rows correctly linked + re-runnable.
                # Newly-created parents also become linkable by later children
                # within the same run as soon as their chunk lands.
                def _persist_chunk(
                    chunk_pairs: list[tuple[str, str]],
                    _table: str = table,
                ) -> None:
                    if not chunk_pairs or conn is None:
                        return
                    write_back_airtable_ids(conn, _table, chunk_pairs)
                    fk_maps.setdefault(_table, {})
                    for pg_id, rec_id in chunk_pairs:
                        fk_maps[_table][pg_id] = rec_id

                pairs = create_airtable_records(
                    base_id, table_id, pat, limiter, creates,
                    on_chunk=_persist_chunk if conn is not None else None,
                )
                result.written = n_patched + len(pairs)
            results.append(result)
    finally:
        if conn is not None:
            conn.close()

    write_report(results, report_path, dry_run)

    total_fetched = sum(r.fetched for r in results)
    total_patch = sum(r.to_patch for r in results)
    total_create = sum(r.to_create for r in results)
    total_written = sum(r.written for r in results)
    print("=" * 50)
    print(f"Mode      : {'DRY-RUN' if dry_run else 'LOAD'}")
    print(f"Tables    : {len(results)}")
    print(f"Rows read : {total_fetched} | PATCH: {total_patch} | "
          f"CREATE: {total_create} | Written: {total_written}")
    print(f"Report    : {report_path}")
    return 0


# ------------------------------------------------------------------
# Self-test (mock fixtures, no network/DB)
# ------------------------------------------------------------------
def _self_test() -> int:
    """Verify the INVERSION (pg row -> Airtable fields) with mock fixtures.

    Asserts concrete expected payloads: column->field renaming, UUID->recId
    FK resolution (incl. self-FK), text[] arrays, create-vs-patch decision,
    null-drop on PATCH, and the dropped-FK skip path. No network/DB touched.
    """
    # {uuid: airtable_id} parent maps. recAL_X are alumno recIds; one alumno
    # (the self-FK target) is deliberately ABSENT to exercise the drop path.
    fk_maps: dict[str, dict[str, str]] = {
        "ediciones": {"uuid-edi-1": "recEDI1"},
        "alumnos": {
            "uuid-al-1": "recAL1",
            "uuid-al-2": "recAL2",
            # uuid-al-missing intentionally absent (no airtable_id yet).
        },
    }

    # --- 1. PATCH path: alumno WITH airtable_id, FK + self-FK + null-drop ---
    alumno_row = {
        "id": "uuid-al-1",
        "airtable_id": "recAL1",
        "nombre": "Ana Test",
        "email": "ana@example.com",
        "estado_general": "Preinscrito",
        "idioma": "Espanol",
        "edicion_id": "uuid-edi-1",          # FK -> [recEDI1]
        "pareja_alumno_id": "uuid-al-2",     # self-FK -> [recAL2]
        "modulos_completados": ["M1", "M2"], # text[] -> array passthrough
        "telefono": None,                    # None -> dropped (no clobber)
    }
    action, payload, skipped = plan_row("alumnos", alumno_row, fk_maps)
    f = payload["fields"]
    patch_ok = (
        action == "patch"
        and payload["id"] == "recAL1"
        and "Nombre" not in f                          # lookup -> dropped (audit)
        and "Email" not in f                           # lookup -> dropped (audit)
        and f.get("Estado General") == "Preinscrito"
        and f.get("Edicion") == ["recEDI1"]          # UUID->recId link array
        and f.get("Pareja (Link)") == ["recAL2"]     # self-FK resolved
        and f.get("Modulos Completados") == ["M1", "M2"]
        and "Phone Number" not in f                   # lookup -> dropped (audit)
        and skipped == []
    )

    # --- 2. CREATE path: alumno WITHOUT airtable_id -> POST + __pg_id ---
    new_row = {
        "id": "uuid-al-new",
        "airtable_id": None,
        "nombre": "Nuevo",
        "email": "nuevo@example.com",
        "estado_general": "Privado",
    }
    action2, payload2, skipped2 = plan_row("alumnos", new_row, fk_maps)
    create_ok = (
        action2 == "create"
        and payload2.get("__pg_id") == "uuid-al-new"
        and "id" not in payload2                       # no recId to PATCH
        and "Nombre" not in payload2["fields"]         # lookup -> dropped (audit)
        and payload2["fields"].get("Estado General") == "Privado"
        and skipped2 == []
    )

    # --- 3. Dropped-FK path: self-FK target has no airtable_id yet ---
    orphan_row = {
        "id": "uuid-al-3",
        "airtable_id": "recAL3",
        "nombre": "Sin Pareja",                 # lookup -> dropped (audit)
        "email": "sp@example.com",              # lookup -> dropped (audit)
        "estado_general": "Preinscrito",        # writable -> kept
        "pareja_alumno_id": "uuid-al-missing",  # absent in fk_maps -> drop
    }
    _, payload3, skipped3 = plan_row("alumnos", orphan_row, fk_maps)
    drop_ok = (
        "Pareja (Link)" not in payload3["fields"]      # link dropped
        and "Nombre" not in payload3["fields"]         # lookup -> dropped (audit)
        and payload3["fields"].get("Estado General") == "Preinscrito"
        and any("pareja_alumno_id" in s for s in skipped3)
    )

    # --- 4. Child FK (pagos.alumno_id -> Alumno link) ---
    pago_row = {
        "id": "uuid-pay-1",
        "airtable_id": "recPAY1",
        "alumno_id": "uuid-al-1",
        "importe": 49.9,
        "moneda": "EUR",
        "estado_pago": "Completado",
    }
    _, pay_payload, pay_skipped = plan_row("pagos", pago_row, fk_maps)
    pf = pay_payload["fields"]
    child_fk_ok = (
        pf.get("Alumno") == ["recAL1"]
        and pf.get("Importe") == 49.9
        and pf.get("Moneda") == "EUR"
        and pf.get("Estado de Pago") == "Completado"
        and pay_skipped == []
    )

    # --- 4b. READ-ONLY fields stripped (Fix G): lookup/rollup/AI Airtable
    # fields must NEVER appear in a payload even when the pg row carries values
    # for them (sending them would 422 a live --load). ---
    readonly_alumno_row = {
        "id": "uuid-al-ro",
        "airtable_id": "recALRO",
        "nombre": "RO Test",
        "email": "ro@example.com",
        "engagement_score": 87,                 # rollup -> must be dropped
        "resumen_feedback_ia": "ai summary",    # AI -> must be dropped
        "siguiente_accion_ia": "do x",          # AI -> must be dropped
    }
    _, ro_payload, _ = plan_row("alumnos", readonly_alumno_row, fk_maps)
    rof = ro_payload["fields"]
    readonly_rev_row = {
        "id": "uuid-rev-ro",
        "airtable_id": "recREVRO",
        "alumno_id": "uuid-al-1",
        "email_alumno": "lookup@example.com",   # lookup -> dropped
        "perfiles_rrss": "@handle",             # lookup -> dropped
        "resumen_inteligente": "ai",            # AI -> dropped
        "clasificacion_automatica": "auto",     # AI -> dropped
        "feedback": "real feedback",            # writable -> kept
    }
    _, rev_payload, _ = plan_row("revisiones_video", readonly_rev_row, fk_maps)
    revf = rev_payload["fields"]
    readonly_cola_row = {
        "id": "uuid-cola-ro",
        "airtable_id": "recCOLARO",
        "alumno_nombre": "Lookup Name",         # lookup -> dropped
        "asunto": "Hola",                       # MISSING field -> dropped (audit)
        "tipo": "manual",                       # writable -> kept
    }
    _, cola_payload, _ = plan_row("cola_emails", readonly_cola_row, fk_maps)
    colaf = cola_payload["fields"]
    readonly_stripped_ok = (
        "Engagement Score" not in rof
        and "Resumen Feedback Video (AI)" not in rof
        and "Siguiente Accion Recomendada (AI)" not in rof
        and "Email del Alumno" not in revf
        and "Perfiles Redes Sociales" not in revf
        and "Resumen Inteligente de Feedback" not in revf
        and "Clasificacion Automatica de Video" not in revf
        and revf.get("Feedback") == "real feedback"   # writable still present
        and "Alumno Nombre" not in colaf
        and "Asunto" not in colaf                     # MISSING field dropped (audit)
        and colaf.get("Tipo") == "manual"             # writable still present
    )

    # --- 5. End-to-end dry-run via run() with mock providers (no DB) ---
    import tempfile
    report_path = os.path.join(tempfile.gettempdir(), "revsync_selftest.md")
    rows_by_table = {
        "alumnos": [alumno_row, new_row, orphan_row],
        "pagos": [pago_row],
    }
    rc = run(
        tables=["alumnos", "pagos"],
        dry_run=True,
        report_path=report_path,
        base_id=AIRTABLE_BASE_ID_DEFAULT,
        pat=None,
        db_url=None,
        rows_provider=lambda t: rows_by_table.get(t, []),
        fk_maps_override=fk_maps,
    )
    run_ok = rc == 0 and os.path.exists(report_path)

    # --- 6. Per-chunk writeback (Fix E) + zip mismatch (Fix F) -------------
    # Drive create_airtable_records with a fake `requests` so no network is
    # touched. Assert on_chunk fires AFTER each successful POST (not once at the
    # end), so a mid-run failure still persists the chunks that did land.
    global requests  # the module-level guarded `requests` handle
    saved_requests = requests

    class _FakeResp:
        def __init__(self, records: list[dict[str, str]]) -> None:
            self._records = records

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return {"records": self._records}

    # 6a. Per-chunk callback ordering: 25 creates -> 3 chunks (10/10/5). The
    # callback must be invoked once per chunk, each time with only that chunk's
    # pairs, so a failure on chunk N still has chunks < N persisted.
    chunk_calls: list[list[tuple[str, str]]] = []
    posted: list[int] = []

    class _FakeRequestsOK:
        @staticmethod
        def post(url: str, headers: dict[str, str], json: dict[str, Any],
                 timeout: int) -> _FakeResp:
            n = len(json["records"])
            posted.append(n)
            recs = [{"id": f"recNEW{len(posted)}_{i}"} for i in range(n)]
            return _FakeResp(recs)

    requests = _FakeRequestsOK  # type: ignore[assignment]
    try:
        creates_25 = [
            {"fields": {"Nombre": f"n{i}"}, "__pg_id": f"pg{i}"}
            for i in range(25)
        ]
        all_pairs = create_airtable_records(
            AIRTABLE_BASE_ID_DEFAULT, "tblFAKE", "patFAKE",
            RateLimiter(0), creates_25,
            on_chunk=lambda cp: chunk_calls.append(list(cp)),
        )
        per_chunk_ok = (
            posted == [10, 10, 5]
            and len(chunk_calls) == 3
            and [len(c) for c in chunk_calls] == [10, 10, 5]
            # each callback got ONLY its own chunk's pairs, in order
            and chunk_calls[0][0] == ("pg0", "recNEW1_0")
            and chunk_calls[2][-1] == ("pg24", "recNEW3_4")
            and len(all_pairs) == 25
        )

        # 6b. Zip-length mismatch (Fix F): Airtable returns fewer records than
        # the chunk -> must raise (never silently truncate the positional zip).
        class _FakeRequestsShort:
            @staticmethod
            def post(url: str, headers: dict[str, str], json: dict[str, Any],
                     timeout: int) -> _FakeResp:
                recs = json["records"][:-1]  # drop one -> count mismatch
                return _FakeResp([{"id": f"r{i}"} for i in range(len(recs))])

        requests = _FakeRequestsShort  # type: ignore[assignment]
        zip_mismatch_ok = False
        try:
            create_airtable_records(
                AIRTABLE_BASE_ID_DEFAULT, "tblFAKE", "patFAKE",
                RateLimiter(0),
                [{"fields": {}, "__pg_id": f"pg{i}"} for i in range(3)],
            )
        except RuntimeError as exc:
            zip_mismatch_ok = "refusing to positionally zip" in str(exc)
    finally:
        requests = saved_requests  # type: ignore[assignment]

    print("--- reverse-sync self-test assertions ---")
    print(f"PATCH payload (renames/FK/self-FK/null): {patch_ok}")
    print(f"CREATE payload (no airtable_id -> POST) : {create_ok}")
    print(f"dropped-FK skip (orphan self-FK)        : {drop_ok}")
    print(f"child FK link (pagos.alumno_id)         : {child_fk_ok}")
    print(f"read-only fields stripped (Fix G)       : {readonly_stripped_ok}")
    print(f"per-chunk writeback callback (Fix E)    : {per_chunk_ok}")
    print(f"zip-length mismatch raises (Fix F)      : {zip_mismatch_ok}")
    print(f"end-to-end dry-run run() (no DB)        : {run_ok} ({report_path})")
    ok = (
        patch_ok and create_ok and drop_ok and child_fk_ok
        and readonly_stripped_ok and per_chunk_ok and zip_mismatch_ok
        and run_ok
    )
    print(f"SELF-TEST: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Define and parse command-line arguments (mirrors the migrator)."""
    parser = argparse.ArgumentParser(
        description=(
            "REVERSE sync ProEv data from Supabase back to Airtable "
            "(rollback target). FIRST CUT — defaults to dry-run."
        ),
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run", action="store_true", default=True,
        help="plan PATCH/CREATE without writing to Airtable (default)",
    )
    mode.add_argument(
        "--load", action="store_true", default=False,
        help="perform live Airtable writes (requires AIRTABLE_PAT + "
             "SUPABASE_DB_URL). FIRST CUT — review before use.",
    )
    parser.add_argument(
        "--tables", type=str, default=None,
        help="comma-separated table names; default = all, in FK-safe order",
    )
    parser.add_argument(
        "--report", type=str, default=DEFAULT_REPORT_PATH,
        help=f"report output path (default: {DEFAULT_REPORT_PATH})",
    )
    parser.add_argument(
        "--self-test", action="store_true", default=False,
        help="run the offline self-test with mock fixtures and exit",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entry point: resolve env + args and dispatch to run()/self-test."""
    args = parse_args(argv)
    if args.self_test:
        return _self_test()

    dry_run = not args.load
    if args.tables:
        tables = [t.strip() for t in args.tables.split(",") if t.strip()]
    else:
        tables = list(LOAD_ORDER)

    base_id = os.environ.get("AIRTABLE_BASE_ID", AIRTABLE_BASE_ID_DEFAULT)
    pat = os.environ.get("AIRTABLE_PAT")
    db_url = os.environ.get("SUPABASE_DB_URL")

    return run(
        tables=tables,
        dry_run=dry_run,
        report_path=args.report,
        base_id=base_id,
        pat=pat,
        db_url=db_url,
    )


if __name__ == "__main__":
    sys.exit(main())
