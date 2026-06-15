#!/usr/bin/env python3
"""Airtable -> Supabase DATA migrator for the ProEv project.

Reads records from the production Airtable base (app4ZpoxaWOyV4RnR), maps each
Airtable field to its Supabase column, validates every value against the
PATCHED Postgres schema (dashboard/supabase/schema.sql), applies the documented
value normalizations, and either reports (dry-run, the default) or loads the
data into Postgres (--load).

NON-DESTRUCTIVE: this script NEVER writes to Airtable. Writes to Postgres happen
only when --load is passed explicitly; the default mode is --dry-run.

# Migration design: recId -> FK strategy = OPTION B (in-memory recId->UUID map).
# Every business table keeps its synthetic `id UUID PRIMARY KEY` as the Postgres
# primary key, so Airtable record ids are NOT used as primary keys (Option A is
# not in play). This script builds an in-memory map {airtable_record_id ->
# pg_uuid} during load, generating UUIDs client-side so child-table foreign keys
# can be resolved from parent Airtable link ids. Parents are loaded before
# children (FK order below).
#
# IDEMPOTENCY (DONE): schema.sql now defines a nullable `airtable_id TEXT UNIQUE`
# column on every migrated business table, and each row carries its Airtable
# record id into that column. Loads upsert with
# `INSERT ... ON CONFLICT (airtable_id) DO UPDATE SET ...`, so --load is safely
# re-runnable: re-running updates existing rows in place instead of inserting
# duplicates.
#
# RETURNING-based FK map fix: the per-row UUID generated client-side is only
# *provisional*. On conflict the DB keeps the OLD persisted `id` (id is excluded
# from the UPDATE SET), so the upsert uses `RETURNING airtable_id, id` with
# execute_values(fetch=True) and overwrites recid_to_pk with the persisted id
# AFTER execution. This guarantees child-table FKs (loaded later) resolve to the
# row that actually exists in the DB, not a throwaway UUID — critical on re-runs
# and partial prior loads. Unresolved non-self FK links are flagged as failures
# (never silently nulled). Self-referential FKs (alumnos.pareja_alumno_id) are
# resolved by a second post-load backfill pass (backfill_self_fks).

Sources of truth (extracted, not invented):
  * FIELD_MAP            -> copied from scripts/convert_airtable_to_supabase.py
  * TABLE IDs            -> dashboard/src/utils/constants.ts (AIRTABLE_TABLES)
  * ENUM / NOT NULL / FK -> dashboard/supabase/schema.sql
  * Value normalizations -> MIGRACION-PARITY-SCHEMA.md
"""

from __future__ import annotations

import argparse
import datetime
import os
import sys
import time
import uuid
from dataclasses import dataclass, field as dc_field
from typing import Any, Callable

# requests / psycopg2 are imported lazily and guarded so the dry-run path works
# with mock fixtures even when those packages are not installed.
try:  # pragma: no cover - import guard
    import requests  # type: ignore
except ImportError:  # pragma: no cover
    requests = None  # type: ignore

try:  # pragma: no cover - import guard
    import psycopg2  # type: ignore
    from psycopg2 import sql as psql  # type: ignore
    from psycopg2.extras import execute_values  # type: ignore
except ImportError:  # pragma: no cover
    psycopg2 = None  # type: ignore
    psql = None  # type: ignore
    execute_values = None  # type: ignore


AIRTABLE_BASE_ID_DEFAULT = "app4ZpoxaWOyV4RnR"
AIRTABLE_API_ROOT = "https://api.airtable.com/v0"
MAX_REQUESTS_PER_SECOND = 5
DEFAULT_REPORT_PATH = "migration_data_report.md"


# ------------------------------------------------------------------
# FIELD_MAP — copied verbatim from scripts/convert_airtable_to_supabase.py
# (Airtable field name -> Supabase column). Kept as a copy rather than an
# import because that module hardcodes stale table ids and is workflow-oriented.
# ------------------------------------------------------------------
FIELD_MAP: dict[str, str] = {
    # Alumnos
    "Estado General": "estado_general",
    "Modulo Solicitado": "modulo_solicitado",
    "Modulos Completados": "modulos_completados",
    "Modules": "modules",
    "Foto de Perfil": "foto_perfil",
    "Plazo Revision": "plazo_revision",
    "Fecha Plazo": "fecha_plazo",
    "Fecha Preinscripcion": "fecha_preinscripcion",
    "Modulo Reserva": "modulo_reserva",
    "Fecha Entrada Reserva": "fecha_entrada_reserva",
    "Engagement Score": "engagement_score",
    "Resumen Feedback Video (AI)": "resumen_feedback_ia",
    "Siguiente Acción Recomendada (AI)": "siguiente_accion_ia",
    "Notas Internas": "notas_internas",
    "Admin Responsable": "admin_responsable",
    "Nombre": "nombre",
    "Email": "email",
    "Phone Number": "telefono",
    "Idioma": "idioma",
    "Edicion": "edicion_id",
    "Pareja Email": "pareja_email",
    "Pareja (Link)": "pareja_alumno_id",
    # Alumnos — campaign / onboarding flags (parity columns)
    "Onboarding Enviado": "onboarding_enviado",
    "Bloqueado ProEv26": "bloqueado_proev26",
    "Disculpa Enviada": "disculpa_enviada",
    "Prelanzamiento Enviado": "prelanzamiento_enviado",
    "Followup Prelanzamiento": "followup_prelanzamiento",
    # Ediciones
    "Es Edicion Activa": "es_edicion_activa",
    "Estado": "estado",
    "Fecha Inicio Prelanzamiento": "fecha_inicio_prelanzamiento",
    "Plazos Revision": "plazos_revision",
    # Shared across Inbox + Cola de Emails (per-table enum handled by ColSpec).
    "Origen": "origen",
    "Fecha Inicio Inscripcion": "fecha_inicio_inscripcion",
    "Fecha Fin Inscripcion": "fecha_fin_inscripcion",
    "Fecha Inicio Curso": "fecha_inicio_curso",
    "Fecha Fin Curso": "fecha_fin_curso",
    "Modulos Disponibles": "modulos_disponibles",
    # Modulos
    "ID": "modulo_id",
    "Activo": "activo",
    "Capacidad": "capacidad",
    "Reserva Prelanzamiento": "reserva_prelanzamiento_plazas",
    "Precio Online": "precio_online",
    "Precio Efectivo": "precio_efectivo",
    # Revisiones
    "Video Enviado": "video_enviado",
    "Redes Sociales": "redes_sociales",
    "Usuarios RRSS": "usuarios_rrss",
    "Perfiles Redes Sociales": "perfiles_rrss",
    "Email del Alumno": "email_alumno",
    "Estado de Revisión": "estado_revision",
    "Puntuacion": "puntuacion",
    "Feedback": "feedback",
    "Revisor Responsable": "revisor_responsable",
    "Fecha de Revisión": "fecha_revision",
    "Resumen Inteligente de Feedback": "resumen_inteligente",
    "Clasificación Automática de Video": "clasificacion_automatica",
    "Alumno": "alumno_id",
    # Pagos
    "Importe": "importe",
    "Moneda": "moneda",
    "Estado de Pago": "estado_pago",
    "Fecha de Pago": "fecha_pago",
    "Link Pago Stripe": "link_pago_stripe",
    "ID Sesión Stripe": "id_sesion_stripe",
    "Link Recibo": "link_recibo",
    "Resumen Inteligente del Pago": "resumen_inteligente",
    "Análisis de Riesgo de Pago": "analisis_riesgo",
    # Historial
    "Descripcion": "descripcion",
    "Descripción Detallada": "descripcion",
    "Tipo de Acción": "tipo_accion",
    "Tipo Accion": "tipo_accion",
    "Origen del Evento": "origen_evento",
    "Origen Evento": "origen_evento",
    "Error Log": "error_log",
    "workflow": "workflow",
    "Resumen Automático del Evento": "resumen_automatico",
    "Clasificación AI de Importancia": "clasificacion_importancia",
    # Cola Emails
    "Alumno Nombre": "alumno_nombre",
    "Tipo": "tipo",
    "Asunto": "asunto",
    "Asunto Generado": "asunto_generado",
    "Mensaje": "mensaje",
    "Email Generado": "email_generado",
    "Fecha Envio": "fecha_envio",
    "Reprogramado": "reprogramado",
    "Ultimo Reproceso": "ultimo_reproceso",
    # Inbox
    "De": "de",
    "Para": "para",
    "Contenido": "contenido",
    "Contenido HTML": "contenido_html",
    "messageId": "message_id",
    "threadId": "thread_id",
    "Direccion": "direccion",
    "Fecha": "fecha",
    "Fecha Apertura": "fecha_apertura",
    "Gmail Leido": "gmail_leido",
    "Gmail Eliminado": "gmail_eliminado",
    "Resumen AI": "resumen_ia",
    "Tipo Consulta": "tipo_consulta",
    "Requiere Atencion": "requiere_atencion",
    "Respuesta Sugerida": "respuesta_sugerida",
    "Respuesta Final": "respuesta_final",
    "Respuesta Enviada": "respuesta_enviada",
    # Envios de Emails
    "Total Emails": "total_emails",
    "Emails Creados": "emails_creados",
    "Fecha Completado": "fecha_completado",
}


