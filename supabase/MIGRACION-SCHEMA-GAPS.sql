-- ============================================================
-- ProEv Supabase — SCHEMA GAP PATCH
-- ============================================================
-- Purpose: define the columns/views that block activating the n8n
--          Supabase twins (Alertas + Nueva Inscripcion).
--
-- STATUS:
--   - alerta_activa block (GAP 1 + GAP 2 below): APPLIED to the SHADOW
--     Supabase DB on 2026-06-15 (project qktvdmoggniufynaodzq, EU-North-1).
--     Applied transactionally; verified; committed. Airtable is still
--     primary, so the shadow DB does not serve production yet.
--   - GAP 3 / GAP 4 / GAP 5 below: STILL DRAFTS — not applied. Confirm
--     OPEN QUESTIONS in MIGRACION-SCHEMA-GAPS.md before running them.
--
-- Authoritative sources captured per block:
--   - Airtable formula "Alerta Activa" (confirmed by David, see GAP 1)
--   - n8n workflow 86TaFQgNjXIFP2rA  ([Schedule] Alertas - Detectar Alumnos en Riesgo)
--   - n8n workflow kWDjtwTRmQfUC0B5  ([Airtable] Nueva Inscripcion)
--   - Airtable live data PAT (read-only) on base app4ZpoxaWOyV4RnR
--   - Existing schema (alumnos / historial / alumnos_enriched view)
-- ============================================================
--
-- DESIGN DECISION (applied): alerta_activa + the two day-counts live in
-- the `alumnos_enriched` VIEW, NOT as stored columns on the base table.
-- A view recomputes on every read, so the time-relative day-counts are
-- ALWAYS fresh with NO cron / no trigger drift. The only stored fact is
-- `alumnos.fecha_cambio_estado` (set by a BEFORE trigger when estado
-- changes), because the DB has no estado-change timestamp otherwise.
--
-- TWIN NOTE: the Alertas twin (86TaFQgNjXIFP2rA) currently filters the
-- BASE TABLE `alumnos` via PostgREST. To consume `alerta_activa` it must
-- be REPOINTED to read the `alumnos_enriched` view (PostgREST exposes the
-- view in the public schema; SELECT granted to anon/authenticated/
-- service_role). That repoint is a SEPARATE step (n8n #16), NOT done here.
-- ============================================================


-- ============================================================
-- APPLIED: alumnos.fecha_cambio_estado  (the one stored fact)
-- ============================================================
-- The DB has no estado-change timestamp. We add one column and keep it
-- maintained by a BEFORE INSERT OR UPDATE trigger that stamps now()
-- whenever estado_general changes.
-- ------------------------------------------------------------
ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS fecha_cambio_estado timestamptz;

CREATE OR REPLACE FUNCTION public.set_fecha_cambio_estado()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.fecha_cambio_estado IS NULL THEN
      NEW.fecha_cambio_estado := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.estado_general IS DISTINCT FROM OLD.estado_general THEN
      NEW.fecha_cambio_estado := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_set_fecha_cambio_estado ON public.alumnos;
CREATE TRIGGER trg_set_fecha_cambio_estado
  BEFORE INSERT OR UPDATE ON public.alumnos
  FOR EACH ROW EXECUTE FUNCTION public.set_fecha_cambio_estado();

-- Backfill existing rows (best-effort / APPROXIMATE): newest
-- "Actualización de Estado" historial row, else updated_at, else created_at.
-- NOTE: in the shadow DB every updated_at was the migration date, so every
-- backfilled fecha_cambio_estado collapsed to the load date => all
-- dias_en_estado_actual = 0 until estados age naturally via the trigger or
-- real Airtable timestamps are migrated. The Pago/Video thresholds will
-- not fire on freshly-loaded data; this is expected, not a logic bug.
UPDATE public.alumnos a SET fecha_cambio_estado = COALESCE(
  (SELECT max(h.created_at) FROM public.historial h
     WHERE h.alumno_id = a.id AND h.tipo_accion = 'Actualización de Estado'),
  a.updated_at, a.created_at)
WHERE a.fecha_cambio_estado IS NULL;


-- ============================================================
-- APPLIED: alumnos_enriched VIEW extended with 3 derived alert fields
-- ============================================================
-- Mirrors the authoritative Airtable "Alerta Activa" formula (confirmed
-- by David):
--   IF(AND(EstadoGeneral != "Finalizado", != "Rechazado",
--          DiasDesdeUltimoEvento >= 7), "🥶 Alumno Frío",
--    IF(AND(EstadoGeneral = "Pendiente de pago", DiasEnEstado >= 5),
--          "💳 Pago Pendiente",
--     IF(AND(EstadoGeneral = "En revisión de video", DiasEnEstado >= 3),
--          "🎥 Video sin Revisar", "")))
--
-- Enum strings verified against the live estado_general enum:
--   'Finalizado', 'Rechazado', 'Pendiente de pago', 'En revisión de video'
--   (tilde on "revisión", none on "video").
--
-- dias_desde_ultimo_evento: now() - newest historial.created_at for the
--   alumno; NULL (no events) -> 9999 so "no events" counts as cold,
--   matching the Airtable intent (>= 7 => frío).
-- dias_en_estado_actual: now() - fecha_cambio_estado.
--
-- The view keeps ALL pre-existing columns verbatim (CREATE OR REPLACE
-- requires the leading column set to be unchanged) and APPENDS the 3
-- derived fields at the end.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.alumnos_enriched AS
 SELECT a.id,
    a.airtable_id,
    a.nombre,
    a.email,
    a.telefono,
    a.estado_general,
    a.idioma,
    a.modulo_solicitado,
    a.modulos_completados,
    a.edicion_id,
    a.foto_perfil,
    a.plazo_revision,
    a.fecha_plazo,
    a.fecha_preinscripcion,
    a.modulo_reserva,
    a.fecha_entrada_reserva,
    a.pareja_email,
    a.pareja_alumno_id,
    a.onboarding_enviado,
    a.bloqueado_proev26,
    a.disculpa_enviada,
    a.prelanzamiento_enviado,
    a.followup_prelanzamiento,
    a.engagement_score,
    a.resumen_feedback_ia,
    a.siguiente_accion_ia,
    a.notas_internas,
    a.admin_responsable,
    a.created_at,
    a.updated_at,
    e.nombre AS edicion_nombre,
    COALESCE(rev_stats.total_revisiones, 0) AS total_revisiones,
    rev_stats.ultima_fecha_revision,
    rev_stats.estado_revision_reciente,
    rev_stats.puntuacion_video,
    COALESCE(pago_stats.total_pagos, 0) AS total_pagos,
    COALESCE(pago_stats.importe_total_pagado, 0::numeric) AS importe_total_pagado,
    pago_stats.fecha_ultimo_pago,
    -- derived alert fields (always fresh on read; no cron)
    COALESCE((now()::date - (SELECT max(h.created_at)::date FROM public.historial h WHERE h.alumno_id = a.id)), 9999) AS dias_desde_ultimo_evento,
    (now()::date - a.fecha_cambio_estado::date) AS dias_en_estado_actual,
    CASE
      WHEN a.estado_general <> 'Finalizado'::estado_general
       AND a.estado_general <> 'Rechazado'::estado_general
       AND COALESCE((now()::date - (SELECT max(h.created_at)::date FROM public.historial h WHERE h.alumno_id = a.id)), 9999) >= 7
        THEN '🥶 Alumno Frío'
      WHEN a.estado_general = 'Pendiente de pago'::estado_general
       AND (now()::date - a.fecha_cambio_estado::date) >= 5
        THEN '💳 Pago Pendiente'
      WHEN a.estado_general = 'En revisión de video'::estado_general
       AND (now()::date - a.fecha_cambio_estado::date) >= 3
        THEN '🎥 Video sin Revisar'
      ELSE ''
    END AS alerta_activa
   FROM alumnos a
     LEFT JOIN ediciones e ON a.edicion_id = e.id
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS total_revisiones,
            max(r.created_at) AS ultima_fecha_revision,
            (( SELECT rv.estado_revision
                   FROM revisiones_video rv
                  WHERE rv.alumno_id = a.id
                  ORDER BY rv.created_at DESC
                 LIMIT 1))::text AS estado_revision_reciente,
            ( SELECT rv.puntuacion
                   FROM revisiones_video rv
                  WHERE rv.alumno_id = a.id
                  ORDER BY rv.created_at DESC
                 LIMIT 1) AS puntuacion_video
           FROM revisiones_video r
          WHERE r.alumno_id = a.id) rev_stats ON true
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS total_pagos,
            COALESCE(sum(
                CASE
                    WHEN p.estado_pago = ANY (ARRAY['Completado'::estado_pago, 'Pagado'::estado_pago]) THEN p.importe
                    ELSE 0::numeric
                END), 0::numeric) AS importe_total_pagado,
            max(p.created_at) AS fecha_ultimo_pago
           FROM pagos p
          WHERE p.alumno_id = a.id) pago_stats ON true;

-- Verified post-apply on shadow DB (2026-06-15):
--   alumnos_enriched columns 38 -> 41 (all 38 prior columns preserved).
--   alerta_activa distribution: '' = 141, '🥶 Alumno Frío' = 2.
--   0 inconsistent Pago/Video rows vs the formula.
--   PostgREST sees the view (SELECT granted, public schema).


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
-- END — GAP 3/4/5 above are STILL DRAFTS (not applied). The alerta_activa
-- block at the TOP of this file IS applied. Review the .md OPEN QUESTIONS
-- before running GAP 3/4/5.
-- ============================================================
