-- =============================================================================
-- MIGRACION-DB-WEBHOOKS.sql
-- Supabase Database Webhooks that drive the 9 ProEv n8n twins replacing the
-- original airtableTrigger workflows.
--
-- Generated: 2026-06-15.  Target: SHADOW Supabase DB (aws-1-eu-north-1 pooler).
--
-- -----------------------------------------------------------------------------
-- !!! CUTOVER INSTRUCTIONS — READ BEFORE TOUCHING PRODUCTION !!!
-- -----------------------------------------------------------------------------
-- These 9 triggers are created **DISABLED** on purpose.  During SHADOW mode the
-- twins must NOT fire (Airtable is still the system of record and the n8n twins
-- are inactive).  Enabling a trigger here would POST to the twin webhooks for
-- every matching row mutation -> double-processing / side effects.
--
-- AT CUTOVER (and only then), per twin:
--   1. Activate the corresponding [SB-TWIN] workflow in n8n (so its /webhook/<path>
--      endpoint goes live; until activated, n8n returns 404).
--   2. ENABLE the matching trigger:
--          ALTER TABLE <table> ENABLE TRIGGER <trigger_name>;
--   3. Smoke-test one row, confirm exactly one twin execution, no loop.
--
-- TO ROLL BACK (re-enter shadow / pause a twin):
--          ALTER TABLE <table> DISABLE TRIGGER <trigger_name>;
--
-- -----------------------------------------------------------------------------
-- MECHANISM
-- -----------------------------------------------------------------------------
-- The shadow DB does NOT have the Supabase-managed `supabase_functions.http_request`
-- wrapper (no `supabase_functions` schema present). It DOES have `pg_net` available
-- (v0.20.0, self-enablable as role `postgres`). We therefore call `net.http_post`
-- directly — this is the same primitive the Supabase Dashboard "Database Webhooks"
-- feature compiles down to. The payload shape `{type, table, record, old_record}`
-- mirrors Supabase's standard webhook body, which is exactly what the twin
-- downstream nodes expect (`$json.body.record.*`, `$json.body.old_record.*`).
--
-- net.http_post is ASYNC (fire-and-forget; response lands in net._http_response).
-- A failed POST never blocks/rolls back the originating DML. timeout 5000 ms.
--
-- IDEMPOTENT: CREATE EXTENSION IF NOT EXISTS / CREATE OR REPLACE FUNCTION /
-- DROP TRIGGER IF EXISTS before CREATE TRIGGER. Safe to re-run.
-- =============================================================================

BEGIN;

-- pg_net is available but not installed on the shadow DB; install it (Supabase
-- pins it to the `extensions` schema). net.http_post / net._http_response live in
-- the `net` schema regardless.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Base URL of the EasyPanel n8n that hosts the twins. Each twin's webhook URL is
-- {base}/webhook/{path}. Centralised here as a comment for auditability:
--   base = https://drava-n8n.lk0nyk.easypanel.host

-- Shared header set (JSON content type). No auth header: the twin webhooks are
-- unauthenticated POST nodes (n8n webhook path acts as the shared secret).

