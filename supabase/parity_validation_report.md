# Parity Validation Report — Airtable vs Supabase

Generated: 2026-06-14T22:03:35

## Verdict

**PASS (0 discrepancies)**

- Rows compared (field-by-field): 2721
- missing_in_supabase : 0
- orphaned_in_supabase: 0
- field_mismatches    : 0
- **TOTAL discrepancies: 0**

## Per-table summary

| table | airtable_count | supabase_count | missing | orphaned | field_mismatch_count |
|---|---:|---:|---:|---:|---:|
| ediciones | 2 | 2 | 0 | 0 | 0 |
| modulos | 6 | 6 | 0 | 0 | 0 |
| alumnos | 143 | 143 | 0 | 0 | 0 |
| revisiones_video | 93 | 93 | 0 | 0 | 0 |
| pagos | 7 | 7 | 0 | 0 | 0 |
| envios_emails | 0 | 0 | 0 | 0 | 0 |
| cola_emails | 232 | 232 | 0 | 0 | 0 |
| inbox | 393 | 393 | 0 | 0 | 0 |
| historial | 1845 | 1845 | 0 | 0 | 0 |

## Discrepancy detail (up to 5 examples per type per table)

### ediciones

No discrepancies.

### modulos

No discrepancies.

### alumnos

No discrepancies.

### revisiones_video

No discrepancies.

### pagos

No discrepancies.

### envios_emails

No discrepancies.

### cola_emails

No discrepancies.

### inbox

No discrepancies.

### historial

No discrepancies.

## Caveats (columns excluded from comparison)

- id (UUID PK), created_at, updated_at: server-generated defaults — never written by the migrator, so excluded.
- airtable_id: it is the JOIN KEY itself (compared implicitly by matching rows on it), not a data column.
- Only columns present in the migrator's TABLE_COLUMNS are compared. Any Airtable field with no FIELD_MAP entry / no Postgres column is, by design, not migrated and therefore not part of parity.
- envios_emails has no `alumnos_ids[]` FK column in the migrator's TABLE_COLUMNS (the migrator never maps a recipients array), so that array-FK is not compared. The table is also genuinely empty (0/0).
- FK columns (edicion_id, alumno_id, modulo links, alumnos.pareja_alumno_id self-FK) are compared as resolved UUIDs using a recId->UUID map rebuilt from Postgres, mirroring load_table/backfill_self_fks.
- Numeric values compared at 6-decimal precision; timestamps at second resolution in UTC; NULL and empty-string treated as equal.
- JSONB columns (e.g. ediciones.plazos_revision, a 'text' ColSpec the DB casts to jsonb): the Airtable side is a JSON string and the Postgres side is parsed JSON, so they are compared as canonical sorted-key JSON for semantic equality (quote style / whitespace / key order ignored).
