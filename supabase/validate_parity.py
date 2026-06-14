#!/usr/bin/env python3
"""Deep FIELD-LEVEL parity validator: Airtable (source) vs Supabase/Postgres.

Goal: prove there are 0 data bugs before the production cutover by comparing,
for every migrated table, every mapped column value between the live Airtable
record and the Postgres row it was loaded into.

This script REUSES the migrator's mapping logic verbatim (it imports
migrate_airtable_data as a module) so there is exactly ONE definition of how an
Airtable field becomes a Postgres value:

  * FIELD_MAP / TABLE_COLUMNS / ENUM_VALUES  -> column wiring + type metadata
  * normalize_value + coerce_value + map_record -> per-record value mapping
  * fetch_airtable_records / RateLimiter      -> identical paginated source read
  * _first                                    -> Airtable link/lookup flattening

FK resolution (recId -> UUID): the migrator builds an in-memory
{airtable_record_id -> pg_uuid} map during --load. Since the data is ALREADY
loaded, this validator rebuilds that map authoritatively straight from Postgres
(`SELECT airtable_id, id FROM <table>` for every table). Every FK column
(alumno_id, edicion_id, modulo_id ... and the self-FK alumnos.pareja_alumno_id)
is resolved through that same map + `_first()`, exactly as load_table /
backfill_self_fks do, so FK columns compare as the UUIDs that actually landed in
the DB.

NON-DESTRUCTIVE: read-only against both Airtable and Postgres.

Run:
  source /c/Users/David/AppData/Local/Temp/migration_creds.sh
  PYTHONIOENCODING=utf-8 python dashboard/supabase/validate_parity.py
"""

from __future__ import annotations

import datetime
import json
import os
import sys
from typing import Any

# Reuse the migrator as the single source of truth for mapping.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import migrate_airtable_data as M  # noqa: E402

try:
    import psycopg2  # type: ignore
    from psycopg2 import sql as psql  # type: ignore
except ImportError:  # pragma: no cover
    psycopg2 = None  # type: ignore
    psql = None  # type: ignore


REPORT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "parity_validation_report.md"
)

# Tables to validate, in FK-safe order (parents first so the recId->UUID map is
# fully populated before children are compared). Matches the migrator order.
TABLES = list(M.LOAD_ORDER)

# Server-generated / migrator-never-writes columns excluded from comparison.
# id (UUID PK), created_at, updated_at are DB defaults; airtable_id is the JOIN
# KEY itself (compared implicitly by matching on it).
SERVER_COLUMNS = {"id", "created_at", "updated_at", "airtable_id"}

MAX_EXAMPLES = 5


# ----------------------------------------------------------------------------
# Postgres helpers
# ----------------------------------------------------------------------------
def build_recid_to_pk(conn: Any) -> dict[str, str]:
    """Authoritative {airtable_record_id -> pg_uuid} map, read from Postgres.

    Mirrors the migrator's in-memory recid_to_pk, but rebuilt from the loaded
    data so FK columns resolve to the UUIDs that are really in the DB.
    """
    recid_to_pk: dict[str, str] = {}
    with conn.cursor() as cur:
        for table in TABLES:
            # table comes from the internal TABLES whitelist (== M.LOAD_ORDER),
            # never user input, and is composed via psycopg2.sql.Identifier so the
            # statement is injection-safe by construction. The SQLAlchemy-scoped
            # rule below misfires on this canonical psycopg2 pattern.
            cur.execute(  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
                psql.SQL("SELECT airtable_id, id FROM {t} WHERE airtable_id IS NOT NULL").format(
                    t=psql.Identifier(table)
                )
            )
            for airtable_id, pk in cur.fetchall():
                if airtable_id is not None:
                    recid_to_pk[airtable_id] = str(pk)
    return recid_to_pk


