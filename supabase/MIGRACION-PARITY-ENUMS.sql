-- ============================================================
-- ProEv Supabase — ENUM PARITY PATCH
-- ============================================================
-- Purpose: close the ENUM drift that makes the airtable-supabase-sync
--          GitHub Action exit 1 (red) during the migration window.
--
-- ROOT CAUSE (found live, 2026-06-30):
--   The sync loads 3181/3188 rows OK and commits them. It exits 1 only
--   because `migrate_airtable_data.py` returns `1 if total_failed else 0`
--   (any failed row paints the Action red). The failing rows are real:
--   Airtable carries an ENUM value the Postgres type does not list.
--
--   - cola_emails.tipo = 'recordatorio_preinscripcion'  (5 rows)
--       -> NOT in ENUM `tipo_email`. This is a NEW drift: it is absent
--          from both schema.sql and MIGRACION-PARITY-SCHEMA.md. Static
--          parity analysis missed it; the live run surfaced it.
--
-- The 4 ENUM drifts listed in MIGRACION-PARITY-SCHEMA.md (estado_revision
-- 'Video no accesible', estado_pago 'Completado' / 'Pendiente Verificación',
-- origen_evento 'Sistema') are ALREADY present in the canonical schema.sql
-- and were not in the live failure set. They are re-asserted below as
-- IF NOT EXISTS no-ops so this patch is a safe full-parity re-run against
-- any live/shadow DB regardless of how far behind it is.
--
-- HOW TO RUN:
--   Supabase SQL editor (project qktvdmoggniufynaodzq) or psql with
--   SUPABASE_DB_URL. ALTER TYPE ... ADD VALUE is idempotent here via
--   IF NOT EXISTS. Run these statements OUTSIDE an explicit transaction
--   that then uses the new value: a value added by ADD VALUE cannot be
--   used until the adding statement has committed. Each statement below
--   is standalone, so running the file as-is is fine.
--
-- AFTER RUNNING: re-trigger the workflow (Actions -> "Airtable -> Supabase
--   sync" -> Run workflow). With the 5 cola_emails rows now mappable, only
--   the 2 "alumno fantasma" rows remain (see bottom) — fix those in
--   Airtable to take total_failed to 0 and the Action back to green.
-- ============================================================


-- 1. REAL FIX — missing value surfaced by the live sync (5 rows)
ALTER TYPE tipo_email ADD VALUE IF NOT EXISTS 'recordatorio_preinscripcion';


-- 2. Defensive re-assert of the documented drifts.
--    Already in canonical schema.sql; no-ops on an up-to-date DB. Kept so
--    this patch fully closes ENUM parity even on a stale shadow DB.
ALTER TYPE estado_revision ADD VALUE IF NOT EXISTS 'Video no accesible';
ALTER TYPE estado_pago     ADD VALUE IF NOT EXISTS 'Completado';
ALTER TYPE estado_pago     ADD VALUE IF NOT EXISTS 'Pendiente Verificación';
ALTER TYPE origen_evento   ADD VALUE IF NOT EXISTS 'Sistema';


-- ============================================================
-- NOT FIXED BY THIS PATCH — "alumno fantasma" (2 rows, data issue)
-- ============================================================
-- These are bad data in Airtable, not a schema gap. No SQL here can fix
-- them; resolve at the source, then the sync drops to 0 failures.
--
--   alumnos    rec47HAV4xl9XPtk3 : nombre + email empty -> NOT NULL violated
--   historial  recLYiPAjbAghGpdF : FK alumno_id -> rec47HAV4xl9XPtk3
--                                   (orphan; resolves automatically once the
--                                    alumno above is completed or deleted)
--
-- ACTION (in Airtable, base app4ZpoxaWOyV4RnR):
--   Either fill nombre + email on rec47HAV4xl9XPtk3, or delete the record
--   (and its dependent historial row). Decision pending from David.
-- ============================================================