# ------------------------------------------------------------------
# AIRTABLE_TABLES — table ids from dashboard/src/utils/constants.ts.
# These are authoritative for the live base (they match MEMORY.md gotchas, e.g.
# Revisiones = tbluWapTseCcfcfXc), unlike the stale ids in the convert script.
# ------------------------------------------------------------------
AIRTABLE_TABLES: dict[str, str] = {
    "alumnos": "tblmfv5beVBGOZ2sb",
    "revisiones_video": "tbluWapTseCcfcfXc",
    "pagos": "tblWC5K2xuLr3XXQ4",
    "historial": "tbl3Zkove7j24eCho",
    "ediciones": "tblYhOznRk0bdEROJ",
    "modulos": "tbly892Tp5KZBDWgr",
    "cola_emails": "tblVqFfucbW5POC5u",
    "envios_emails": "tblsh8KaCMQ8KoKeU",
    "inbox": "tblyp8NSzdpnTqkPD",
}


# ------------------------------------------------------------------
# ENUM allowed values — copied from dashboard/supabase/schema.sql CREATE TYPE.
# ------------------------------------------------------------------
ENUM_VALUES: dict[str, set[str]] = {
    "estado_general": {
        "Privado", "Preinscrito", "En revisión de video", "Aprobado",
        "Rechazado", "Pendiente de pago", "Reserva", "Pagado", "Finalizado",
        "Plazo Vencido", "Pago Fallido",
    },
    "estado_revision": {
        "Pendiente", "Aprobado", "Rechazado", "Revision Necesaria",
        "Video no accesible",
    },
    "estado_pago": {
        "Pendiente", "Pagado", "Fallido", "Reembolsado", "Enviado",
        "Completado", "Pendiente Verificación",
    },
    "estado_email": {
        "Pendiente Aprobacion", "Pendiente", "Enviando", "Enviado", "Error",
    },
    # Envios de Emails (bulk-send) status — exact live Airtable singleSelect
    # choices of tblsh8KaCMQ8KoKeU.Estado (verified against base app4ZpoxaWOyV4RnR).
    "estado_envio": {
        "Borrador", "Pendiente", "Procesando", "Completado", "Error",
    },
    "estado_edicion": {
        "Planificada", "Prelanzamiento", "Abierta", "Finalizada",
    },
    "tipo_email": {
        "disculpa", "informacion", "recordatorio", "seguimiento", "bienvenida",
        "felicitacion", "urgente",
        "seguimiento_frio", "recuperacion_pago", "recordatorio_pago", "libre",
    },
    # 'Español' is normalized to 'Espanol' before validation (see
    # normalize_value); 'Espanol' is the single canonical ENUM value.
    "idioma_tipo": {"Espanol", "Ingles"},
    "origen_evento": {
        "Manual", "Automatico", "Webhook", "API", "Workflow Automatico",
        "Sistema",
    },
    "origen_email": {"manual_template", "manual_quick", "Automatico", "Manual"},
    # CHECK-constraint columns (not PG enums) — validated like enums so the
    # dry-run catches values the DB CHECK would reject:
    "clasificacion_importancia": {"Alta", "Media", "Baja"},
    "moneda": {"EUR", "USD", "MXN"},
    "direccion_email": {"Recibido", "Enviado"},
    "estado_inbox": {
        "Nuevo", "Leido", "Respondido", "Archivado", "Eliminado",
    },
}


# ------------------------------------------------------------------
# Column specs per target table — derived from schema.sql CREATE TABLE blocks.
# enum: ENUM_VALUES key to validate against; not_null: column is NOT NULL;
# kind: 'text'|'int'|'numeric'|'bool'|'date'|'timestamptz'|'text[]'|'uuid';
# fk: parent table whose recId map resolves this column (Airtable link field).
# Only columns we actually populate from Airtable are listed; server defaults
# (id, created_at, updated_at) are intentionally omitted.
# ------------------------------------------------------------------
@dataclass
class ColSpec:
    """Validation metadata for a single target Postgres column."""

    kind: str = "text"
    enum: str | None = None
    not_null: bool = False
    fk: str | None = None
    # self_fk: this FK references the *same* table being loaded, so the parent
    # row may not exist yet during the first pass. It is skipped by first-pass
    # FK resolution + unresolved-link validation and resolved by a post-load
    # backfill (see backfill_self_fks).
    self_fk: bool = False


# table -> {column: ColSpec}
TABLE_COLUMNS: dict[str, dict[str, ColSpec]] = {
    "ediciones": {
        "nombre": ColSpec(kind="text", not_null=True),
        "estado": ColSpec(kind="text", enum="estado_edicion"),
        "es_edicion_activa": ColSpec(kind="bool"),
        "fecha_inicio_inscripcion": ColSpec(kind="date"),
        "fecha_fin_inscripcion": ColSpec(kind="date"),
        "fecha_inicio_curso": ColSpec(kind="date"),
        "fecha_fin_curso": ColSpec(kind="date"),
        "modulos_disponibles": ColSpec(kind="text[]"),
        "fecha_inicio_prelanzamiento": ColSpec(kind="date"),
        # schema.sql JSONB; the source is Airtable richText holding a JSON
        # string, so we pass it through as text (the DB casts text->jsonb).
        "plazos_revision": ColSpec(kind="text"),
    },
    "modulos": {
        "modulo_id": ColSpec(kind="text", not_null=True),
        "nombre": ColSpec(kind="text", not_null=True),
        "precio_online": ColSpec(kind="numeric"),
        "precio_efectivo": ColSpec(kind="numeric"),
        "activo": ColSpec(kind="bool"),
        "capacidad": ColSpec(kind="int"),
        "reserva_prelanzamiento_plazas": ColSpec(kind="int"),
    },
    "alumnos": {
        "nombre": ColSpec(kind="text", not_null=True),
        "email": ColSpec(kind="text", not_null=True),
        "telefono": ColSpec(kind="text"),
        "estado_general": ColSpec(kind="text", enum="estado_general"),
        "idioma": ColSpec(kind="text", enum="idioma_tipo"),
        "modulo_solicitado": ColSpec(kind="text"),
        "modulos_completados": ColSpec(kind="text[]"),
        "modules": ColSpec(kind="text[]"),
        "edicion_id": ColSpec(kind="uuid", fk="ediciones"),
        "foto_perfil": ColSpec(kind="text"),
        "plazo_revision": ColSpec(kind="text"),  # Airtable label, not a date
        "fecha_plazo": ColSpec(kind="date"),
        "fecha_preinscripcion": ColSpec(kind="date"),
        "modulo_reserva": ColSpec(kind="text"),
        "fecha_entrada_reserva": ColSpec(kind="date"),
        "engagement_score": ColSpec(kind="numeric"),
        "resumen_feedback_ia": ColSpec(kind="text"),
        "siguiente_accion_ia": ColSpec(kind="text"),
        "notas_internas": ColSpec(kind="text"),
        "admin_responsable": ColSpec(kind="text"),
        "pareja_email": ColSpec(kind="text"),
        "onboarding_enviado": ColSpec(kind="bool"),
        "bloqueado_proev26": ColSpec(kind="bool"),
        "disculpa_enviada": ColSpec(kind="bool"),
        "prelanzamiento_enviado": ColSpec(kind="bool"),
        "followup_prelanzamiento": ColSpec(kind="int"),
        # Self-referential FK (alumno -> alumno). Cannot resolve in one pass
        # because the linked alumno may load later; handled by the post-load
        # backfill in run() (see backfill_self_fks), so self_fk=True excludes
        # it from the first-pass FK resolution + unresolved-link failures.
        "pareja_alumno_id": ColSpec(
            kind="uuid", fk="alumnos", self_fk=True,
        ),
    },
    "revisiones_video": {
        "alumno_id": ColSpec(kind="uuid", not_null=True, fk="alumnos"),
        "video_enviado": ColSpec(kind="text"),
        "redes_sociales": ColSpec(kind="text"),
        "usuarios_rrss": ColSpec(kind="text"),
        "estado_revision": ColSpec(kind="text", enum="estado_revision"),
        "puntuacion": ColSpec(kind="int"),
        "feedback": ColSpec(kind="text"),
        "revisor_responsable": ColSpec(kind="text"),
        "fecha_revision": ColSpec(kind="date"),
        "resumen_inteligente": ColSpec(kind="text"),
        "clasificacion_automatica": ColSpec(kind="text"),
        "email_alumno": ColSpec(kind="text"),
        "perfiles_rrss": ColSpec(kind="text"),
    },
    "pagos": {
        "alumno_id": ColSpec(kind="uuid", not_null=True, fk="alumnos"),
        "importe": ColSpec(kind="numeric"),
        "moneda": ColSpec(kind="text", enum="moneda"),
        "estado_pago": ColSpec(kind="text", enum="estado_pago"),
        "fecha_pago": ColSpec(kind="date"),
        "link_pago_stripe": ColSpec(kind="text"),
        "id_sesion_stripe": ColSpec(kind="text"),
        "link_recibo": ColSpec(kind="text"),
        "resumen_inteligente": ColSpec(kind="text"),
        "analisis_riesgo": ColSpec(kind="text"),
    },
    "envios_emails": {
        "tipo": ColSpec(kind="text", enum="tipo_email"),
        "mensaje": ColSpec(kind="text"),
        "descripcion": ColSpec(kind="text"),
        "estado": ColSpec(kind="text", enum="estado_envio"),
        "total_emails": ColSpec(kind="int"),
        "emails_creados": ColSpec(kind="int"),
        "fecha_completado": ColSpec(kind="date"),
    },
    "cola_emails": {
        "alumno_id": ColSpec(kind="uuid", fk="alumnos"),
        "alumno_nombre": ColSpec(kind="text"),
        "tipo": ColSpec(kind="text", enum="tipo_email"),
        "asunto": ColSpec(kind="text"),
        "asunto_generado": ColSpec(kind="text"),
        "email_generado": ColSpec(kind="text"),
        "mensaje": ColSpec(kind="text"),
        "estado": ColSpec(kind="text", enum="estado_email"),
        "origen": ColSpec(kind="text", enum="origen_email"),
        "descripcion": ColSpec(kind="text"),
        "fecha_envio": ColSpec(kind="date"),
        "reprogramado": ColSpec(kind="bool"),
        "ultimo_reproceso": ColSpec(kind="timestamptz"),
    },
    "inbox": {
        "de": ColSpec(kind="text"),
        "para": ColSpec(kind="text"),
        "asunto": ColSpec(kind="text"),
        "fecha": ColSpec(kind="timestamptz"),
        "contenido": ColSpec(kind="text"),
        "contenido_html": ColSpec(kind="text"),
        "message_id": ColSpec(kind="text"),
        "thread_id": ColSpec(kind="text"),
        "direccion": ColSpec(kind="text", enum="direccion_email"),
        "estado": ColSpec(kind="text", enum="estado_inbox"),
        "origen": ColSpec(kind="text", enum="origen_email"),
        "alumno_id": ColSpec(kind="uuid", fk="alumnos"),
        "resumen_ia": ColSpec(kind="text"),
        "tipo_consulta": ColSpec(kind="text"),
        "requiere_atencion": ColSpec(kind="bool"),
        "respuesta_sugerida": ColSpec(kind="text"),
        "respuesta_final": ColSpec(kind="text"),
        "respuesta_enviada": ColSpec(kind="bool"),
        "fecha_apertura": ColSpec(kind="timestamptz"),
        "gmail_leido": ColSpec(kind="bool"),
        "gmail_eliminado": ColSpec(kind="bool"),
    },
    "historial": {
        "alumno_id": ColSpec(kind="uuid", fk="alumnos"),
        "descripcion": ColSpec(kind="text"),
        "tipo_accion": ColSpec(kind="text"),
        "origen_evento": ColSpec(kind="text", enum="origen_evento"),
        "error_log": ColSpec(kind="text"),
        "workflow": ColSpec(kind="text"),
        "resumen_automatico": ColSpec(kind="text"),
        "clasificacion_importancia": ColSpec(kind="text", enum="clasificacion_importancia"),
    },
}


