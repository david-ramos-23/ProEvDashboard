-- ============================================================
-- ProEv Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE estado_general AS ENUM (
  'Privado',
  'Preinscrito',
  'En revisión de video',
  'Aprobado',
  'Rechazado',
  'Pendiente de pago',
  'Reserva',
  'Pagado',
  'Finalizado',
  'Plazo Vencido',
  'Pago Fallido'
);

CREATE TYPE estado_revision AS ENUM (
  'Pendiente',
  'Aprobado',
  'Rechazado',
  'Revision Necesaria'
);

CREATE TYPE estado_pago AS ENUM (
  'Pendiente',
  'Pagado',
  'Fallido',
  'Reembolsado',
  'Enviado'
);

CREATE TYPE estado_email AS ENUM (
  'Pendiente Aprobacion',
  'Pendiente',
  'Enviando',
  'Enviado',
  'Error'
);

CREATE TYPE estado_edicion AS ENUM (
  'Planificada',
  'Prelanzamiento',
  'Abierta',
  'Finalizada'
);

CREATE TYPE tipo_email AS ENUM (
  'disculpa',
  'informacion',
  'recordatorio',
  'seguimiento',
  'bienvenida',
  'felicitacion',
  'urgente'
);

CREATE TYPE idioma_tipo AS ENUM ('Espanol', 'Ingles');

CREATE TYPE origen_evento AS ENUM (
  'Manual',
  'Automatico',
  'Webhook',
  'API',
  'Workflow Automatico'
);

CREATE TYPE direccion_email AS ENUM ('Recibido', 'Enviado');

CREATE TYPE estado_inbox AS ENUM (
  'Nuevo',
  'Leido',
  'Respondido',
  'Archivado',
  'Eliminado'
);

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Ediciones (referenced by alumnos)
CREATE TABLE ediciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  estado estado_edicion DEFAULT 'Planificada',
  es_edicion_activa BOOLEAN DEFAULT false,
  fecha_inicio_inscripcion DATE,
  fecha_fin_inscripcion DATE,
  fecha_inicio_curso DATE,
  fecha_fin_curso DATE,
  modulos_disponibles TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Modulos
CREATE TABLE modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  precio_online NUMERIC(10,2),
  activo BOOLEAN DEFAULT true,
  capacidad INT,
  reserva_prelanzamiento BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Alumnos (central entity)
CREATE TABLE alumnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  estado_general estado_general DEFAULT 'Privado',
  idioma idioma_tipo DEFAULT 'Espanol',
  modulo_solicitado TEXT,
  modulos_completados TEXT[],
  edicion_id UUID REFERENCES ediciones(id),
  foto_perfil TEXT,
  plazo_revision DATE,
  fecha_plazo DATE,
  fecha_preinscripcion DATE,
  modulo_reserva TEXT,
  fecha_entrada_reserva DATE,
  -- AI fields (populated by n8n workflows)
  engagement_score NUMERIC(5,2),
  resumen_feedback_ia TEXT,
  siguiente_accion_ia TEXT,
  -- Internal
  notas_internas TEXT,
  admin_responsable TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Revisiones de Video