-- =============================================================================
-- #3  Estado Leido — twin QTTxz42B9Ml8yVkC
--   table : public.inbox            event : UPDATE
--   fire  : estado='Leido' AND direccion='Recibido' AND message_id<>''
--           AND gmail_leido = false
--   guard : self-write sets gmail_leido=true -> fire condition (gmail_leido=false)
--           becomes false on the re-fired UPDATE. No loop.
--   url   : https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-inbox-estado-leido
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_sbwh_inbox_estado_leido()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.estado = 'Leido'
      AND NEW.direccion = 'Recibido'
      AND COALESCE(NEW.message_id, '') <> ''
      AND COALESCE(NEW.gmail_leido, false) = false
      AND COALESCE(OLD.gmail_leido, false) = false) THEN
    PERFORM net.http_post(
      url     := 'https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-inbox-estado-leido',
      body    := jsonb_build_object('type','UPDATE','table','inbox',
                   'record', to_jsonb(NEW), 'old_record', to_jsonb(OLD)),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sbwh_inbox_estado_leido ON public.inbox;
CREATE TRIGGER sbwh_inbox_estado_leido
  AFTER UPDATE ON public.inbox
  FOR EACH ROW EXECUTE FUNCTION public.tg_sbwh_inbox_estado_leido();
ALTER TABLE public.inbox DISABLE TRIGGER sbwh_inbox_estado_leido;

-- =============================================================================
-- #6  Estado Eliminado — twin cDszir6TGOldTLfS
--   table : public.inbox            event : INSERT + UPDATE
--   fire  : estado='Eliminado' AND thread_id IS NOT NULL AND thread_id<>''
--           AND gmail_eliminado IS NOT true
--   guard : self-write sets gmail_eliminado=true -> fire requires NOT true,
--           so re-fired event is dropped. No loop.
--   url   : .../webhook/sb-estado-eliminado-papelera
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_sbwh_inbox_estado_eliminado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.estado = 'Eliminado'
      AND NEW.thread_id IS NOT NULL
      AND NEW.thread_id <> ''
      AND NEW.gmail_eliminado IS NOT TRUE) THEN
    PERFORM net.http_post(
      url     := 'https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-estado-eliminado-papelera',
      body    := jsonb_build_object('type', TG_OP, 'table','inbox',
                   'record', to_jsonb(NEW),
                   'old_record', CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE 'null'::jsonb END),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sbwh_inbox_estado_eliminado ON public.inbox;
CREATE TRIGGER sbwh_inbox_estado_eliminado
  AFTER INSERT OR UPDATE ON public.inbox
  FOR EACH ROW EXECUTE FUNCTION public.tg_sbwh_inbox_estado_eliminado();
ALTER TABLE public.inbox DISABLE TRIGGER sbwh_inbox_estado_eliminado;

-- =============================================================================
-- #10 Respuesta Final — twin MxkkVlHoQ4GRXXDL
--   table : public.inbox            event : UPDATE
--   fire  : respuesta_final IS NOT NULL AND respuesta_final<>''
--           AND respuesta_enviada=false AND direccion='Recibido'
--   guard : self-write sets respuesta_enviada=true -> fire (=false) false.
--           Plus column-changed guard (avoid re-fire on unrelated updates).
--   url   : .../webhook/sb-respuesta-final-reply
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_sbwh_inbox_respuesta_final()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.respuesta_final IS NOT NULL
      AND NEW.respuesta_final <> ''
      AND COALESCE(NEW.respuesta_enviada, false) = false
      AND NEW.direccion = 'Recibido'
      AND (OLD.respuesta_enviada IS DISTINCT FROM NEW.respuesta_enviada
           OR OLD.respuesta_final IS DISTINCT FROM NEW.respuesta_final)) THEN
    PERFORM net.http_post(
      url     := 'https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-respuesta-final-reply',
      body    := jsonb_build_object('type','UPDATE','table','inbox',
                   'record', to_jsonb(NEW), 'old_record', to_jsonb(OLD)),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sbwh_inbox_respuesta_final ON public.inbox;
CREATE TRIGGER sbwh_inbox_respuesta_final
  AFTER UPDATE ON public.inbox
  FOR EACH ROW EXECUTE FUNCTION public.tg_sbwh_inbox_respuesta_final();
ALTER TABLE public.inbox DISABLE TRIGGER sbwh_inbox_respuesta_final;

COMMIT;

BEGIN;

-- =============================================================================
-- #14 Emails segun Estado — twin GZMY1flgIfw7mN4C
--   table : public.alumnos          event : UPDATE
--   fire  : estado_general IN ('En revisión de video','Aprobado','Rechazado',
--           'Reserva','Plazo Vencido','Pago Fallido')
--           AND estado_general IS DISTINCT FROM OLD.estado_general
--   guard : self-write sets estado_general='Pendiente de pago' (NOT in the
--           allowlist) -> no retrigger.
--   url   : .../webhook/sb-emails-segun-estado
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_sbwh_alumnos_emails_estado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.estado_general IN ('En revisión de video','Aprobado','Rechazado',
                             'Reserva','Plazo Vencido','Pago Fallido')
      AND NEW.estado_general IS DISTINCT FROM OLD.estado_general) THEN
    PERFORM net.http_post(
      url     := 'https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-emails-segun-estado',
      body    := jsonb_build_object('type','UPDATE','table','alumnos',
                   'record', to_jsonb(NEW), 'old_record', to_jsonb(OLD)),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sbwh_alumnos_emails_estado ON public.alumnos;
CREATE TRIGGER sbwh_alumnos_emails_estado
  AFTER UPDATE ON public.alumnos
  FOR EACH ROW EXECUTE FUNCTION public.tg_sbwh_alumnos_emails_estado();
ALTER TABLE public.alumnos DISABLE TRIGGER sbwh_alumnos_emails_estado;

-- =============================================================================
-- #17 Alumno Pagado Onboarding — twin T9zLpcIboZvTlhe1
--   table : public.alumnos          event : INSERT + UPDATE
--   fire  : estado_general='Pagado' AND onboarding_enviado=false
--   guard : self-write sets onboarding_enviado=true -> fire (=false) becomes
--           false on the re-fired event. No loop.
--   url   : .../webhook/sb-onboarding
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_sbwh_alumnos_onboarding()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.estado_general = 'Pagado'
      AND COALESCE(NEW.onboarding_enviado, false) = false) THEN
    PERFORM net.http_post(
      url     := 'https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-onboarding',
      body    := jsonb_build_object('type', TG_OP, 'table','alumnos',
                   'record', to_jsonb(NEW),
                   'old_record', CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE 'null'::jsonb END),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sbwh_alumnos_onboarding ON public.alumnos;
CREATE TRIGGER sbwh_alumnos_onboarding
  AFTER INSERT OR UPDATE ON public.alumnos
  FOR EACH ROW EXECUTE FUNCTION public.tg_sbwh_alumnos_onboarding();
ALTER TABLE public.alumnos DISABLE TRIGGER sbwh_alumnos_onboarding;

-- =============================================================================
-- #18 Envio Masivo — twin Hhc5F2Y8UKpYihrb
--   table : public.envios_emails    event : INSERT + UPDATE
--   fire  : estado='Pendiente' AND mensaje IS NOT NULL AND mensaje<>''
--           AND array_length(alumnos_ids,1) >= 1
--   guard : self-writes set estado Procesando/Completado/Error (not 'Pendiente')
--           -> fire requires estado='Pendiente'; on UPDATE also require
--           OLD.estado IS DISTINCT FROM NEW.estado. No loop.
--   url   : .../webhook/sb-envio-masivo-crear-cola
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_sbwh_envios_masivo()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.estado = 'Pendiente'
      AND NEW.mensaje IS NOT NULL AND NEW.mensaje <> ''
      AND COALESCE(array_length(NEW.alumnos_ids, 1), 0) >= 1
      AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado)) THEN
    PERFORM net.http_post(
      url     := 'https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-envio-masivo-crear-cola',
      body    := jsonb_build_object('type', TG_OP, 'table','envios_emails',
                   'record', to_jsonb(NEW),
                   'old_record', CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE 'null'::jsonb END),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sbwh_envios_masivo ON public.envios_emails;
CREATE TRIGGER sbwh_envios_masivo
  AFTER INSERT OR UPDATE ON public.envios_emails
  FOR EACH ROW EXECUTE FUNCTION public.tg_sbwh_envios_masivo();
ALTER TABLE public.envios_emails DISABLE TRIGGER sbwh_envios_masivo;

-- =============================================================================
-- #19 Cola Email Procesar — twin ZpTKSzQJeMDowOM1
--   table : public.cola_emails      event : INSERT + UPDATE
--   fire  : estado IN ('Pendiente','Enviando') AND mensaje<>''
--           AND alumno_id IS NOT NULL AND fecha_envio IS NULL
--   guard : workflow sets Enviando->Enviado/Error; fire requires
--           Pendiente/Enviando AND fecha_envio IS NULL -> once sent it no longer
--           fires. On UPDATE also require a real estado/mensaje change. No loop.
--   url   : .../webhook/sb-cola-email-procesar
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_sbwh_cola_email()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.estado IN ('Pendiente','Enviando')
      AND COALESCE(NEW.mensaje, '') <> ''
      AND NEW.alumno_id IS NOT NULL
      AND NEW.fecha_envio IS NULL
      AND (TG_OP = 'INSERT'
           OR OLD.estado IS DISTINCT FROM NEW.estado
           OR OLD.mensaje IS DISTINCT FROM NEW.mensaje)) THEN
    PERFORM net.http_post(
      url     := 'https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-cola-email-procesar',
      body    := jsonb_build_object('type', TG_OP, 'table','cola_emails',
                   'record', to_jsonb(NEW),
                   'old_record', CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE 'null'::jsonb END),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sbwh_cola_email ON public.cola_emails;
CREATE TRIGGER sbwh_cola_email
  AFTER INSERT OR UPDATE ON public.cola_emails
  FOR EACH ROW EXECUTE FUNCTION public.tg_sbwh_cola_email();
ALTER TABLE public.cola_emails DISABLE TRIGGER sbwh_cola_email;

-- =============================================================================
-- #21 Nueva Inscripcion — twin 3WDtM629rGgWsvkB
--   table : public.inscripciones    event : INSERT
--   fire  : new inscripcion row with an email (email IS NOT NULL AND email<>'')
--   guard : workflow writes alumnos/inbox/historial, NEVER inscripciones
--           -> no auto-retrigger (INSERT-only on this table is itself the guard).
--   url   : .../webhook/sb-nueva-inscripcion
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_sbwh_nueva_inscripcion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.email IS NOT NULL AND NEW.email <> '') THEN
    PERFORM net.http_post(
      url     := 'https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-nueva-inscripcion',
      body    := jsonb_build_object('type','INSERT','table','inscripciones',
                   'record', to_jsonb(NEW), 'old_record', 'null'::jsonb),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sbwh_nueva_inscripcion ON public.inscripciones;
CREATE TRIGGER sbwh_nueva_inscripcion
  AFTER INSERT ON public.inscripciones
  FOR EACH ROW EXECUTE FUNCTION public.tg_sbwh_nueva_inscripcion();
ALTER TABLE public.inscripciones DISABLE TRIGGER sbwh_nueva_inscripcion;

-- =============================================================================
-- #22 Sync Video Revisiones — twin jl67tZr0ibxrVoVV
--   table : public.revisiones_video event : INSERT + UPDATE
--   fire  : (email_alumno IS NOT NULL AND email_alumno<>'') OR alumno_id IS NOT NULL
--   guard : workflow WRITES this same table (Vincular Alumno, Marcar Inaccesible)
--           + alumnos. On UPDATE require a real change so identical-value writes
--           don't re-fire: OLD.estado_revision IS DISTINCT FROM NEW.estado_revision
--           OR OLD.alumno_id IS DISTINCT FROM NEW.alumno_id. 'Marcar Inaccesible'
--           may re-fire once but downstream 'Validar URL?' requires
--           estado_revision='Pendiente' -> cuts the loop.
--   url   : .../webhook/sb-sync-video-revisiones
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_sbwh_sync_video()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (((NEW.email_alumno IS NOT NULL AND NEW.email_alumno <> '')
        OR NEW.alumno_id IS NOT NULL)
      AND (TG_OP = 'INSERT'
           OR OLD.estado_revision IS DISTINCT FROM NEW.estado_revision
           OR OLD.alumno_id IS DISTINCT FROM NEW.alumno_id)) THEN
    PERFORM net.http_post(
      url     := 'https://drava-n8n.lk0nyk.easypanel.host/webhook/sb-sync-video-revisiones',
      body    := jsonb_build_object('type', TG_OP, 'table','revisiones_video',
                   'record', to_jsonb(NEW),
                   'old_record', CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE 'null'::jsonb END),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sbwh_sync_video ON public.revisiones_video;
CREATE TRIGGER sbwh_sync_video
  AFTER INSERT OR UPDATE ON public.revisiones_video
  FOR EACH ROW EXECUTE FUNCTION public.tg_sbwh_sync_video();
ALTER TABLE public.revisiones_video DISABLE TRIGGER sbwh_sync_video;

COMMIT;

-- =============================================================================
-- VERIFICATION (run after apply):
--   SELECT t.tgname, c.relname, t.tgenabled  -- tgenabled 'D' = DISABLED
--   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
--   WHERE t.tgname LIKE 'sbwh_%' ORDER BY c.relname, t.tgname;
-- All 9 must show tgenabled='D'.
-- =============================================================================