# FK-safe load order (parents before children) — from the task spec, aligned to
# the actual schema table names (revisiones_video, historial).
LOAD_ORDER: list[str] = [
    "ediciones",
    "modulos",
    "alumnos",
    "revisiones_video",
    "pagos",
    "envios_emails",
    "cola_emails",
    "inbox",
    "historial",
]


# Tables that are legitimately allowed to come back EMPTY from Airtable. For any
# other table an empty fetch is treated as a transient failure and prune is
# skipped (a bad/partial fetch must never wipe Supabase). envios_emails is the
# only known table that is routinely empty in the live base.
PRUNE_KNOWN_EMPTY_ALLOWLIST: frozenset[str] = frozenset({"envios_emails"})

# Default fraction of the current Supabase row count above which a prune is
# refused unless --prune-force is passed (see compute_prune_ids).
DEFAULT_PRUNE_THRESHOLD = 0.25

# Fetch-completeness floor: if the Airtable fetch returns FEWER than this
# fraction of the rows currently in Supabase, the fetch is presumed incomplete
# (truncated page / transient failure) and prune is REFUSED for that table —
# pruning against a partial fetch would silently delete live rows. This is the
# SAME safety tier as the empty-fetch guard (empty is just the ratio==0 case):
# it is INDEPENDENT of --prune-threshold and NOT bypassable by --prune-force.
PRUNE_MIN_FETCH_RATIO = 0.9

# The completeness floor only applies to tables large enough that a paginated
# fetch could PARTIALLY truncate. Airtable returns up to 100 rows/page, so a
# table whose row count fits in a single page (<= 100) cannot be partially
# truncated — a low fetch ratio there means real deletions, not a lost page.
# Below this size the floor is skipped and the (force-bypassable) threshold
# guard governs, so a single legitimate deletion on a small table (e.g. the
# 7-row `pagos`) can still be pruned. Matches the fetch pageSize in
# fetch_airtable_records.
PRUNE_FLOOR_MIN_ROWS = 100

# CASCADE relationships from dashboard/supabase/schema.sql: parent table -> the
# child tables whose FK to it is declared `ON DELETE CASCADE` (deleting a parent
# row silently cascade-deletes the children). Verified against schema.sql: ONLY
# alumnos -> revisiones_video and alumnos -> pagos are CASCADE; every other FK is
# SET NULL or RESTRICT, so it cannot silently destroy child rows. Used to refuse
# a SUBSET prune of a parent when a CASCADE child is NOT in the selected --tables
# set (otherwise those children get cascade-deleted with no candidate accounting).
CASCADE_CHILDREN: dict[str, list[str]] = {
    "alumnos": ["revisiones_video", "pagos"],
}


# ------------------------------------------------------------------
# Prune decision — PURE function (no DB, no network). Single source of truth for
# WHICH Supabase rows are deletable after a successful Airtable fetch, plus all
# safety guards. Shared by run() (real prune) and _self_test() (offline unit
# test) so the test exercises the real decision logic.
# ------------------------------------------------------------------
def compute_prune_ids(
    table: str,
    supabase_ids: set[str],
    airtable_ids: set[str],
    threshold: float = DEFAULT_PRUNE_THRESHOLD,
    force: bool = False,
    selected_tables: set[str] | None = None,
) -> tuple[set[str], str | None]:
    """Decide which Supabase ``airtable_id`` values are stale and prunable.

    Stale = present in Supabase but absent from the Airtable set fetched this
    run. Returns ``(ids_to_delete, skip_reason)``. When ``skip_reason`` is not
    None the prune is refused and ``ids_to_delete`` is empty.

    ``selected_tables`` is the full set of tables being processed this run (used
    only for the CASCADE-subset guard below). When None the guard is inactive
    (treated as a full-table run).

    Safety guards (a bad/partial Airtable fetch must NOT wipe Supabase):
      * Empty-fetch guard: if ``airtable_ids`` is empty AND ``table`` is not in
        ``PRUNE_KNOWN_EMPTY_ALLOWLIST``, return ([], reason) — an empty fetch is
        treated as a likely transient failure. NOT bypassable by ``force``.
      * CASCADE-subset guard: if this run is a SUBSET of all tables and a
        CASCADE child of ``table`` (see ``CASCADE_CHILDREN``) is NOT selected,
        refuse — deleting parent rows would silently cascade-delete unaccounted
        child rows. Checked before the floor (a structural refusal that holds
        regardless of fetch size). NOT bypassable by ``force``.
      * Fetch-completeness floor: for tables LARGER than
        ``PRUNE_FLOOR_MIN_ROWS`` (a paginated fetch could partially truncate),
        if the fetch returned fewer than ``PRUNE_MIN_FETCH_RATIO`` of the
        current Supabase rows, the fetch looks truncated; return ([], reason).
        Same tier as the empty-fetch guard (empty is the ratio==0 case):
        INDEPENDENT of ``threshold`` and NOT bypassable by ``force``. Tables at
        or below ``PRUNE_FLOOR_MIN_ROWS`` (single Airtable page) skip this floor
        — a low ratio there means real deletions, so the (force-bypassable)
        threshold guard governs and one legitimate deletion can be pruned. The
        known-empty allowlist also skips this floor.
      * Threshold guard: if the number of stale rows exceeds ``threshold`` of
        the current Supabase row count, return ([], reason) unless ``force`` is
        True. Bypass with ``--prune-force``.

    Guard order: empty-fetch -> CASCADE-subset -> completeness-floor ->
    threshold (the first three are hard refusals; only the last honors force).
    """
    stale = supabase_ids - airtable_ids
    if not airtable_ids and table not in PRUNE_KNOWN_EMPTY_ALLOWLIST:
        return set(), "empty fetch — likely transient failure, skipping prune"
    # CASCADE-subset guard: on a partial-table run, refuse to prune a parent
    # whose ON DELETE CASCADE children are not all in the selected set — those
    # children would be silently cascade-deleted with no candidate accounting.
    # Same hard tier as the empty/incomplete guards (not bypassable by force).
    if selected_tables is not None and table in CASCADE_CHILDREN:
        missing_children = [
            child for child in CASCADE_CHILDREN[table]
            if child not in selected_tables
        ]
        if missing_children:
            return set(), (
                f"CASCADE child(ren) {', '.join(missing_children)} not in "
                f"--tables — pruning '{table}' would silently cascade-delete "
                f"them; add them to --tables (not bypassable by --prune-force)"
            )
    # Fetch-completeness floor: a fetch that returned far fewer rows than
    # Supabase holds is presumed truncated. Refuse prune regardless of force /
    # threshold (same hard tier as the empty-fetch guard). Allowlisted
    # known-empty tables are exempt (handled by the empty-fetch guard above).
    if (
        len(supabase_ids) > PRUNE_FLOOR_MIN_ROWS
        and table not in PRUNE_KNOWN_EMPTY_ALLOWLIST
        and len(airtable_ids) < PRUNE_MIN_FETCH_RATIO * len(supabase_ids)
    ):
        pct = len(airtable_ids) / len(supabase_ids)
        return set(), (
            f"fetch looks incomplete — Airtable returned {pct * 100:.0f}% of "
            f"Supabase rows (< {PRUNE_MIN_FETCH_RATIO * 100:.0f}% floor), "
            f"skipping prune (not bypassable by --prune-force)"
        )
    if not stale:
        return set(), None
    if not force and supabase_ids:
        pct = len(stale) / len(supabase_ids)
        if pct > threshold:
            return set(), (
                f"exceeds safety threshold {pct * 100:.0f}% "
                f"(> {threshold * 100:.0f}%) — use --prune-force"
            )
    return stale, None


