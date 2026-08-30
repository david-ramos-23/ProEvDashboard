-- ============================================================
-- MIGRACION-BULK-ORIGEN-2026-08-30.sql
--
-- Upgrade script for an ALREADY-PROVISIONED Supabase database.
--
-- WHY THIS FILE EXISTS
--   `schema.sql` is a clean-install script: its `CREATE TYPE` statement is not
--   idempotent, so it is never re-run against the shadow project. The
--   `bulk-email-send` change adds 'bulk' to `origen_email` and a `nombre`
--   column to `envios_emails` only in `schema.sql`, which means the
--   provisioned shadow DB (project qktvdmoggniufynaodzq, EU-North-1) would
--   still reject `origen = 'bulk'` and would have nowhere to store a campaign
--   label without this file.
--
-- STATUS: NOT APPLIED. Run it against the shadow DB before any cutover.
--
-- HOW TO RUN
--   Every statement is idempotent (IF NOT EXISTS); re-running the file is
--   safe. Nothing here reads `origen_email` in the same script, so — unlike
--   MIGRACION-ALERTAS-2026-08-30.sql, which had to split STEP 1/STEP 2 across
--   two runs because its STEP 2 rewrote a view that referenced the new enum
--   value — a single-shot run of STEP 1 below is sufficient.
--
-- ROLLBACK
--   Enum values cannot be dropped in Postgres; leaving 'bulk' in place is
--   harmless if this change is reverted. The `nombre` column can be dropped
--   manually (`ALTER TABLE envios_emails DROP COLUMN nombre;`) if needed —
--   no other object depends on it.
-- ============================================================


-- ============================================================
-- STEP 1 — enum + column
-- ============================================================

-- n8n's bulk-send fan-out (L0d0Nj24XosJI0HB) writes Origen = 'bulk' on every
-- queue row it creates from a campaign. Cola de Emails and Envios de Emails
-- share this one enum.
ALTER TYPE origen_email ADD VALUE IF NOT EXISTS 'bulk';

-- Campaign label. `descripcion` already exists on envios_emails (free-text
-- notes) and overloading it would collide with the distinct Airtable
-- `Descripcion` field of the same purpose — `nombre` is a separate column,
-- matching Airtable's `Nombre` field.
ALTER TABLE envios_emails ADD COLUMN IF NOT EXISTS nombre TEXT;


-- ============================================================
-- POST-APPLY CHECKS — run these and record the output here
-- ============================================================
-- 1) Enum landed:
--      SELECT unnest(enum_range(NULL::origen_email));   -- includes 'bulk'
--
-- 2) Column landed:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'envios_emails' AND column_name = 'nombre';