def fetch_pg_rows(conn: Any, table: str, columns: list[str]) -> dict[str, dict[str, Any]]:
    """Return {airtable_id -> {column: actual_value}} for one Postgres table."""
    select_cols = ["airtable_id"] + columns
    with conn.cursor() as cur:
        # table/columns are internal whitelist identifiers (TABLES / TABLE_COLUMNS),
        # composed via psycopg2.sql.Identifier for safe quoting; no user input. The
        # SQLAlchemy-scoped rule below misfires on this canonical psycopg2 pattern.
        cur.execute(  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
            psql.SQL("SELECT {cols} FROM {t}").format(
                cols=psql.SQL(", ").join(psql.Identifier(c) for c in select_cols),
                t=psql.Identifier(table),
            )
        )
        col_names = [d[0] for d in cur.description]
        out: dict[str, dict[str, Any]] = {}
        for record in cur.fetchall():
            row = dict(zip(col_names, record))
            aid = row.pop("airtable_id")
            if aid is not None:
                out[aid] = row
    return out


# ----------------------------------------------------------------------------
# Normalization for type-aware comparison
# ----------------------------------------------------------------------------
def _canonical_json(value: Any) -> str | None:
    """Return canonical JSON (sorted keys) if value is a JSON object/array.

    Accepts either a JSON string (Airtable richText side) or an already-parsed
    list/dict (psycopg2 JSONB side). Returns None for plain scalars/strings that
    are not JSON containers, so non-JSON text columns are left to the normal
    string comparison.
    """
    obj: Any = None
    if isinstance(value, (list, dict)):
        obj = value
    elif isinstance(value, str):
        s = value.strip()
        if s[:1] in ("[", "{"):
            try:
                obj = json.loads(s)
            except (ValueError, TypeError):
                return None
        else:
            return None
    else:
        return None
    if not isinstance(obj, (list, dict)):
        return None
    try:
        return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError):
        return None


def _norm_for_compare(spec: "M.ColSpec", value: Any) -> Any:
    """Normalize a value (expected OR actual) to a canonical comparable form.

    Brings Airtable-mapped values and Postgres driver values onto common ground:
      * NULL vs empty-string -> both become None.
      * text -> trimmed string.
      * int -> int; numeric -> float rounded to 6dp (avoids 1 vs 1.0 / fp noise).
      * bool -> python bool.
      * date -> ISO yyyy-mm-dd string (psycopg2 returns datetime.date).
      * timestamptz -> aware-or-naive datetime compared at second resolution.
      * text[] -> list of trimmed strings (order preserved: migrator keeps order).
      * uuid -> lowercase string.
    """
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None

    kind = spec.kind
    try:
        if kind == "text":
            # Some 'text' ColSpec columns map to a Postgres JSONB column (e.g.
            # ediciones.plazos_revision): the migrator passes the Airtable JSON
            # STRING through and the DB casts text->jsonb, so psycopg2 returns a
            # parsed Python list/dict on the actual side while the expected side
            # is still a JSON string. Compare those semantically by canonical
            # JSON (sorted keys) so quote-style / whitespace / key-order never
            # produce a false mismatch. A plain text value (not a JSON
            # object/array) falls through to the trimmed-string compare.
            canon = _canonical_json(value)
            if canon is not None:
                return canon
            return str(value).strip()
        if kind == "uuid":
            return str(value).strip().lower()
        if kind == "int":
            return int(float(value))
        if kind == "numeric":
            return round(float(value), 6)
        if kind == "bool":
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.strip().lower() in ("true", "1", "yes", "si", "sí", "t")
            return bool(value)
        if kind == "date":
            if isinstance(value, datetime.datetime):
                return value.date().isoformat()
            if isinstance(value, datetime.date):
                return value.isoformat()
            return datetime.date.fromisoformat(str(value)[:10]).isoformat()
        if kind == "timestamptz":
            dt = value
            if isinstance(dt, str):
                dt = datetime.datetime.fromisoformat(dt.replace("Z", "+00:00"))
            if isinstance(dt, datetime.datetime):
                # Compare as UTC-naive at second resolution. Airtable stores UTC.
                if dt.tzinfo is not None:
                    dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
                return dt.replace(microsecond=0).isoformat()
            return str(dt)
        if kind == "text[]":
            if value is None:
                return None
            seq = value if isinstance(value, (list, tuple)) else [value]
            return [str(x).strip() for x in seq]
    except (TypeError, ValueError):
        # Uncomparable after normalization -> surface raw for the mismatch line.
        return f"<UNNORMALIZABLE:{value!r}>"
    return value