# ------------------------------------------------------------------
# Value normalizations — from MIGRACION-PARITY-SCHEMA.md.
# ------------------------------------------------------------------
def normalize_value(table: str, column: str, value: Any) -> Any:
    """Apply documented value normalizations before validation.

    * estado_pago: legacy 'Pagado' -> 'Completado' (Pagado is not a live
      Airtable choice; schema.sql keeps it only for back-compat).
    * idioma: 'Español' -> 'Espanol' (canonical ASCII value; both are valid in
      the ENUM but we normalize to the legacy ASCII form).
    """
    if value is None:
        return None
    if column == "estado_pago" and value == "Pagado":
        return "Completado"
    if column == "idioma" and value == "Español":
        return "Espanol"
    if column == "origen_evento" and value == "Automático":
        return "Automatico"
    return value


# ------------------------------------------------------------------
# Type coercion + validation
# ------------------------------------------------------------------
def _first(value: Any) -> Any:
    """Airtable linked/lookup fields often arrive as single-item lists."""
    if isinstance(value, list):
        return value[0] if value else None
    return value


def coerce_value(spec: ColSpec, value: Any) -> tuple[Any, str | None]:
    """Coerce a raw Airtable value to the column's Postgres kind.

    Returns (coerced_value, error). error is None on success. Coercion never
    raises; type problems are returned as a reason string.
    """
    if value is None or value == "":
        return None, None
    # Airtable computed-field error/special objects (e.g. {'state':'error',
    # 'errorType':'emptyDependency'}) arrive as dicts; treat them as empty.
    if isinstance(_first(value), dict):
        return None, None

    kind = spec.kind
    try:
        if kind == "text":
            return str(_first(value)), None
        if kind == "uuid":
            # FK values are resolved separately; passthrough here.
            return value, None
        if kind == "int":
            return int(float(_first(value))), None
        if kind == "numeric":
            return float(_first(value)), None
        if kind == "bool":
            v = _first(value)
            if isinstance(v, bool):
                return v, None
            if isinstance(v, str):
                return v.strip().lower() in ("true", "1", "yes", "si", "sí"), None
            return bool(v), None
        if kind == "date":
            s = str(_first(value))
            try:
                return datetime.date.fromisoformat(s[:10]).isoformat(), None
            except ValueError:
                return None, f"not a valid date: {s!r}"
        if kind == "timestamptz":
            s = str(_first(value))
            try:
                datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
                return s, None
            except ValueError:
                return None, f"not a valid timestamp: {s!r}"
        if kind == "text[]":
            if isinstance(value, list):
                return [str(x) for x in value], None
            return [str(value)], None
    except (TypeError, ValueError) as exc:
        return None, f"type coercion failed for {kind}: {exc!r}"
    return value, None


def validate_record(
    table: str,
    columns: dict[str, ColSpec],
    mapped: dict[str, Any],
) -> list[str]:
    """Validate an already-mapped record against ENUM / NOT NULL / type rules.

    `mapped` is produced by map_record, which has ALREADY normalized + coerced
    each value to the column's Postgres kind. We re-run coerce_value here as an
    idempotent safety net (str(scalar)==scalar, float(num)==num, uuid is
    passthrough) so any value that cannot be coerced is reported rather than
    silently loaded. FK columns are validated for presence only; the
    recId->UUID resolution happens at load.
    """
    failures: list[str] = []
    for column, spec in columns.items():
        raw = mapped.get(column)
        coerced, coerce_err = coerce_value(spec, raw)
        if coerce_err is not None:
            failures.append(f"{column}: {coerce_err}")
            continue
        if spec.not_null and coerced is None:
            failures.append(f"{column}: NOT NULL violated (value is empty)")
            continue
        if spec.enum and coerced is not None:
            allowed = ENUM_VALUES[spec.enum]
            if coerced not in allowed:
                failures.append(
                    f"{column}: '{coerced}' not in ENUM {spec.enum}"
                )
    return failures


def map_record(table: str, raw_fields: dict[str, Any]) -> dict[str, Any]:
    """Map one Airtable record's fields to load-ready target column values.

    Only fields present in FIELD_MAP and relevant to this table are kept. For
    each kept field we (1) apply documented value-maps (normalize_value, e.g.
    Pagado->Completado, Español->Espanol) and then (2) coerce to the column's
    Postgres kind via coerce_value. Coercion runs at the SOURCE so the returned
    dict already holds load-ready scalars: Airtable lookup fields (e.g. Alumnos
    Nombre/Email arrive as ['Juan']) are flattened to the scalar the text/scalar
    column expects, instead of leaking a list into load_table.

    Order matters: normalize_value first (its value-maps operate on the raw
    Airtable value), then coerce_value to land the correct Postgres type.

    FK / uuid columns are intentionally left as the RAW Airtable link (typically
    a single-item list of record ids): load_table and backfill_self_fks resolve
    those links via _first(), so the list must survive here. coerce_value's uuid
    branch is a passthrough, so this is preserved automatically. On a coercion
    error the raw (normalized) value is kept so validate_record reports it.
    """
    columns = TABLE_COLUMNS[table]
    mapped: dict[str, Any] = {}
    for at_field, value in raw_fields.items():
        col = FIELD_MAP.get(at_field)
        if col is None or col not in columns:
            continue
        normalized = normalize_value(table, col, value)
        coerced, coerce_err = coerce_value(columns[col], normalized)
        # Keep the (normalized) raw value on coercion failure so validate_record
        # surfaces the same coerce_err; otherwise store the load-ready value.
        mapped[col] = normalized if coerce_err is not None else coerced
    return mapped


# ------------------------------------------------------------------
# Per-table accumulated result
# ------------------------------------------------------------------
@dataclass
class TableResult:
    """Counters + failure details for one table's migration pass."""

    table: str
    fetched: int = 0
    mapped_ok: int = 0
    failures: list[tuple[str, list[str]]] = dc_field(default_factory=list)

    @property
    def failed(self) -> int:
        return len(self.failures)


@dataclass
class PruneResult:
    """Per-table outcome of a prune pass (report + stdout)."""

    table: str
    supabase_count: int = 0
    airtable_count: int = 0
    candidates: int = 0  # stale rows that WOULD be pruned (pre-guard)
    deleted: int = 0  # rows actually deleted (0 in dry-run / when skipped)
    skip_reason: str | None = None


# ------------------------------------------------------------------
# Airtable source (guarded — only used for a live fetch)
# ------------------------------------------------------------------
class RateLimiter:
    """Simple spacing limiter to stay at or below N requests/second."""

    def __init__(self, per_second: int) -> None:
        self._min_interval = 1.0 / per_second if per_second > 0 else 0.0
        self._last = 0.0

    def wait(self) -> None:
        if self._min_interval <= 0:
            return
        elapsed = time.monotonic() - self._last
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last = time.monotonic()


def fetch_airtable_records(
    base_id: str,
    table_id: str,
    pat: str,
    limiter: RateLimiter,
) -> list[dict[str, Any]]:
    """Fetch all records for a table, paginating via Airtable's offset cursor.

    Raises RuntimeError if the `requests` package is unavailable.
    """
    if requests is None:
        raise RuntimeError(
            "the 'requests' package is required for a live fetch; install it "
            "or use --dry-run with mock fixtures"
        )
    url = f"{AIRTABLE_API_ROOT}/{base_id}/{table_id}"
    headers = {"Authorization": f"Bearer {pat}"}
    records: list[dict[str, Any]] = []
    offset: str | None = None
    while True:
        limiter.wait()
        params: dict[str, str] = {"pageSize": "100"}
        if offset:
            params["offset"] = offset
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        payload = resp.json()
        records.extend(payload.get("records", []))
        offset = payload.get("offset")
        if not offset:
            break
    return records


# ------------------------------------------------------------------
# Postgres target (guarded — only used with --load)
# ------------------------------------------------------------------
def build_insert_tuple(
    row: dict[str, Any],
    columns: dict[str, ColSpec],
    recid_to_pk: dict[str, str],
    new_id: str,
) -> tuple[tuple[Any, ...] | None, list[str]]:
    """Build one (id, airtable_id, *col_values) INSERT tuple for ``row``.

    PURE function (no DB): this is the single source of truth for how a mapped
    row becomes an insert tuple, shared by load_table AND the self-test so the
    test exercises the real code path (a self-test that merely mirrored this
    logic let the self-FK bug slip through earlier).

    Rules:
      * Self-referential FK columns (``self_fk=True``) are forced to None on the
        initial INSERT; the raw link survives on ``row`` for backfill_self_fks.
      * Non-self FK columns resolve their Airtable link id (via _first) to the
        parent UUID in ``recid_to_pk``. A link present but unresolved is a
        validation failure → returns (None, [reasons]) so the caller excludes
        the row.
      * All other columns pass through the already-coerced mapped value.

    Returns (insert_tuple, unresolved). On success ``unresolved`` is empty and
    ``insert_tuple`` is non-None; on an unresolved FK ``insert_tuple`` is None.
    """
    fk_cols = {
        c: spec.fk for c, spec in columns.items()
        if spec.fk and not spec.self_fk
    }
    self_fk_cols = {c for c, spec in columns.items() if spec.self_fk}
    rec_id = row.get("__rec_id")
    unresolved: list[str] = []
    record_values: list[Any] = [new_id, rec_id]
    for col in columns:
        val = row.get(col)
        if col in self_fk_cols:
            # Always NULL on initial INSERT; backfilled post-load from the raw
            # link still held on the original row dict.
            val = None
        elif col in fk_cols and val is not None:
            parent_rec = _first(val)
            resolved = recid_to_pk.get(parent_rec)
            if parent_rec is not None and resolved is None:
                unresolved.append(f"unresolved FK link {col} -> {parent_rec}")
            val = resolved
        record_values.append(val)
    if unresolved:
        return None, unresolved
    return tuple(record_values), unresolved


