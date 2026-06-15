-- ============================================================
-- ProEv Supabase — SCHEMA GAP PATCH (DRAFT — DO NOT APPLY YET)
-- ============================================================
-- Purpose: define the columns/tables that block activating the n8n
--          Supabase twins (Alertas + Nueva Inscripcion).
--
-- STATUS: DRAFT. Nothing here has been applied to any DB.
--         Confirm the OPEN QUESTIONS in MIGRACION-SCHEMA-GAPS.md
--         BEFORE running any of this in the Supabase SQL Editor.
--
-- Authoritative sources captured per block:
--   - n8n workflow 86TaFQgNjXIFP2rA  ([Schedule] Alertas - Detectar Alumnos en Riesgo)
--   - n8n workflow kWDjtwTRmQfUC0B5  ([Airtable] Nueva Inscripcion)
--   - Airtable live data PAT (read-only) on base app4ZpoxaWOyV4RnR
--   - Existing schema.sql (alumnos / historial / alumnos_enriched view)
--
-- KEY CONSTRAINT discovered (finding #2): the n8n twins filter the
-- BASE TABLE `alumnos` via PostgREST (e.g. `alerta_activa=not.is.null`),
-- NOT the `alumnos_enriched` VIEW. A column that lives ONLY in the view
-- is INVISIBLE to the twin's filter. Therefore alerta_activa /
-- dias_desde_ultimo_evento are proposed as GENERATED / trigger-maintained
-- columns ON the base table (Approach A), with a view-only fallback
-- (Approach B) kept commented for the case where the twin is repointed
-- to alumnos_enriched. Pick ONE per gap after confirming the OQs.
-- ============================================================


-- ============================================================
-- GAP 2 (do first — dias_desde_ultimo_evento feeds GAP 1)
-- alumnos.dias_desde_ultimo_evento
-- ============================================================
-- SOURCE: Airtable formula field "Dias desde Ultimo Evento" (INT).
--   Live samples: 3, 80, 6, 7, 104  -> small non-negative integers.
--   Read by Alertas twin Code node as alumno['Dias desde Ultimo Evento'].
-- DEFINITION (inferred): whole days between now() and the alumno's most
--   recent historial.created_at. (Airtable "ultimo evento" == newest row
--   in the linked Historial table.)  See OQ-2 in the .md.
--
-- WHY NOT a GENERATED column: Postgres GENERATED ALWAYS columns are
--   STORED and may only reference columns of the SAME row — they cannot
--   aggregate historial. And a "days since" value is time-relative, so it
--   would be stale the moment it's stored. => must be a VIEW expression
--   OR a trigger-refreshed column.
--
-- APPROACH A (base-table, twin-visible): plain INT column refreshed by a
--   trigger on historial INSERT + a daily cron (pg_cron) recompute.
--   Use this ONLY if the Alertas twin filters/reads the base table.
-- ------------------------------------------------------------
ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS dias_desde_ultimo_evento INT;  -- nullable: NULL = no historial yet

-- Recompute function (idempotent). Counts whole days since newest historial row.
CREATE OR REPLACE FUNCTION refresh_dias_desde_ultimo_evento(p_alumno_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE alumnos a
  SET dias_desde_ultimo_evento = sub.dias
  FROM (
    SELECT al.id AS alumno_id,
           CASE WHEN MAX(h.created_at) IS NULL THEN NULL
                ELSE (CURRENT_DATE - MAX(h.created_at)::date)
           END AS dias
    FROM alumnos al
    LEFT JOIN historial h ON h.alumno_id = al.id
    WHERE p_alumno_id IS NULL OR al.id = p_alumno_id
    GROUP BY al.id
  ) sub
  WHERE a.id = sub.alumno_id
    AND a.dias_desde_ultimo_evento IS DISTINCT FROM sub.dias;
END;
$$ LANGUAGE plpgsql;

-- Trigger: when a historial row is added, refresh that alumno's counter.
CREATE OR REPLACE FUNCTION trg_historial_refresh_dias()
RETURNS trigger AS $$
BEGIN
  PERFORM refresh_dias_desde_ultimo_evento(NEW.alumno_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS historial_refresh_dias ON historial;
CREATE TRIGGER historial_refresh_dias
  AFTER INSERT OR UPDATE OF created_at, alumno_id ON historial
  FOR EACH ROW EXECUTE FUNCTION trg_historial_refresh_dias();

-- Daily recompute so the "days since" advances even with no new events.
-- Requires the pg_cron extension (enable in Supabase Dashboard > Database > Extensions).
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('refresh-dias-evento', '5 0 * * *',
--                      $$SELECT refresh_dias_desde_ultimo_evento();$$);

-- One-time backfill after creating the column:
-- SELECT refresh_dias_desde_ultimo_evento();


-- ============================================================
-- GAP 1 — alumnos.alerta_activa  (CORE of the Alertas twin)
-- ============================================================
-- SOURCE: Airtable FORMULA field "Alerta Activa" (TEXT).
--   Live sample value: "🥶 Alumno Frío"  (emoji + label, single string).
--   Empty string when no alert.
-- TWIN USAGE (86TaFQgNjXIFP2rA):
--   filterByFormula: AND({Alerta Activa} != '', {Estado General} != 'Finalizado',
--                        {Estado General} != 'Rechazado')
--   Code node branches on substrings of {Alerta Activa}:
--     .includes('Alumno Fr')        -> seguimiento_frio   (label "Alumno Frío")
--     .includes('Pago Pendiente')   -> recordatorio_pago
--     .includes('Video sin Revisar')-> (no email; notify reviewer)
--   => alerta_activa is a human-readable label string, NOT a boolean.
--
-- INFERRED FORMULA (low confidence — exact Airtable formula is NOT
--   readable via the data PAT; reconstructed from the 3 known labels +
--   the "dias desde ultimo evento" signal). CONFIRM via OQ-1.
--     - "Alumno Frío"        when dias_desde_ultimo_evento > 7
--                            AND estado_general in active/early states
--     - "Pago Pendiente"     when estado_general = 'Pendiente de pago'
--                            AND days in that state exceeded a threshold
--     - "Video sin Revisar"  when a revision has been pending too long
--
-- WHY NOT a GENERATED column: it depends on dias_desde_ultimo_evento
--   (which itself aggregates historial) and on revisiones_video state,
--   i.e. cross-table — a STORED GENERATED column cannot do that.
--
-- APPROACH A (base-table, twin-visible): TEXT column maintained by the
--   same recompute path as GAP 2. Twin filter becomes
--   `alerta_activa=not.is.null` (or `neq.`) on the base table.
-- ------------------------------------------------------------
ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS alerta_activa TEXT;  -- NULL/'' = no active alert

-- DRAFT recompute. THE THRESHOLDS AND CONDITIONS ARE ASSUMPTIONS (OQ-1).
-- Emits the FIRST matching label, mirroring the if/else-if order in the
-- twin Code node. Returns NULL when no rule fires.
CREATE OR REPLACE FUNCTION refresh_alerta_activa(p_alumno_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE alumnos a
  SET alerta_activa = (
    CASE
      -- "Pago Pendiente": stuck awaiting payment   [THRESHOLD ASSUMED]
      WHEN a.estado_general = 'Pendiente de pago'
           AND COALESCE(a.dias_desde_ultimo_evento, 0) >= 3
        THEN '⏳ Pago Pendiente'
      -- "Video sin Revisar": has a pending revision that's aged  [ASSUMED]
      WHEN EXISTS (
             SELECT 1 FROM revisiones_video rv
             WHERE rv.alumno_id = a.id
               AND rv.estado_revision = 'Pendiente'
               AND rv.created_at < now() - INTERVAL '3 days'
           )
        THEN '📹 Video sin Revisar'
      -- "Alumno Frío": no recent activity   [THRESHOLD ASSUMED >7 days]
      WHEN COALESCE(a.dias_desde_ultimo_evento, 0) > 7
           AND a.estado_general NOT IN ('Finalizado','Rechazado','Privado')
        THEN '🥶 Alumno Frío'
      ELSE NULL
    END
  )
  WHERE (p_alumno_id IS NULL OR a.id = p_alumno_id);
END;
$$ LANGUAGE plpgsql;

-- Chain GAP1 off GAP2's refresh: easiest is to also recompute alerta_activa
-- in the daily cron AND inside the historial trigger. Append to the trigger fn:
--   PERFORM refresh_alerta_activa(NEW.alumno_id);
-- (left out of the trigger above to keep GAP2 independently reviewable —
--  wire it in once OQ-1 thresholds are confirmed.)
-- Daily cron line (with GAP2):
--   SELECT cron.schedule('refresh-alertas', '10 0 * * *',
--          $$SELECT refresh_dias_desde_ultimo_evento(); SELECT refresh_alerta_activa();$$);

-- ------------------------------------------------------------
-- APPROACH B (VIEW-only) — use INSTEAD of Approach A's column ONLY if you
-- repoint the Alertas twin to read/filter `alumnos_enriched` (a PostgREST
-- view IS filterable, but RLS/permissions differ). If you take this path,
-- DROP the base-table columns above and instead extend the view:
-- ------------------------------------------------------------
-- CREATE OR REPLACE VIEW alumnos_enriched AS
-- SELECT
--   a.*,
--   e.nombre AS edicion_nombre,
--   /* ... existing rev_stats / pago_stats columns ... */,
--   -- GAP 2 derived in-view (always fresh, no trigger needed):
--   (SELECT (CURRENT_DATE - MAX(h.created_at)::date)
--      FROM historial h WHERE h.alumno_id = a.id)          AS dias_desde_ultimo_evento,
--   -- GAP 1 derived in-view (thresholds = OQ-1):
--   CASE
--     WHEN a.estado_general = 'Pendiente de pago' THEN '⏳ Pago Pendiente'
--     WHEN (SELECT (CURRENT_DATE - MAX(h.created_at)::date)
--             FROM historial h WHERE h.alumno_id = a.id) > 7
--          AND a.estado_general NOT IN ('Finalizado','Rechazado','Privado')
--       THEN '🥶 Alumno Frío'
--     ELSE NULL
--   END                                                    AS alerta_activa
-- FROM alumnos a
-- LEFT JOIN ediciones e ON a.edicion_id = e.id
-- /* ... existing LATERAL joins ... */;


-- ============================================================
-- GAP 3 — alumnos.modules
-- ============================================================
-- SOURCE: Airtable field "Modules" (ARRAY of strings), DISTINCT from
--   "Modulo Solicitado" (single text) and "Modulos Completados" (array
--   "1"/"2"/"3", already mapped to alumnos.modulos_completados).
--   Live samples of "Modules":
--     ["Module 1"]
--     ["Module 1","Modules 1 and 2"]
--     ["Modules 1 + 2 + 3"]
--     ["Modules 1","2 and 3"]
--   i.e. the RAW multi-select answers from the inscription form, NOT the
--   normalized "Modulo Solicitado". In the Nueva Inscripcion twin's
--   Crear Alumno schema "Modules" is marked readOnly + removed (it is an
--   Airtable rollup/lookup from the form, not a writable field).
-- DEFINITION: rollup of the raw module selections; plain string array.
-- APPROACH: plain TEXT[] column on the base table, loaded by the migrator
--   from Airtable "Modules". No derivation needed.  (See OQ-3: confirm
--   whether any twin actually READS alumnos.modules, or if this is purely
--   for dashboard display / migrator parity. If nothing reads it, this
--   column is optional.)
-- ------------------------------------------------------------
ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS modules TEXT[];  -- raw form module selections (rollup from Inscripcion form)


-- ============================================================
-- GAP 4 — TABLE inscripciones  (form-intake; Nueva Inscripcion twin trigger)
-- ============================================================
-- SOURCE: Airtable table tbl6I5p5adeeGDv2S "Inscripcion (form)".
--   Twin kWDjtwTRmQfUC0B5 uses airtableTrigger on this table,
--   triggerField = "Timestamp" (new row => create alumno + send email).
--   The Supabase twin must instead poll/trigger on this table in Supabase.
-- LIVE FIELD KEYS (scanned 50 records) and how the twin reads them:
--   Timestamp                      -> trigger field (ISO datetime)
--   Email                          -> alumno email (dedupe key)
--   Full Name                      -> alumno name   (NOTE: twin code reads
--                                     f.Nombre; live field is "Full Name" — OQ-4a)
--   Email Pareja                   -> partner linking (Modulo 3)
--   Phone Number                   -> alumno phone
--   "Which modules ... attend?"    -> array; mapped to Modulo Solicitado
--   "What country are you come from?" -> mapped to Idioma (ES/EN)
--   Are you leader or follower?
--   Do you currently teach bachata classes?
--   Have you taken any training ... ?
--   How long have you been dancing?
--   How often do you take dance classes?
--   What do you expect from this course?
--   What do you want to improve the most?
--   What other dance styles do you practice?
--   What would you say is your dance level?
--   "If you are filling out this form during the pre-launch period ..." (discount code)
--   Ultima Modificacion            -> Airtable last-modified (datetime)
--   Alumnos                        -> link back to created Alumno (dedupe guard)
--
-- DESIGN CHOICE: the long question strings are kept as a single JSONB
--   `respuestas_formulario` blob (Tally questions are volatile / verbose),
--   with the handful of fields the twin actually consumes promoted to
--   typed columns. CONFIRM column set vs JSONB split in OQ-4b.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE,                       -- Airtable record id of the form row
  -- Trigger / dedupe
  timestamp_form TIMESTAMPTZ,                    -- Airtable "Timestamp" (twin trigger field)
  ultima_modificacion TIMESTAMPTZ,               -- Airtable "Ultima Modificacion"
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,  -- "Alumnos" link (set after creation; dedupe guard)
  -- Fields the twin consumes directly
  email TEXT,                                    -- "Email"
  full_name TEXT,                                -- "Full Name"  (twin reads as Nombre — see OQ-4a)
  email_pareja TEXT,                             -- "Email Pareja"
  phone_number TEXT,                             -- "Phone Number"
  modules TEXT[],                                -- "Which modules would you like to attend?"
  pais TEXT,                                     -- "What country are you come from?" (-> Idioma)
  codigo_descuento TEXT,                         -- prelaunch discount code field
  -- Everything else from the (volatile) Tally form, verbatim:
  respuestas_formulario JSONB,                   -- all remaining question/answer pairs
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inscripciones_timestamp ON inscripciones(timestamp_form DESC);
CREATE INDEX IF NOT EXISTS idx_inscripciones_email ON inscripciones(email);
CREATE INDEX IF NOT EXISTS idx_inscripciones_alumno ON inscripciones(alumno_id);

-- Audit + RLS to match the rest of the schema (only if you mirror those patterns):
-- ALTER TABLE inscripciones ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for anon" ON inscripciones FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE TRIGGER audit_inscripciones AFTER INSERT OR UPDATE OR DELETE ON inscripciones
--   FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();


-- ============================================================
-- GAP 5 (OPTIONAL) — cola_emails.envio_id FK -> envios_emails
-- ============================================================
-- Currently cola_emails has alumno_id but NO link to envios_emails (the
-- bulk-send batch). envios_emails.alumnos_ids is a UUID[] (denormalized).
-- Adding a per-row FK would let a queued email point at the batch that
-- spawned it. NO twin requires this today => commented out, optional.
-- OQ-5: does any bulk-send twin need to write/read this back-reference?
-- ------------------------------------------------------------
-- ALTER TABLE cola_emails
--   ADD COLUMN IF NOT EXISTS envio_id UUID REFERENCES envios_emails(id) ON DELETE SET NULL;
-- CREATE INDEX IF NOT EXISTS idx_cola_emails_envio ON cola_emails(envio_id);

-- ============================================================
-- END DRAFT — nothing above has been applied. Review the .md OPEN QUESTIONS.
-- ============================================================