# ----------------------------------------------------------------------------
# Expected (Airtable-mapped) row construction, with FK resolution
# ----------------------------------------------------------------------------
def build_expected_row(
    table: str,
    rec: dict[str, Any],
    recid_to_pk: dict[str, str],
) -> dict[str, Any]:
    """Map one Airtable record to its expected Postgres row (FKs resolved).

    Uses the migrator's map_record for value mapping, then resolves FK / self-FK
    columns through the Postgres-derived recId->UUID map exactly like
    build_insert_tuple / backfill_self_fks do (single-item link list -> _first ->
    parent UUID; unresolved link -> None, matching the migrator nulling absent
    parents).
    """
    columns = M.TABLE_COLUMNS[table]
    mapped = M.map_record(table, rec.get("fields", {}))
    expected: dict[str, Any] = {}
    for col, spec in columns.items():
        val = mapped.get(col)
        if spec.fk:  # both non-self and self FK resolve through recid_to_pk
            if val is None:
                expected[col] = None
            else:
                parent_rec = M._first(val)
                expected[col] = recid_to_pk.get(parent_rec) if parent_rec else None
        else:
            expected[col] = val
    return expected


# ----------------------------------------------------------------------------
# Per-table comparison
# ----------------------------------------------------------------------------
def compare_table(
    table: str,
    airtable_records: list[dict[str, Any]],
    pg_rows: dict[str, dict[str, Any]],
    recid_to_pk: dict[str, str],
) -> dict[str, Any]:
    """Compare one table field-by-field. Returns a structured result dict."""
    columns = M.TABLE_COLUMNS[table]
    compare_cols = [c for c in columns if c not in SERVER_COLUMNS]

    airtable_ids = {rec.get("id") for rec in airtable_records if rec.get("id")}
    pg_ids = set(pg_rows.keys())

    missing_in_supabase = sorted(airtable_ids - pg_ids)
    orphaned_in_supabase = sorted(pg_ids - airtable_ids)

    field_mismatches: list[dict[str, Any]] = []
    compared_rows = 0

    for rec in airtable_records:
        aid = rec.get("id")
        if aid not in pg_rows:
            continue  # counted as missing_in_supabase
        compared_rows += 1
        expected_row = build_expected_row(table, rec, recid_to_pk)
        actual_row = pg_rows[aid]
        for col in compare_cols:
            spec = columns[col]
            exp = _norm_for_compare(spec, expected_row.get(col))
            act = _norm_for_compare(spec, actual_row.get(col))
            if exp != act:
                field_mismatches.append(
                    {
                        "record_id": aid,
                        "column": col,
                        "expected": exp,
                        "actual": act,
                    }
                )

    return {
        "table": table,
        "airtable_count": len(airtable_ids),
        "supabase_count": len(pg_ids),
        "compared_rows": compared_rows,
        "missing_in_supabase": missing_in_supabase,
        "orphaned_in_supabase": orphaned_in_supabase,
        "field_mismatches": field_mismatches,
        "compared_columns": compare_cols,
    }


# ----------------------------------------------------------------------------
# Report
# ----------------------------------------------------------------------------
def _fmt(v: Any) -> str:
    s = repr(v)
    return s if len(s) <= 80 else s[:77] + "..."


