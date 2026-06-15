#!/usr/bin/env python3
"""One-off idempotent loader: Airtable `tbl6I5p5adeeGDv2S` (Bachata inscription
form intake) -> Supabase `inscripciones` table (shadow DB).

The main migrator (migrate_airtable_data.py) intentionally does NOT handle this
table: its FIELD_MAP has no concept of "collect all unmapped fields into a JSONB
blob". This standalone loader fills that gap.

Behaviour
---------
* Fetches ALL records from the inscription form table (paginated).
* Maps the structured columns (full_name, email, phone_number, timestamp_form,
  ultima_modificacion, alumno_id, modules_solicitados, pais, rol).
* Resolves `alumno_id` from the Airtable `Alumnos` link (recId) via the
  alumnos.airtable_id -> alumnos.id map already present in Supabase.
* Packs every OTHER Airtable field (dance level, expectations, how long
  dancing, discount code, etc.) into `respuestas_formulario` JSONB, keyed by
  the question label.
* UPSERTs by `airtable_id` (ON CONFLICT DO UPDATE) so re-runs are safe.

NON-DESTRUCTIVE: never writes to Airtable. Writes to Supabase only with --load
(default is --dry-run which prints what would be loaded).

Env (source migration_creds.sh first):
    SUPABASE_DB_URL, AIRTABLE_PAT, AIRTABLE_BASE_ID
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

TABLE_ID = "tbl6I5p5adeeGDv2S"

# Airtable field label -> Supabase structured column.
# Every field NOT in this map is collected into respuestas_formulario JSONB.
STRUCTURED = {
    "Full Name": "full_name",
    "Email": "email",
    "Phone Number": "phone_number",
    "Timestamp": "timestamp_form",
    "Ultima Modificacion": "ultima_modificacion",
    "What country are you come from?": "pais",
    "Are you leader or follower?": "rol",
}
# These two are handled specially (array / linked record), not via STRUCTURED.
MODULES_FIELD = (
    'Which modules would you like to attend? '
    '"You will not be able to access the next module without completing the '
    'previous one."'
)
ALUMNOS_LINK_FIELD = "Alumnos"

# Fields consumed as structured columns OR special-cased; excluded from JSONB.
JSONB_EXCLUDE = set(STRUCTURED.keys()) | {MODULES_FIELD, ALUMNOS_LINK_FIELD}


def _req(url: str, pat: str):
    return json.load(
        urllib.request.urlopen(
            urllib.request.Request(url, headers={"Authorization": f"Bearer {pat}"})
        )
    )


def fetch_all_airtable(pat: str, base: str) -> list[dict]:
    records, offset = [], None
    while True:
        params = {"pageSize": "100"}
        if offset:
            params["offset"] = offset
        url = f"https://api.airtable.com/v0/{base}/{TABLE_ID}?" + urllib.parse.urlencode(params)
        data = _req(url, pat)
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
    return records


def build_alumno_map(conn) -> dict[str, str]:
    """alumnos.airtable_id (recId) -> alumnos.id (UUID str)."""
    cur = conn.cursor()
    cur.execute("SELECT airtable_id, id FROM alumnos WHERE airtable_id IS NOT NULL")
    return {aid: str(uid) for aid, uid in cur.fetchall()}


def _as_text_array(value) -> list[str] | None:
    if value is None:
        return None
    if isinstance(value, list):
        return [str(v) for v in value]
    return [str(value)]


def map_record(rec: dict, alumno_map: dict[str, str]) -> tuple:
    f = rec["fields"]
    airtable_id = rec["id"]

    # alumno_id from the first linked Airtable record id.
    alumno_id = None
    link = f.get(ALUMNOS_LINK_FIELD)
    if isinstance(link, list) and link:
        alumno_id = alumno_map.get(link[0])  # None if unresolved (FK set null)

    modules = _as_text_array(f.get(MODULES_FIELD))

    # Everything not structured/special -> JSONB.
    respuestas = {k: v for k, v in f.items() if k not in JSONB_EXCLUDE}

    return (
        airtable_id,
        f.get("Full Name"),
        f.get("Email"),
        f.get("Phone Number"),
        f.get("Timestamp"),
        f.get("Ultima Modificacion"),
        alumno_id,
        modules,
        f.get("What country are you come from?"),
        f.get("Are you leader or follower?"),
        json.dumps(respuestas, ensure_ascii=False) if respuestas else None,
    )


UPSERT_SQL = """
INSERT INTO inscripciones (
  airtable_id, full_name, email, phone_number, timestamp_form,
  ultima_modificacion, alumno_id, modules_solicitados, pais, rol,
  respuestas_formulario
) VALUES %s
ON CONFLICT (airtable_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone_number = EXCLUDED.phone_number,
  timestamp_form = EXCLUDED.timestamp_form,
  ultima_modificacion = EXCLUDED.ultima_modificacion,
  alumno_id = EXCLUDED.alumno_id,
  modules_solicitados = EXCLUDED.modules_solicitados,
  pais = EXCLUDED.pais,
  rol = EXCLUDED.rol,
  respuestas_formulario = EXCLUDED.respuestas_formulario,
  updated_at = now()
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--load", action="store_true", help="write to Supabase (default: dry-run)")
    args = ap.parse_args()

    pat = os.environ["AIRTABLE_PAT"]
    base = os.environ["AIRTABLE_BASE_ID"]
    db_url = os.environ["SUPABASE_DB_URL"]

    import psycopg2
    from psycopg2.extras import execute_values

    records = fetch_all_airtable(pat, base)
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    alumno_map = build_alumno_map(conn)

    rows, resolved, unresolved = [], 0, 0
    for rec in records:
        row = map_record(rec, alumno_map)
        if row[6] is not None:
            resolved += 1
        elif rec["fields"].get(ALUMNOS_LINK_FIELD):
            unresolved += 1
        rows.append(row)

    print(f"airtable_records={len(records)} alumno_id_resolved={resolved} "
          f"alumno_link_unresolved={unresolved}")

    if not args.load:
        print("DRY-RUN: no writes. Pass --load to write.")
        if rows:
            r = rows[0]
            print("sample row[0]: airtable_id=%s full_name=%r email=%r alumno_id=%s "
                  "modules=%s rol=%r jsonb_keys=%s" % (
                      r[0], r[1], r[2], r[6], r[7], r[9],
                      list(json.loads(r[10]).keys()) if r[10] else []))
        conn.close()
        return 0

    cur = conn.cursor()
    execute_values(cur, UPSERT_SQL, rows, page_size=100)
    cur.execute("SELECT count(*) FROM inscripciones")
    total = cur.fetchone()[0]
    print(f"LOADED. inscripciones row count = {total}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
