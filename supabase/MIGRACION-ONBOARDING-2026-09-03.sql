-- ============================================================
-- MIGRACION-ONBOARDING-2026-09-03
-- Adds the `onboarding` table (Airtable "Onboarding (form)" tblyBkdLq0Ja06CH6).
--
-- Idempotent: safe to re-run. Mirrors dashboard/supabase/schema.sql section 4c
-- plus its three RLS statements from section 7. Apply to the shadow DB; schema.sql
-- is a clean-install script and is never re-executed against a provisioned DB.
-- ============================================================

CREATE TABLE IF NOT EXISTS onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE,
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,
  tshirt_size TEXT,
  tshirt_kind TEXT,
  tshirt_name TEXT,
  welcome_book_language TEXT,
  instagram_consent TEXT,
  instagram_username TEXT,
  timestamp_form TIMESTAMPTZ,
  respuestas_formulario JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_timestamp ON onboarding(timestamp_form DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_alumno ON onboarding(alumno_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_airtable ON onboarding(airtable_id);

-- RLS: all three statements are required. Without the policy OR without the
-- GRANT, select() under the anon key returns ZERO ROWS with error === null.
ALTER TABLE onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON onboarding;
CREATE POLICY "Allow all for anon" ON onboarding FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT SELECT ON onboarding TO anon, authenticated, service_role;

-- Verification (must return > 0 after a migrator run):
--   SELECT count(*) FROM onboarding;
--   SELECT count(*) FROM onboarding WHERE alumno_id IS NULL;  -- see design D-A5