CREATE TABLE revisiones_video (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  video_enviado TEXT,
  redes_sociales TEXT,
  usuarios_rrss TEXT,
  estado_revision estado_revision DEFAULT 'Pendiente',
  puntuacion INT CHECK (puntuacion BETWEEN 1 AND 5),
  feedback TEXT,
  revisor_responsable TEXT,
  fecha_revision DATE,
  notas_internas TEXT,
  -- AI fields
  resumen_inteligente TEXT,
  clasificacion_automatica TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pagos
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  importe NUMERIC(10,2),
  moneda TEXT DEFAULT 'EUR' CHECK (moneda IN ('EUR','USD','MXN')),
  estado_pago estado_pago DEFAULT 'Pendiente',
  fecha_pago DATE,
  link_pago_stripe TEXT,
  id_sesion_stripe TEXT,
  link_recibo TEXT,
  notas_internas TEXT,
  -- AI fields
  resumen_inteligente TEXT,
  analisis_riesgo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Historial (activity log)
CREATE TABLE historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,
  descripcion TEXT,
  tipo_accion TEXT,
  origen_evento origen_evento DEFAULT 'Manual',
  admin_responsable TEXT,
  error_log TEXT,
  -- AI fields
  resumen_automatico TEXT,
  clasificacion_importancia TEXT CHECK (clasificacion_importancia IN ('Alta','Media','Baja')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cola de Emails
CREATE TABLE cola_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,
  alumno_nombre TEXT,
  tipo tipo_email,
  asunto TEXT,
  mensaje TEXT,
  estado estado_email DEFAULT 'Pendiente Aprobacion',
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Envios de Emails (bulk sends)
CREATE TABLE envios_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumnos_ids UUID[],
  tipo tipo_email,
  mensaje TEXT,
  descripcion TEXT,
  estado TEXT DEFAULT 'Pendiente',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inbox
CREATE TABLE inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de TEXT,
  para TEXT,
  asunto TEXT,
  fecha TIMESTAMPTZ,
  contenido TEXT,
  contenido_html TEXT,
  message_id TEXT,
  thread_id TEXT,
  direccion direccion_email DEFAULT 'Recibido',
  estado estado_inbox DEFAULT 'Nuevo',
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,
  -- AI fields
  resumen_ia TEXT,
  tipo_consulta TEXT,
  requiere_atencion BOOLEAN DEFAULT false,
  respuesta_sugerida TEXT,
  respuesta_final TEXT,
  respuesta_enviada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Log (NEW - tracks all mutations with user attribution)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  user_email TEXT,
  field_changes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX idx_alumnos_estado ON alumnos(estado_general);
CREATE INDEX idx_alumnos_edicion ON alumnos(edicion_id);
CREATE INDEX idx_alumnos_email ON alumnos(email);
CREATE INDEX idx_revisiones_alumno ON revisiones_video(alumno_id);
CREATE INDEX idx_revisiones_estado ON revisiones_video(estado_revision);
CREATE INDEX idx_pagos_alumno ON pagos(alumno_id);
CREATE INDEX idx_pagos_estado ON pagos(estado_pago);
CREATE INDEX idx_historial_alumno ON historial(alumno_id);
CREATE INDEX idx_historial_created ON historial(created_at DESC);
CREATE INDEX idx_cola_emails_estado ON cola_emails(estado);
CREATE INDEX idx_inbox_estado ON inbox(estado);
CREATE INDEX idx_inbox_alumno ON inbox(alumno_id);
CREATE INDEX idx_inbox_requiere_atencion ON inbox(requiere_atencion) WHERE requiere_atencion = true;
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_email, created_at DESC);

-- ============================================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at on any UPDATE
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alumnos_updated BEFORE UPDATE ON alumnos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_revisiones_updated BEFORE UPDATE ON revisiones_video
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pagos_updated BEFORE UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ediciones_updated BEFORE UPDATE ON ediciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_modulos_updated BEFORE UPDATE ON modulos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cola_emails_updated BEFORE UPDATE ON cola_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_envios_emails_updated BEFORE UPDATE ON envios_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inbox_updated BEFORE UPDATE ON inbox
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit trigger: captures who changed what with JSON diff
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}';
  col TEXT;
  old_val TEXT;
  new_val TEXT;
  current_user_email TEXT;
