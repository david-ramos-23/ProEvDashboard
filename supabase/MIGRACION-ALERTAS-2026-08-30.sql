-- ============================================================
-- MIGRACION-ALERTAS-2026-08-30.sql
--
-- Upgrade script for an ALREADY-PROVISIONED Supabase database.
--
-- WHY THIS FILE EXISTS
--   `schema.sql` is a clean-install script: its `CREATE TYPE` / `CREATE TABLE`
--   statements are not idempotent, so it is never re-run against the shadow
--   project. The 2026-08-30 alert rewrite landed only there, which means the
--   provisioned shadow DB (project qktvdmoggniufynaodzq, EU-North-1) still
--   carries the cold-first `alerta_activa` applied by
--   MIGRACION-SCHEMA-GAPS.sql on 2026-06-15 — the exact rule this change
--   removes. Without this file a cutover would resurrect the alert loop and
--   would also lack `origen_email = 'automatico'` and `cola_emails.valido_hasta`.
--
-- STATUS: NOT APPLIED. Run it against the shadow DB before any cutover.
--
-- HOW TO RUN
--   Run STEP 1 first and let it commit, THEN run STEP 2. Postgres refuses to
--   use an enum value added by `ALTER TYPE ... ADD VALUE` inside the same
--   transaction that added it. Nothing in STEP 2 reads `origen_email`, so a
--   single-shot run normally works too — but splitting removes the risk for
--   free. Every statement is idempotent; re-running the file is safe.
--
-- ROLLBACK
--   The pre-change view is preserved verbatim in MIGRACION-SCHEMA-GAPS.sql
--   (lines 108-188). Enum values cannot be dropped in Postgres; leaving
--   'automatico' in place is harmless.
-- ============================================================


-- ============================================================
-- STEP 1 — enum + column
-- ============================================================

-- The alert scheduler writes Origen = 'automatico' (lowercase) on every queue
-- row it creates. Cola de Emails uses lowercase origins (manual_template,
-- manual_quick, automatico); Inbox uses capitalised ones (Manual, Automatico).
-- Both share this one enum, so both spellings must coexist.
ALTER TYPE origen_email ADD VALUE IF NOT EXISTS 'automatico';

-- Alert expiry. NULL means "never expires" — every writer except the alert
-- scheduler omits it, so the queue trigger must treat NULL as valid, not as
-- expired.
ALTER TABLE cola_emails ADD COLUMN IF NOT EXISTS valido_hasta DATE;


-- ============================================================
-- STEP 2 — alerta_activa, aligned with the rewritten Airtable formula
--
-- Column list taken from the LIVE view as of 2026-08-31, read with
-- information_schema.columns — NOT from MIGRACION-SCHEMA-GAPS.sql, whose order
-- is stale: `modules` has since moved to position 42 (last), because an earlier
-- CREATE OR REPLACE could only append. Using the June order failed with
-- `cannot change name of view column "edicion_id" to "modules"`.
-- CREATE OR REPLACE VIEW requires the leading column set to be unchanged, and
-- an `a.*` expansion would silently depend on the live shape of `alumnos`.
-- Only the final CASE changes.
-- ============================================================

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
    COALESCE((now()::date - (SELECT max(h.created_at)::date FROM public.historial h WHERE h.alumno_id = a.id)), 9999) AS dias_desde_ultimo_evento,
    (now()::date - a.fecha_cambio_estado::date) AS dias_en_estado_actual,
    CASE
      WHEN a.estado_general = 'Pago Fallido'::estado_general
       AND (now()::date - a.fecha_cambio_estado::date) >= 3
        THEN '⚠️ Pago Fallido'
      WHEN a.estado_general = 'Pendiente de pago'::estado_general
       AND (now()::date - a.fecha_cambio_estado::date) >= 5
        THEN '💳 Pago Pendiente'
      WHEN a.estado_general = 'Preinscrito'::estado_general
       AND (now()::date - a.fecha_cambio_estado::date) >= 3
        THEN '📝 Preinscrito'
      WHEN a.estado_general = 'En revisión de video'::estado_general
       AND (now()::date - a.fecha_cambio_estado::date) >= 3
        THEN '🎥 Video sin Revisar'
      WHEN a.estado_general = 'Reserva'::estado_general
       AND (now()::date - a.fecha_cambio_estado::date) >= 7
        THEN '🕗 Reserva'
      ELSE ''
    END AS alerta_activa,
    a.modules
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


-- ============================================================
-- POST-APPLY CHECKS — run these and record the output here
-- ============================================================
-- 1) No branch may fire on a state that is not in the whitelist:
--      SELECT estado_general, alerta_activa, count(*)
--        FROM alumnos_enriched GROUP BY 1, 2 ORDER BY 1;
--    Expected: Privado / Aprobado / Pagado / Finalizado / Rechazado /
--    Plazo Vencido rows all carry alerta_activa = ''.
--
-- 2) Cold alerts must be gone:
--      SELECT count(*) FROM alumnos_enriched WHERE alerta_activa LIKE '%Frío%';
--    Expected: 0.
--
-- 3) Column count must still be 41 (no column added or dropped):
--      SELECT count(*) FROM information_schema.columns
--       WHERE table_name = 'alumnos_enriched';
--
-- 4) Enum and column landed:
--      SELECT unnest(enum_range(NULL::origen_email));   -- includes 'automatico'
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'cola_emails' AND column_name = 'valido_hasta';