def load_table(
    conn: Any,
    table: str,
    rows: list[dict[str, Any]],
    recid_to_pk: dict[str, str],
    columns: dict[str, ColSpec],
) -> list[tuple[str, list[str]]]:
    """Upsert mapped+validated rows into Postgres, resolving FK link ids.

    A provisional client-side UUID is generated for each row so child tables
    can resolve their FK columns even before the INSERT runs. FK columns hold
    Airtable link ids (lists) which are resolved to parent UUIDs here. Each row
    carries its Airtable record id into the `airtable_id TEXT UNIQUE` column,
    and the statement upserts with `ON CONFLICT (airtable_id) DO UPDATE SET ...`
    so --load is idempotent and re-runnable.

    Idempotency / FK correctness: the upsert uses `RETURNING airtable_id, id`
    and ``execute_values(..., fetch=True)``. On a re-run (or after a partial
    prior load) the DB keeps the OLD synthetic ``id`` for an existing
    ``airtable_id`` (id is excluded from the UPDATE SET), so the provisional
    UUID we generated is a throwaway. After execution we overwrite
    ``recid_to_pk[returned_airtable_id] = returned_id`` with the *persisted* id,
    so child tables loaded later resolve their FKs against the real id, not the
    throwaway one.

    Unresolved links: a non-self FK link that does not resolve to a known
    parent id is treated as a validation failure (the row is excluded from the
    insert batch). Self-referential FKs (``self_fk=True``, e.g.
    ``alumnos.pareja_alumno_id``) are left NULL here and resolved by the
    post-load backfill (see ``backfill_self_fks``).

    Returns a list of ``(rec_id, reasons)`` for rows excluded due to unresolved
    non-self FK links.
    """
    if psycopg2 is None or execute_values is None:
        raise RuntimeError(
            "the 'psycopg2' package is required for --load; install it or use "
            "--dry-run"
        )
    # Self-FK columns must be NULL on the initial INSERT: their parent row may
    # load later in the same table, so they cannot be resolved here. The raw
    # Airtable link survives on the original row dicts and is resolved by the
    # post-load backfill_self_fks pass. All per-row tuple building (self-FK
    # nulling, FK resolution, unresolved-link handling) lives in the shared
    # PURE helper build_insert_tuple, exercised by the self-test too.
    insert_cols = ["id", "airtable_id"] + list(columns.keys())
    values: list[tuple[Any, ...]] = []
    failures: list[tuple[str, list[str]]] = []
    for row in rows:
        new_id = str(uuid.uuid4())
        rec_id = row.get("__rec_id")
        insert_tuple, unresolved = build_insert_tuple(
            row, columns, recid_to_pk, new_id,
        )
        if unresolved:
            # Do NOT silently load a null relationship; flag + exclude the row.
            failures.append((rec_id or "<no-id>", unresolved))
            continue
        # Provisional map entry; corrected to the persisted id post-execute.
        if rec_id:
            recid_to_pk[rec_id] = new_id
        values.append(insert_tuple)

    if not values:
        return failures

    col_sql = ", ".join(insert_cols)
    # On conflict, refresh every column except the identity keys (id stays
    # stable so existing FK references keep resolving; airtable_id is the match
    # key). updated_at is bumped when the column exists on the table.
    update_targets = [c for c in columns if c != "airtable_id"]
    if "updated_at" not in update_targets and "updated_at" in columns:
        update_targets.append("updated_at")
    # Identifiers (table/column names) come from internal whitelists
    # (TABLE_COLUMNS), never user input, but are composed via psycopg2.sql so
    # they are properly quoted and the query is injection-safe by construction.
    # Row VALUES stay %s-bound through execute_values.
    set_sql = psql.SQL(", ").join(
        psql.SQL("{c} = EXCLUDED.{c}").format(c=psql.Identifier(c))
        for c in update_targets
    )
    upsert_sql = psql.SQL(
        "INSERT INTO {table} ({cols}) VALUES %s "
        "ON CONFLICT (airtable_id) DO UPDATE SET {set_clause} "
        "RETURNING airtable_id, id"
    ).format(
        table=psql.Identifier(table),
        cols=psql.SQL(", ").join(psql.Identifier(c) for c in insert_cols),
        set_clause=set_sql,
    )
    with conn.cursor() as cur:
        returned = execute_values(cur, upsert_sql, values, fetch=True)
    # Overwrite the provisional UUIDs with the persisted ids (the DB keeps the
    # old id on conflict), so later child tables resolve against the real id.
    for returned_airtable_id, returned_id in returned:
        if returned_airtable_id is not None:
            recid_to_pk[returned_airtable_id] = str(returned_id)
    conn.commit()
    return failures


def backfill_self_fks(
    conn: Any,
    table: str,
    rows: list[dict[str, Any]],
    recid_to_pk: dict[str, str],
    columns: dict[str, ColSpec],
) -> None:
    """Resolve self-referential FK columns after the table is fully loaded.

    A self-FK (e.g. ``alumnos.pareja_alumno_id``) cannot be resolved in the
    first pass because the linked row may load later in the same table. Once
    every row is loaded and ``recid_to_pk`` is fully populated, this UPDATEs
    each row's self-FK column to the resolved parent UUID. Unresolvable links
    are left NULL (the parent record is absent from the migration set).
    """
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is required for backfill_self_fks")
    self_fk_cols = [c for c, spec in columns.items() if spec.self_fk]
    if not self_fk_cols:
        return
    with conn.cursor() as cur:
        for col in self_fk_cols:
            for row in rows:
                rec_id = row.get("__rec_id")
                link = row.get(col)
                if not rec_id or link is None:
                    continue
                parent_rec = _first(link)
                resolved = recid_to_pk.get(parent_rec) if parent_rec else None
                if resolved is None:
                    continue
                # table/col are internal whitelist identifiers (TABLE_COLUMNS),
                # composed via psycopg2.sql for safe quoting; values stay %s-bound.
                # psycopg2.sql.Identifier composition is injection-safe; the rule
                # below is SQLAlchemy-scoped and misfires on this canonical pattern.
                cur.execute(  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
                    psql.SQL(
                        "UPDATE {table} SET {col} = %s WHERE airtable_id = %s"
                    ).format(
                        table=psql.Identifier(table),
                        col=psql.Identifier(col),
                    ),
                    (resolved, rec_id),
                )
    conn.commit()


# ------------------------------------------------------------------
# Prune (one-way sync of DELETIONS) — guarded, only used with --prune.
# ------------------------------------------------------------------
def fetch_supabase_airtable_ids(conn: Any, table: str) -> set[str]:
    """Return the set of non-null ``airtable_id`` values currently in ``table``.

    table is an internal whitelist identifier (TABLE_COLUMNS), composed via
    psycopg2.sql for safe quoting.
    """
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is required for fetch_supabase_airtable_ids")
    query = psql.SQL(
        "SELECT airtable_id FROM {table} WHERE airtable_id IS NOT NULL"
    ).format(table=psql.Identifier(table))
    with conn.cursor() as cur:
        cur.execute(query)  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
        return {r[0] for r in cur.fetchall() if r[0] is not None}


def prune_table(
    conn: Any,
    table: str,
    ids_to_delete: set[str],
    columns: dict[str, ColSpec],
) -> int:
    """DELETE the given ``airtable_id`` rows from ``table`` (inside the txn).

    Self-referential FK columns are NULLed first so a parent row can be deleted
    in the same batch as its child without tripping the self-FK constraint
    (e.g. ``alumnos.pareja_alumno_id``, historial parent). The non-self FK load
    order is handled by the caller, which prunes in REVERSE LOAD_ORDER (children
    before parents). Returns the number of rows deleted.
    """
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is required for prune_table")
    if not ids_to_delete:
        return 0
    ids = list(ids_to_delete)
    self_fk_cols = [c for c, spec in columns.items() if spec.self_fk]
    with conn.cursor() as cur:
        # Break self-references first so the DELETE cannot violate the self-FK.
        for col in self_fk_cols:
            cur.execute(  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
                psql.SQL(
                    "UPDATE {table} SET {col} = NULL "
                    "WHERE airtable_id = ANY(%s)"
                ).format(
                    table=psql.Identifier(table),
                    col=psql.Identifier(col),
                ),
                (ids,),
            )
        cur.execute(  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
            psql.SQL(
                "DELETE FROM {table} WHERE airtable_id = ANY(%s)"
            ).format(table=psql.Identifier(table)),
            (ids,),
        )
        return cur.rowcount