BEGIN
  -- Read user email set by the application before mutations
  current_user_email := current_setting('app.current_user_email', true);

  IF TG_OP = 'UPDATE' THEN
    -- Build a diff of changed fields
    FOR col IN
      SELECT column_name FROM information_schema.columns
      WHERE table_name = TG_TABLE_NAME
        AND table_schema = TG_TABLE_SCHEMA
        AND column_name NOT IN ('updated_at')
    LOOP
      EXECUTE format('SELECT ($1).%I::text', col) INTO old_val USING OLD;
      EXECUTE format('SELECT ($1).%I::text', col) INTO new_val USING NEW;
      IF old_val IS DISTINCT FROM new_val THEN
        changes := changes || jsonb_build_object(
          col, jsonb_build_object('old', old_val, 'new', new_val)
        );
      END IF;
    END LOOP;

    -- Only log if something actually changed (ignore updated_at-only updates)
    IF changes != '{}' THEN
      INSERT INTO audit_log (table_name, record_id, action, user_email, field_changes)
      VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', current_user_email, changes);
    END IF;

  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, user_email, field_changes)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', current_user_email, to_jsonb(NEW));

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, user_email, field_changes)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', current_user_email, to_jsonb(OLD));
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to all mutable tables
CREATE TRIGGER audit_alumnos AFTER INSERT OR UPDATE OR DELETE ON alumnos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_revisiones AFTER INSERT OR UPDATE OR DELETE ON revisiones_video
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_pagos AFTER INSERT OR UPDATE OR DELETE ON pagos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_cola_emails AFTER INSERT OR UPDATE OR DELETE ON cola_emails
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_inbox AFTER INSERT OR UPDATE OR DELETE ON inbox
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_ediciones AFTER INSERT OR UPDATE OR DELETE ON ediciones
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_historial AFTER INSERT OR UPDATE OR DELETE ON historial
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- ============================================================
-- 5. VIEWS (replace Airtable rollups/lookups)
-- ============================================================

-- Enriched alumnos view with computed metrics from related tables
CREATE OR REPLACE VIEW alumnos_enriched AS
SELECT
  a.*,
  e.nombre AS edicion_nombre,
  -- Revision metrics
  COALESCE(rev_stats.total_revisiones, 0)::INT AS total_revisiones,
  rev_stats.ultima_fecha_revision,
  rev_stats.estado_revision_reciente,
  rev_stats.puntuacion_video,
  -- Payment metrics
  COALESCE(pago_stats.total_pagos, 0)::INT AS total_pagos,
  COALESCE(pago_stats.importe_total_pagado, 0)::NUMERIC AS importe_total_pagado,
  pago_stats.fecha_ultimo_pago
FROM alumnos a
LEFT JOIN ediciones e ON a.edicion_id = e.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS total_revisiones,
    MAX(r.created_at) AS ultima_fecha_revision,
    (SELECT rv.estado_revision FROM revisiones_video rv
     WHERE rv.alumno_id = a.id ORDER BY rv.created_at DESC LIMIT 1
    )::TEXT AS estado_revision_reciente,
    (SELECT rv.puntuacion FROM revisiones_video rv
     WHERE rv.alumno_id = a.id ORDER BY rv.created_at DESC LIMIT 1
    ) AS puntuacion_video
  FROM revisiones_video r WHERE r.alumno_id = a.id
) rev_stats ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS total_pagos,
    COALESCE(SUM(CASE WHEN p.estado_pago = 'Pagado' THEN p.importe ELSE 0 END), 0) AS importe_total_pagado,
    MAX(p.created_at) AS fecha_ultimo_pago
  FROM pagos p WHERE p.alumno_id = a.id
) pago_stats ON true;

-- Enriched modulos view with inscritos count
CREATE OR REPLACE VIEW modulos_enriched AS
SELECT
  m.*,
  COUNT(a.id)::INT AS inscritos
FROM modulos m
LEFT JOIN alumnos a
  ON a.modulo_solicitado = m.modulo_id
  AND a.estado_general NOT IN ('Privado','Rechazado','Plazo Vencido')
GROUP BY m.id;

-- ============================================================
-- 6. RPC HELPER (set current user for audit trail)
-- ============================================================

-- Call this before mutations from the client:
-- supabase.rpc('set_current_user', { email: 'user@example.com' })
CREATE OR REPLACE FUNCTION set_current_user(email TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_email', email, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. RLS POLICIES (basic - expand as needed)
-- ============================================================

ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisiones_video ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE ediciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cola_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE envios_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow full access for authenticated users (anon key with service role bypasses RLS)
-- For now, allow all operations for anon (dashboard uses anon key but all users are authenticated via our auth)
-- We can tighten this later with Supabase Auth integration
CREATE POLICY "Allow all for anon" ON alumnos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON revisiones_video FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON pagos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON historial FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON ediciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON modulos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON cola_emails FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON envios_emails FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON inbox FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow read for anon" ON audit_log FOR SELECT TO anon USING (true);