def write_report(results: list[dict[str, Any]], path: str, caveats: list[str]) -> None:
    lines: list[str] = []
    lines.append("# Parity Validation Report — Airtable vs Supabase")
    lines.append("")
    lines.append(f"Generated: {datetime.datetime.now().isoformat(timespec='seconds')}")
    lines.append("")

    total_missing = sum(len(r["missing_in_supabase"]) for r in results)
    total_orphaned = sum(len(r["orphaned_in_supabase"]) for r in results)
    total_mismatches = sum(len(r["field_mismatches"]) for r in results)
    total_compared = sum(r["compared_rows"] for r in results)
    total_discrepancies = total_missing + total_orphaned + total_mismatches

    verdict = "PASS (0 discrepancies)" if total_discrepancies == 0 else "FAIL"
    lines.append("## Verdict")
    lines.append("")
    lines.append(f"**{verdict}**")
    lines.append("")
    lines.append(f"- Rows compared (field-by-field): {total_compared}")
    lines.append(f"- missing_in_supabase : {total_missing}")
    lines.append(f"- orphaned_in_supabase: {total_orphaned}")
    lines.append(f"- field_mismatches    : {total_mismatches}")
    lines.append(f"- **TOTAL discrepancies: {total_discrepancies}**")
    lines.append("")

    lines.append("## Per-table summary")
    lines.append("")
    lines.append(
        "| table | airtable_count | supabase_count | missing | orphaned | field_mismatch_count |"
    )
    lines.append("|---|---:|---:|---:|---:|---:|")
    for r in results:
        lines.append(
            f"| {r['table']} | {r['airtable_count']} | {r['supabase_count']} | "
            f"{len(r['missing_in_supabase'])} | {len(r['orphaned_in_supabase'])} | "
            f"{len(r['field_mismatches'])} |"
        )
    lines.append("")

    lines.append("## Discrepancy detail (up to 5 examples per type per table)")
    lines.append("")
    for r in results:
        has_any = (
            r["missing_in_supabase"]
            or r["orphaned_in_supabase"]
            or r["field_mismatches"]
        )
        lines.append(f"### {r['table']}")
        lines.append("")
        if not has_any:
            lines.append("No discrepancies.")
            lines.append("")
            continue

        if r["missing_in_supabase"]:
            lines.append(f"**missing_in_supabase ({len(r['missing_in_supabase'])})** — "
                         "Airtable records with no matching airtable_id row:")
            for aid in r["missing_in_supabase"][:MAX_EXAMPLES]:
                lines.append(f"- `{aid}`")
            lines.append("")
        if r["orphaned_in_supabase"]:
            lines.append(f"**orphaned_in_supabase ({len(r['orphaned_in_supabase'])})** — "
                         "Postgres rows whose airtable_id is not in current Airtable:")
            for aid in r["orphaned_in_supabase"][:MAX_EXAMPLES]:
                lines.append(f"- `{aid}`")
            lines.append("")
        if r["field_mismatches"]:
            lines.append(f"**field_mismatches ({len(r['field_mismatches'])})** — "
                         "per-column expected (Airtable-mapped) vs actual (Postgres):")
            lines.append("")
            lines.append("| record_id | column | expected | actual |")
            lines.append("|---|---|---|---|")
            for mm in r["field_mismatches"][:MAX_EXAMPLES]:
                lines.append(
                    f"| `{mm['record_id']}` | `{mm['column']}` | "
                    f"{_fmt(mm['expected'])} | {_fmt(mm['actual'])} |"
                )
            lines.append("")

    lines.append("## Caveats (columns excluded from comparison)")
    lines.append("")
    if caveats:
        for c in caveats:
            lines.append(f"- {c}")
    else:
        lines.append("- None.")
    lines.append("")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main() -> int:
    if psycopg2 is None:
        print("[error] psycopg2 is required")
        return 2
    if M.requests is None:
        print("[error] requests is required")
        return 2

    db_url = os.environ.get("SUPABASE_DB_URL")
    pat = os.environ.get("AIRTABLE_PAT")
    base_id = os.environ.get("AIRTABLE_BASE_ID") or M.AIRTABLE_BASE_ID_DEFAULT
    if not db_url:
        print("[error] SUPABASE_DB_URL not set")
        return 2
    if not pat:
        print("[error] AIRTABLE_PAT not set")
        return 2

    caveats = [
        "id (UUID PK), created_at, updated_at: server-generated defaults — never "
        "written by the migrator, so excluded.",
        "airtable_id: it is the JOIN KEY itself (compared implicitly by matching "
        "rows on it), not a data column.",
        "Only columns present in the migrator's TABLE_COLUMNS are compared. Any "
        "Airtable field with no FIELD_MAP entry / no Postgres column is, by "
        "design, not migrated and therefore not part of parity.",
        "envios_emails has no `alumnos_ids[]` FK column in the migrator's "
        "TABLE_COLUMNS (the migrator never maps a recipients array), so that "
        "array-FK is not compared. The table is also genuinely empty (0/0).",
        "FK columns (edicion_id, alumno_id, modulo links, alumnos.pareja_alumno_id "
        "self-FK) are compared as resolved UUIDs using a recId->UUID map rebuilt "
        "from Postgres, mirroring load_table/backfill_self_fks.",
        "Numeric values compared at 6-decimal precision; timestamps at second "
        "resolution in UTC; NULL and empty-string treated as equal.",
        "JSONB columns (e.g. ediciones.plazos_revision, a 'text' ColSpec the DB "
        "casts to jsonb): the Airtable side is a JSON string and the Postgres "
        "side is parsed JSON, so they are compared as canonical sorted-key JSON "
        "for semantic equality (quote style / whitespace / key order ignored).",
    ]

    limiter = M.RateLimiter(M.MAX_REQUESTS_PER_SECOND)
    conn = psycopg2.connect(db_url)
    results: list[dict[str, Any]] = []
    try:
        print("[info] building recId->UUID map from Postgres...")
        recid_to_pk = build_recid_to_pk(conn)
        print(f"[info] recId->UUID map size: {len(recid_to_pk)}")

        for table in TABLES:
            table_id = M.AIRTABLE_TABLES[table]
            print(f"[info] {table}: fetching Airtable...")
            airtable_records = M.fetch_airtable_records(base_id, table_id, pat, limiter)
            columns = M.TABLE_COLUMNS[table]
            compare_cols = [c for c in columns if c not in SERVER_COLUMNS]
            pg_rows = fetch_pg_rows(conn, table, compare_cols)
            print(
                f"[info] {table}: airtable={len(airtable_records)} "
                f"supabase={len(pg_rows)}"
            )
            res = compare_table(table, airtable_records, pg_rows, recid_to_pk)
            results.append(res)
            print(
                f"[info] {table}: missing={len(res['missing_in_supabase'])} "
                f"orphaned={len(res['orphaned_in_supabase'])} "
                f"field_mismatches={len(res['field_mismatches'])}"
            )
    finally:
        conn.close()

    write_report(results, REPORT_PATH, caveats)

    total_missing = sum(len(r["missing_in_supabase"]) for r in results)
    total_orphaned = sum(len(r["orphaned_in_supabase"]) for r in results)
    total_mismatches = sum(len(r["field_mismatches"]) for r in results)
    total_compared = sum(r["compared_rows"] for r in results)
    total = total_missing + total_orphaned + total_mismatches

    print("=" * 60)
    print(f"Rows compared : {total_compared}")
    print(f"missing       : {total_missing}")
    print(f"orphaned      : {total_orphaned}")
    print(f"field_mismatch: {total_mismatches}")
    print(f"TOTAL discrep : {total}")
    print(f"VERDICT       : {'PASS' if total == 0 else 'FAIL'}")
    print(f"Report        : {REPORT_PATH}")
    return 0 if total == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