# ------------------------------------------------------------------
# Report
# ------------------------------------------------------------------
def write_report(
    results: list[TableResult],
    path: str,
    dry_run: bool,
    prune_results: list[PruneResult] | None = None,
) -> None:
    """Write a per-table Markdown report of fetched / mapped-OK / failures."""
    mode = "DRY-RUN (no DB writes)" if dry_run else "LOAD"
    total_fetched = sum(r.fetched for r in results)
    total_ok = sum(r.mapped_ok for r in results)
    total_failed = sum(r.failed for r in results)
    lines: list[str] = [
        "# ProEv Airtable -> Supabase data migration report",
        "",
        f"- Mode: **{mode}**",
        f"- Tables processed: {len(results)}",
        f"- Total fetched: {total_fetched}",
        f"- Total mapped OK: {total_ok}",
        f"- Total failures: {total_failed}",
        "",
        "## Per-table results",
        "",
        "| Table | Fetched | Mapped OK | Failures |",
        "| --- | ---: | ---: | ---: |",
    ]
    for r in results:
        lines.append(
            f"| {r.table} | {r.fetched} | {r.mapped_ok} | {r.failed} |"
        )
    lines.append("")
    for r in results:
        if not r.failures:
            continue
        lines.append(f"## Failures — {r.table}")
        lines.append("")
        for rec_id, reasons in r.failures:
            lines.append(f"- `{rec_id}`: {'; '.join(reasons)}")
        lines.append("")

    if prune_results:
        prune_mode = "WOULD PRUNE (dry-run)" if dry_run else "PRUNED"
        total_candidates = sum(p.candidates for p in prune_results)
        total_deleted = sum(p.deleted for p in prune_results)
        lines.append("## Prune (one-way deletion sync)")
        lines.append("")
        lines.append(f"- Mode: **{prune_mode}**")
        lines.append(f"- Total candidates: {total_candidates}")
        lines.append(f"- Total deleted: {total_deleted}")
        lines.append("")
        lines.append(
            "| Table | Supabase | Airtable | Candidates | Deleted | Skip reason |"
        )
        lines.append("| --- | ---: | ---: | ---: | ---: | --- |")
        for p in prune_results:
            lines.append(
                f"| {p.table} | {p.supabase_count} | {p.airtable_count} | "
                f"{p.candidates} | {p.deleted} | {p.skip_reason or ''} |"
            )
        lines.append("")

    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


# ------------------------------------------------------------------
# Core pass
# ------------------------------------------------------------------
def process_table(
    table: str,
    records: list[dict[str, Any]],
) -> tuple[TableResult, list[dict[str, Any]]]:
    """Map + validate every record. Returns (result, valid_rows_for_load)."""
    columns = TABLE_COLUMNS[table]
    result = TableResult(table=table, fetched=len(records))
    valid_rows: list[dict[str, Any]] = []
    for rec in records:
        rec_id = rec.get("id", "<no-id>")
        mapped = map_record(table, rec.get("fields", {}))
        failures = validate_record(table, columns, mapped)
        if failures:
            result.failures.append((rec_id, failures))
            continue
        result.mapped_ok += 1
        mapped["__rec_id"] = rec_id
        valid_rows.append(mapped)
    return result, valid_rows


def _prune_pass(
    conn: Any,
    tables: list[str],
    airtable_ids_by_table: dict[str, set[str]],
    dry_run: bool,
    threshold: float,
    force: bool,
) -> list[PruneResult]:
    """Compute (and, when not dry-run, apply) deletions of stale Supabase rows.

    For each table the fetched Airtable ``airtable_id`` set is compared with the
    current Supabase set; compute_prune_ids applies the safety guards. Deletes
    run in REVERSE LOAD_ORDER (children before parents) so non-self FK
    constraints don't trip; self-FKs are NULLed inside prune_table. All deletes
    share the caller's open transaction (committed by the caller on --load).
    """
    prune_results: list[PruneResult] = []
    decisions: dict[str, tuple[set[str], PruneResult]] = {}
    # Full set of tables this run touches — drives the CASCADE-subset guard. A
    # run that names every table cannot orphan/cascade-delete a non-selected
    # child, so the guard only bites on a genuine subset.
    selected = {t for t in tables if t in TABLE_COLUMNS}
    # Decide per table (guards included) using the live Supabase id sets.
    for table in tables:
        if table not in TABLE_COLUMNS:
            continue
        airtable_ids = airtable_ids_by_table.get(table, set())
        supabase_ids = fetch_supabase_airtable_ids(conn, table)
        ids_to_delete, skip_reason = compute_prune_ids(
            table, supabase_ids, airtable_ids, threshold, force,
            selected_tables=selected,
        )
        pr = PruneResult(
            table=table,
            supabase_count=len(supabase_ids),
            airtable_count=len(airtable_ids),
            candidates=len(supabase_ids - airtable_ids),
            skip_reason=skip_reason,
        )
        decisions[table] = (ids_to_delete, pr)
        if skip_reason:
            print(f"[prune] {table}: SKIP — {skip_reason}")
        else:
            verb = "would prune" if dry_run else "pruning"
            print(f"[prune] {table}: {verb} {len(ids_to_delete)} stale row(s)")
    # Apply deletions in REVERSE FK order so children go before parents.
    if not dry_run:
        for table in reversed(LOAD_ORDER):
            if table not in decisions:
                continue
            ids_to_delete, pr = decisions[table]
            if ids_to_delete:
                pr.deleted = prune_table(
                    conn, table, ids_to_delete, TABLE_COLUMNS[table],
                )
    # Preserve the requested table order in the report.
    for table in tables:
        if table in decisions:
            prune_results.append(decisions[table][1])
    return prune_results


def run(
    tables: list[str],
    dry_run: bool,
    report_path: str,
    base_id: str,
    pat: str | None,
    db_url: str | None,
    records_provider: Callable[[str], list[dict[str, Any]]] | None = None,
    prune: bool = False,
    prune_force: bool = False,
    prune_threshold: float = DEFAULT_PRUNE_THRESHOLD,
) -> int:
    """Run the migration pass over the selected tables.

    `records_provider` allows the self-test to inject mock fixtures; when None,
    records are fetched live from Airtable.

    When ``prune`` is True the run also reconciles DELETIONS: rows in Supabase
    whose ``airtable_id`` no longer exists in the Airtable set fetched this run
    are reported (dry-run) or deleted (--load), subject to compute_prune_ids'
    safety guards. Pruning always needs the DB to read current Supabase ids, so
    --dry-run --prune still opens a (read-only) connection when SUPABASE_DB_URL
    is set; if it is not, the prune is skipped with a clear message.
    """
    limiter = RateLimiter(MAX_REQUESTS_PER_SECOND)
    results: list[TableResult] = []
    valid_by_table: dict[str, list[dict[str, Any]]] = {}
    # airtable_id set actually fetched this run, per table — the prune universe.
    airtable_ids_by_table: dict[str, set[str]] = {}

    for table in tables:
        if table not in TABLE_COLUMNS:
            print(f"[warn] unknown table '{table}', skipping")
            continue
        if records_provider is not None:
            records = records_provider(table)
        else:
            if pat is None:
                print("[error] AIRTABLE_PAT not set; cannot fetch live data")
                return 2
            table_id = AIRTABLE_TABLES[table]
            records = fetch_airtable_records(base_id, table_id, pat, limiter)
        airtable_ids_by_table[table] = {
            rec["id"] for rec in records if rec.get("id")
        }
        result, valid_rows = process_table(table, records)
        results.append(result)
        valid_by_table[table] = valid_rows

    prune_results: list[PruneResult] | None = None

    if not dry_run:
        if db_url is None:
            print("[error] SUPABASE_DB_URL not set; cannot --load")
            return 2
        if psycopg2 is None:
            print("[error] psycopg2 not installed; cannot --load")
            return 2
        results_by_table = {r.table: r for r in results}
        conn = psycopg2.connect(db_url)
        try:
            recid_to_pk: dict[str, str] = {}
            # Pass 1: load each table in FK-safe order. Unresolved non-self FK
            # links are reported as failures and their rows excluded.
            for table in LOAD_ORDER:
                if table not in valid_by_table:
                    continue
                fk_failures = load_table(
                    conn,
                    table,
                    valid_by_table[table],
                    recid_to_pk,
                    TABLE_COLUMNS[table],
                )
                if fk_failures:
                    res = results_by_table.get(table)
                    if res is not None:
                        res.failures.extend(fk_failures)
                        res.mapped_ok -= len(fk_failures)
            # Pass 2: backfill self-referential FKs now that recid_to_pk is
            # fully populated (e.g. alumnos.pareja_alumno_id).
            for table in LOAD_ORDER:
                if table not in valid_by_table:
                    continue
                backfill_self_fks(
                    conn,
                    table,
                    valid_by_table[table],
                    recid_to_pk,
                    TABLE_COLUMNS[table],
                )
            # Pass 3: prune stale rows. NOTE: this is NOT atomic with the loads
            # above — load_table and backfill_self_fks each commit per-table
            # (idempotent incremental upserts), so by the time we reach here the
            # loads are already durable. Prune is a SEPARATE step: its deletes
            # accumulate on this connection and are committed once at the end
            # (the conn.commit() after this block), so the prune itself is
            # atomic, but it does NOT roll back the already-committed loads.
            if prune:
                prune_results = _prune_pass(
                    conn, tables, airtable_ids_by_table, dry_run=False,
                    threshold=prune_threshold, force=prune_force,
                )
                conn.commit()
        finally:
            conn.close()
    elif prune:
        # Dry-run prune: report only. Still needs the DB to read current ids.
        if db_url is None:
            print("[prune] SUPABASE_DB_URL not set; skipping prune report")
        elif psycopg2 is None:
            print("[prune] psycopg2 not installed; skipping prune report")
        else:
            conn = psycopg2.connect(db_url)
            try:
                prune_results = _prune_pass(
                    conn, tables, airtable_ids_by_table, dry_run=True,
                    threshold=prune_threshold, force=prune_force,
                )
            finally:
                conn.rollback()
                conn.close()

    write_report(results, report_path, dry_run, prune_results)

    total_fetched = sum(r.fetched for r in results)
    total_ok = sum(r.mapped_ok for r in results)
    total_failed = sum(r.failed for r in results)
    print("=" * 50)
    print(f"Mode      : {'DRY-RUN' if dry_run else 'LOAD'}")
    print(f"Tables    : {len(results)}")
    print(f"Fetched   : {total_fetched} | Mapped OK: {total_ok} | "
          f"Failed: {total_failed}")
    if prune_results is not None:
        total_candidates = sum(p.candidates for p in prune_results)
        total_deleted = sum(p.deleted for p in prune_results)
        prune_verb = "Would prune" if dry_run else "Deleted"
        print(f"Prune     : candidates {total_candidates} | "
              f"{prune_verb} {total_deleted}")
    print(f"Report    : {report_path}")
    return 1 if total_failed else 0


# ------------------------------------------------------------------
# Self-test (mock fixtures, dry-run path only)
# ------------------------------------------------------------------
def _self_test() -> int:
    """Exercise map -> validate -> report with mock fixtures (no network/DB).

    Builds fixtures for ediciones, alumnos and pagos. One alumno row carries a
    bad enum and one carries a linked (edicion) field; the report must capture
    the bad-enum failure and the rest must map OK.
    """
    fixtures: dict[str, list[dict[str, Any]]] = {
        "ediciones": [
            {"id": "recEDI1", "fields": {
                "Estado": "Abierta",
                "Es Edicion Activa": True,
            }},
        ],
        "alumnos": [
            {"id": "recAL1", "fields": {
                # Lookup fields arrive as single-item LISTS from Airtable; they
                # must be coerced to scalars in `mapped` before load (Fix A).
                "Nombre": ["Ana Test"],
                "Email": ["ana@example.com"],
                "Idioma": "Español",            # normalized -> Espanol
                "Estado General": "Preinscrito",
                "Edicion": ["recEDI1"],          # linked field
                "Pareja (Link)": ["recAL2"],     # self-FK link (backfilled)
                "Pareja Email": "bob@example.com",
            }},
            {"id": "recAL2", "fields": {
                "Nombre": "Bad Enum",
                "Email": "bad@example.com",
                "Estado General": "NoExiste",    # bad enum -> failure
            }},
            {"id": "recAL3", "fields": {
                "Email": "missing-name@example.com",  # NOT NULL nombre -> fail
            }},
        ],
        "pagos": [
            {"id": "recPAY1", "fields": {
                "Alumno": ["recAL1"],            # linked FK field
                "Estado de Pago": "Pagado",      # legacy -> Completado (valid)
                "Importe": "49.90",
                "Moneda": "EUR",
            }},
        ],
        "inbox": [
            {"id": "recINB1", "fields": {
                "De": "alumno@example.com",
                "Para": "soporte@example.com",
                "Asunto": "Consulta",
                "Estado": "Respondido",          # estado_inbox enum
                "Origen": "Manual",              # origen_email (inbox side)
            }},
        ],
        "cola_emails": [
            {"id": "recCOLA1", "fields": {
                "Tipo": "informacion",
                "Asunto Generado": "Bienvenida",
                "Mensaje": "Hola",
                "Estado": "Enviado",             # estado_email enum
                "Origen": "manual_template",     # origen_email (cola side)
            }},
        ],
    }

    import tempfile
    report_path = os.path.join(tempfile.gettempdir(), "selftest_report.md")
    rc = run(
        tables=["ediciones", "alumnos", "pagos", "inbox", "cola_emails"],
        dry_run=True,
        report_path=report_path,
        base_id=AIRTABLE_BASE_ID_DEFAULT,
        pat=None,
        db_url=None,
        records_provider=lambda t: fixtures.get(t, []),
    )

    # Assertions
    al_result, _ = process_table("alumnos", fixtures["alumnos"])
    bad_caught = any(
        rec_id == "recAL2" and any("ENUM" in r for r in reasons)
        for rec_id, reasons in al_result.failures
    )
    notnull_caught = any(
        rec_id == "recAL3" and any("NOT NULL" in r for r in reasons)
        for rec_id, reasons in al_result.failures
    )
    pay_result, pay_rows = process_table("pagos", fixtures["pagos"])
    pago_normalized = bool(pay_rows) and pay_rows[0]["estado_pago"] == "Completado"
    report_exists = os.path.exists(report_path)

    # Self-FK mapping: recAL1's "Pareja (Link)" must map to pareja_alumno_id
    # (kind=uuid, self_fk=True) and survive validation (not flagged as a missing
    # FK, since self-FKs are resolved by the post-load backfill, not here).
    _, al_rows = process_table("alumnos", fixtures["alumnos"])
    al1 = next((r for r in al_rows if r.get("__rec_id") == "recAL1"), None)
    pareja_mapped = bool(al1) and al1.get("pareja_alumno_id") == ["recAL2"]
    self_fk_spec = TABLE_COLUMNS["alumnos"]["pareja_alumno_id"]
    self_fk_flagged = self_fk_spec.self_fk is True

    # Fix A guard: lookup-list fields (Nombre/Email arrive as ['Ana Test']) must
    # be coerced to SCALARS in the mapped row (not leaked as a list into load).
    nombre_coerced = bool(al1) and al1.get("nombre") == "Ana Test"
    email_coerced = bool(al1) and al1.get("email") == "ana@example.com"
    lookup_list_coerced = nombre_coerced and email_coerced

    # P1 regression guard: build the INSERT tuple via the SAME shared helper
    # load_table uses (build_insert_tuple), so a PASS proves the real code path.
    # Assert the self-FK column lands as None (NOT the raw ['rec...'] list).
    columns = TABLE_COLUMNS["alumnos"]
    insert_cols = ["id", "airtable_id"] + list(columns.keys())
    recid_to_pk = {"recEDI1": str(uuid.uuid4())}  # parent edicion resolvable
    insert_tuple, tuple_unresolved = build_insert_tuple(
        al1 or {}, columns, recid_to_pk, str(uuid.uuid4()),
    )
    self_fk_pos = insert_cols.index("pareja_alumno_id")
    self_fk_null_on_insert = (
        bool(al1) and not tuple_unresolved and insert_tuple is not None
        and insert_tuple[self_fk_pos] is None
        and al1.get("pareja_alumno_id") == ["recAL2"]  # raw link still on row
    )

    # Inbox + Cola de Emails: estado/origen must survive map_record.
    _, inbox_rows = process_table("inbox", fixtures["inbox"])
    inbox_row = inbox_rows[0] if inbox_rows else {}
    inbox_mapped = (
        inbox_row.get("estado") == "Respondido"
        and inbox_row.get("origen") == "Manual"
    )
    _, cola_rows = process_table("cola_emails", fixtures["cola_emails"])
    cola_row = cola_rows[0] if cola_rows else {}
    cola_mapped = (
        cola_row.get("estado") == "Enviado"
        and cola_row.get("origen") == "manual_template"
    )

    # ---- compute_prune_ids (PURE) unit tests -------------------------------
    # Normal prune: 1 of 20 Supabase rows is absent from the Airtable fetch
    # (fetch ratio 19/20 = 95% >= 90% floor; 1/20 = 5% stale < 25% threshold),
    # so the single stale row prunes cleanly. NOTE: fixtures must keep the fetch
    # ratio at/above PRUNE_MIN_FETCH_RATIO or the completeness floor (Fix A)
    # refuses the prune before the threshold guard is even reached.
    sup_20 = {f"rec{i}" for i in range(20)}
    air_19 = {f"rec{i}" for i in range(19)}  # rec19 stale
    ids, reason = compute_prune_ids("alumnos", sup_20, air_19)
    prune_normal = ids == {"rec19"} and reason is None

    # Empty-fetch guard: a non-allowlisted table with an EMPTY Airtable set must
    # be skipped (likely transient failure) — never wipe Supabase.
    ids, reason = compute_prune_ids("alumnos", {"rec1", "rec2"}, set())
    prune_empty_guard = (
        ids == set() and reason is not None and "empty fetch" in reason
    )

    # Known-empty allowlist: envios_emails IS allowed to be empty. The
    # empty-fetch guard does not fire; force=True clears the threshold guard so
    # an empty fetch prunes every Supabase row.
    ids, reason = compute_prune_ids(
        "envios_emails", {"rec1", "rec2"}, set(), force=True,
    )
    prune_allowlist = ids == {"rec1", "rec2"} and reason is None

    # Threshold guard: with the completeness floor active (Fix A), the testable
    # band is fetch-ratio >= 90% AND stale% > threshold. We pass a LOWER
    # threshold=0.05 so 9/100 = 9% stale (fetch ratio 91/100 = 91% >= 90% floor)
    # trips the threshold guard. Default 0.25 can never be tripped once the floor
    # holds (stale <= 10%), which is by design — the floor subsumes high-stale.
    sup_100 = {f"r{i}" for i in range(100)}
    air_91 = {f"r{i}" for i in range(91)}  # r91..r99 stale (9 rows)
    stale_9 = {f"r{i}" for i in range(91, 100)}
    ids, reason = compute_prune_ids(
        "alumnos", sup_100, air_91, threshold=0.05,
    )
    prune_threshold_guard = (
        ids == set() and reason is not None and "threshold" in reason
    )

    # Force override: the same 9% delete is allowed with force=True (force
    # bypasses the threshold guard but NOT the floor — here the floor passes).
    ids, reason = compute_prune_ids(
        "alumnos", sup_100, air_91, threshold=0.05, force=True,
    )
    prune_force_override = ids == stale_9 and reason is None
    ids_f, reason_f = compute_prune_ids(
        "alumnos", {"r1", "r2"}, set(), force=True,
    )
    prune_force_keeps_empty_guard = (
        ids_f == set() and reason_f is not None and "empty fetch" in reason_f
    )

    # Fetch-completeness floor (Fix A) applies only to tables LARGER than
    # PRUNE_FLOOR_MIN_ROWS (only a paginated fetch can partially truncate). A
    # 200-row table whose fetch returned 160/200 = 80% (< 90% floor) must be
    # REFUSED even with force=True — a truncated fetch must not delete the 40.
    sup_200 = {f"rec{i}" for i in range(200)}
    air_160 = {f"rec{i}" for i in range(160)}
    ids_inc, reason_inc = compute_prune_ids(
        "alumnos", sup_200, air_160, force=True,
    )
    prune_incomplete_guard = (
        ids_inc == set()
        and reason_inc is not None
        and "incomplete" in reason_inc
    )
    # At/above the floor (180/200 = 90%) the floor does NOT fire on a large
    # table: the 20 stale rows prune (10% stale < 25% threshold).
    air_180 = {f"rec{i}" for i in range(180)}
    ids_ok, reason_ok = compute_prune_ids("alumnos", sup_200, air_180)
    prune_floor_boundary = (
        ids_ok == {f"rec{i}" for i in range(180, 200)} and reason_ok is None
    )
    # Small-table exemption (Codex P2): a table at/below PRUNE_FLOOR_MIN_ROWS
    # (fits in one Airtable page) skips the floor — pagination cannot partially
    # truncate it. 'pagos' has 7 rows; after one real deletion the fetch returns
    # 6/7 = 86% (< 90% floor) yet the single stale row must still prune (1/7 =
    # 14% < 25% threshold) instead of being blocked forever by the floor.
    sup_7 = {f"pg{i}" for i in range(7)}
    air_6 = {f"pg{i}" for i in range(6)}  # pg6 = the deleted payment
    ids_sm, reason_sm = compute_prune_ids("pagos", sup_7, air_6)
    prune_small_table_exempt = ids_sm == {"pg6"} and reason_sm is None
    # ...but the threshold guard still governs small tables: 3/7 = 43% > 25%
    # is refused without force, allowed with force.
    air_4 = {f"pg{i}" for i in range(4)}  # pg4,pg5,pg6 stale (43%)
    ids_smt, reason_smt = compute_prune_ids("pagos", sup_7, air_4)
    ids_smf, reason_smf = compute_prune_ids("pagos", sup_7, air_4, force=True)
    prune_small_table_threshold = (
        ids_smt == set()
        and reason_smt is not None
        and "threshold" in reason_smt
        and ids_smf == {"pg4", "pg5", "pg6"}
        and reason_smf is None
    )
    # Allowlisted known-empty table is exempt from the floor (envios_emails).
    sup_10 = {f"rec{i}" for i in range(10)}
    air_8 = {f"rec{i}" for i in range(8)}
    ids_al, reason_al = compute_prune_ids(
        "envios_emails", sup_10, air_8, force=True,
    )
    prune_floor_allowlist = ids_al == {"rec8", "rec9"} and reason_al is None

    # CASCADE-subset guard (Fix C): pruning 'alumnos' as a SUBSET that omits a
    # CASCADE child (revisiones_video / pagos) must be REFUSED even with force.
    # The CASCADE guard sits ABOVE the completeness floor, so it fires even on a
    # tiny/low-ratio fetch (here 1/2) — it short-circuits first.
    ids_cas, reason_cas = compute_prune_ids(
        "alumnos", {"a1", "a2"}, {"a1"}, force=True,
        selected_tables={"alumnos"},
    )
    prune_cascade_guard = (
        ids_cas == set()
        and reason_cas is not None
        and "CASCADE" in reason_cas
    )
    # When BOTH CASCADE children are selected the guard does not fire. The fetch
    # must still clear the completeness floor, so use 20 Supabase / 19 fetched
    # (95% >= 90% floor); force clears the threshold so the single stale alumno
    # (a19) prunes.
    sup_20c = {f"a{i}" for i in range(20)}
    air_19c = {f"a{i}" for i in range(19)}  # a19 stale
    ids_full, reason_full = compute_prune_ids(
        "alumnos", sup_20c, air_19c, force=True,
        selected_tables={"alumnos", "revisiones_video", "pagos"},
    )
    prune_cascade_full = ids_full == {"a19"} and reason_full is None

    # Threshold range validation (Fix B): parse_args must reject >= 1.0, 0 and
    # negatives with a non-zero exit (SystemExit from parser.error()).
    def _threshold_rejected(value: str) -> bool:
        try:
            parse_args(["--prune", "--prune-threshold", value])
        except SystemExit as exc:  # argparse error -> non-zero exit
            return exc.code not in (0, None)
        return False

    threshold_validation = (
        _threshold_rejected("1.5")
        and _threshold_rejected("1.0")
        and _threshold_rejected("0")
        and _threshold_rejected("-0.1")
    )
    # A valid in-range threshold is accepted (no SystemExit).
    threshold_valid_accepted = (
        parse_args(["--prune", "--prune-threshold", "0.5"]).prune_threshold
        == 0.5
    )

    print("--- self-test assertions ---")
    print(f"bad-enum caught (recAL2)      : {bad_caught}")
    print(f"NOT NULL caught (recAL3)      : {notnull_caught}")
    print(f"estado_pago normalized->Compl.: {pago_normalized}")
    print(f"pareja self-FK mapped (recAL1): {pareja_mapped}")
    print(f"pareja_alumno_id is self_fk   : {self_fk_flagged}")
    print(f"lookup-list coerced->scalar   : {lookup_list_coerced}")
    print(f"self-FK NULL on INSERT tuple  : {self_fk_null_on_insert}")
    print(f"inbox estado+origen mapped    : {inbox_mapped}")
    print(f"cola estado+origen mapped     : {cola_mapped}")
    print(f"prune normal (rec5 stale)     : {prune_normal}")
    print(f"prune empty-fetch guard       : {prune_empty_guard}")
    print(f"prune known-empty allowlist   : {prune_allowlist}")
    print(f"prune threshold guard (75%)   : {prune_threshold_guard}")
    print(f"prune force override          : {prune_force_override}")
    print(f"prune force keeps empty guard : {prune_force_keeps_empty_guard}")
    print(f"prune incomplete-fetch guard  : {prune_incomplete_guard}")
    print(f"prune floor boundary (90%)    : {prune_floor_boundary}")
    print(f"prune small-table floor exempt: {prune_small_table_exempt}")
    print(f"prune small-table threshold   : {prune_small_table_threshold}")
    print(f"prune floor allowlist exempt  : {prune_floor_allowlist}")
    print(f"prune CASCADE-subset guard    : {prune_cascade_guard}")
    print(f"prune CASCADE full selected   : {prune_cascade_full}")
    print(f"threshold range rejected      : {threshold_validation}")
    print(f"threshold valid accepted      : {threshold_valid_accepted}")
    print(f"report generated              : {report_exists} ({report_path})")
    ok = (
        bad_caught and notnull_caught and pago_normalized
        and pareja_mapped and self_fk_flagged and lookup_list_coerced
        and self_fk_null_on_insert
        and inbox_mapped and cola_mapped
        and prune_normal and prune_empty_guard and prune_allowlist
        and prune_threshold_guard and prune_force_override
        and prune_force_keeps_empty_guard
        and prune_incomplete_guard and prune_floor_boundary
        and prune_small_table_exempt and prune_small_table_threshold
        and prune_floor_allowlist and prune_cascade_guard
        and prune_cascade_full and threshold_validation
        and threshold_valid_accepted
        and report_exists
    )
    print(f"SELF-TEST: {'PASS' if ok else 'FAIL'} (run rc={rc})")
    return 0 if ok else 1


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Define and parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Migrate ProEv data from Airtable to Supabase/Postgres.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run", action="store_true", default=True,
        help="validate + report without writing to Postgres (default)",
    )
    mode.add_argument(
        "--load", action="store_true", default=False,
        help="write validated rows into Postgres (requires SUPABASE_DB_URL)",
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
        "--prune", action="store_true", default=False,
        help="reconcile DELETIONS: report (dry-run) or delete (--load) "
             "Supabase rows whose airtable_id no longer exists in Airtable",
    )
    parser.add_argument(
        "--prune-force", action="store_true", default=False,
        help="bypass the prune safety threshold (still honors the "
             "empty-fetch guard); only meaningful with --prune",
    )
    parser.add_argument(
        "--prune-threshold", type=float, default=DEFAULT_PRUNE_THRESHOLD,
        help="max fraction (0-1) of a table's Supabase rows prunable before "
             f"--prune-force is required (default: {DEFAULT_PRUNE_THRESHOLD})",
    )
    parser.add_argument(
        "--self-test", action="store_true", default=False,
        help="run the offline self-test with mock fixtures and exit",
    )
    args = parser.parse_args(argv)
    # Validate the prune threshold range: it must be in the OPEN interval
    # (0, 1). A value >= 1.0 silently disables the threshold guard (no stale
    # fraction can EXCEED 100%, so the guard never fires), and 0 / negatives are
    # nonsensical. parser.error() prints to stderr and exits with status 2
    # (non-zero), so an out-of-range value never runs.
    if not (0 < args.prune_threshold < 1):
        parser.error(
            f"--prune-threshold must be in the open range (0, 1); got "
            f"{args.prune_threshold} (>= 1.0 would disable the safety guard)"
        )
    return args


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
        prune=args.prune,
        prune_force=args.prune_force,
        prune_threshold=args.prune_threshold,
    )


if __name__ == "__main__":
    sys.exit(main())
