-- ============================================================
-- ProEv Supabase Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor
-- Uses andara14@gmail.com aliases for all test scenarios
-- ============================================================

-- Temporarily set a system user for audit trail during seeding
SELECT set_config('app.current_user_email', 'system@seed', true);

-- ============================================================
-- 1. EDICIONES
-- ============================================================

INSERT INTO ediciones (id, nombre, estado, es_edicion_activa, fecha_inicio_inscripcion, fecha_fin_inscripcion, fecha_inicio_curso, fecha_fin_curso, modulos_disponibles) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ProEv Enero 2026', 'Abierta', true,
   '2025-11-01', '2026-01-15', '2026-01-20', '2026-06-30',
   ARRAY['mod1','mod2','mod3','pack1y2']),
  ('a0000000-0000-0000-0000-000000000002', 'ProEv Septiembre 2025', 'Finalizada', false,
   '2025-06-01', '2025-08-31', '2025-09-15', '2025-12-20',
   ARRAY['mod1','mod2','mod3']);

-- ============================================================
-- 2. MODULOS
-- ============================================================

INSERT INTO modulos (id, modulo_id, nombre, precio_online, activo, capacidad, reserva_prelanzamiento) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'mod1', 'Modulo 1 - Fundamentos', 297.00, true, 30, false),
  ('b0000000-0000-0000-0000-000000000002', 'mod2', 'Modulo 2 - Avanzado', 397.00, true, 25, false),
  ('b0000000-0000-0000-0000-000000000003', 'mod3', 'Modulo 3 - Especialista', 497.00, true, 20, false),
  ('b0000000-0000-0000-0000-000000000004', 'pack1y2', 'Pack Modulos 1+2', 547.00, true, 30, true);

-- ============================================================
-- 3. ALUMNOS (one per estado, all with andara14 aliases)
-- ============================================================

INSERT INTO alumnos (id, nombre, email, telefono, estado_general, idioma, modulo_solicitado, edicion_id, fecha_preinscripcion, notas_internas) VALUES
  -- Privado: just registered interest
  ('c0000000-0000-0000-0000-000000000001',
   'Test Privado', 'andara14+privado@gmail.com', '+34600000001',
   'Privado', 'Espanol', 'mod1',
   'a0000000-0000-0000-0000-000000000001', '2025-12-01', NULL),

  -- Preinscrito: filled form
  ('c0000000-0000-0000-0000-000000000002',
   'Test Preinscrito', 'andara14+preinscrito@gmail.com', '+34600000002',
   'Preinscrito', 'Espanol', 'mod1',
   'a0000000-0000-0000-0000-000000000001', '2025-12-15',
   'Alumno de prueba preinscrito'),

  -- En revision de video: video sent, waiting review
  ('c0000000-0000-0000-0000-000000000003',
   'Test Revision Video', 'andara14+revision@gmail.com', '+34600000003',
   'En revisión de video', 'Espanol', 'mod2',
   'a0000000-0000-0000-0000-000000000001', '2025-12-20', NULL),

  -- Aprobado: video approved
  ('c0000000-0000-0000-0000-000000000004',
   'Test Aprobado', 'andara14+aprobado@gmail.com', '+34600000004',
   'Aprobado', 'Espanol', 'mod1',
   'a0000000-0000-0000-0000-000000000001', '2025-12-10', NULL),

  -- Rechazado: video rejected
  ('c0000000-0000-0000-0000-000000000005',
   'Test Rechazado', 'andara14+rechazado@gmail.com', '+34600000005',
   'Rechazado', 'Ingles', 'mod2',
   'a0000000-0000-0000-0000-000000000001', '2025-12-12', NULL),

  -- Pendiente de pago: approved but unpaid
  ('c0000000-0000-0000-0000-000000000006',
   'Test Pendiente Pago', 'andara14+pendientepago@gmail.com', '+34600000006',
   'Pendiente de pago', 'Espanol', 'mod1',
   'a0000000-0000-0000-0000-000000000001', '2025-12-05',
   'Esperando pago desde hace 5 dias');

INSERT INTO alumnos (id, nombre, email, telefono, estado_general, idioma, modulo_solicitado, edicion_id, fecha_preinscripcion, fecha_plazo, notas_internas) VALUES
  -- Reserva: on waiting list
  ('c0000000-0000-0000-0000-000000000007',
   'Test Reserva', 'andara14+reserva@gmail.com', '+34600000007',
   'Reserva', 'Espanol', 'mod3',
   'a0000000-0000-0000-0000-000000000001', '2025-12-08', '2026-02-01', NULL),

  -- Pagado: full process complete
  ('c0000000-0000-0000-0000-000000000008',
   'Test Pagado', 'andara14+pagado@gmail.com', '+34600000008',
   'Pagado', 'Espanol', 'mod1',
   'a0000000-0000-0000-0000-000000000001', '2025-11-20', NULL,
   'Alumno pagado, acceso completo'),

  -- Finalizado: course completed
  ('c0000000-0000-0000-0000-000000000009',
   'Test Finalizado', 'andara14+finalizado@gmail.com', '+34600000009',
   'Finalizado', 'Espanol', 'mod1',
   'a0000000-0000-0000-0000-000000000002', '2025-06-15', NULL,
   'Completo en edicion anterior');

INSERT INTO alumnos (id, nombre, email, telefono, estado_general, idioma, modulo_solicitado, edicion_id, fecha_preinscripcion, fecha_plazo, notas_internas) VALUES
  -- Plazo Vencido: deadline expired
  ('c0000000-0000-0000-0000-000000000010',
   'Test Plazo Vencido', 'andara14+plazovencido@gmail.com', '+34600000010',
   'Plazo Vencido', 'Espanol', 'mod2',
   'a0000000-0000-0000-0000-000000000001', '2025-11-01', '2025-12-01', NULL),

  -- Pago Fallido: payment error
  ('c0000000-0000-0000-0000-000000000011',
   'Test Pago Fallido', 'andara14+pagofallido@gmail.com', '+34600000011',
   'Pago Fallido', 'Espanol', 'pack1y2',
   'a0000000-0000-0000-0000-000000000001', '2025-12-18', NULL,
   'Error en tarjeta, contactar');

-- ============================================================
-- 4. REVISIONES DE VIDEO
-- ============================================================

-- Revision pendiente for the "En revision de video" alumno
INSERT INTO revisiones_video (id, alumno_id, video_enviado, redes_sociales, usuarios_rrss, estado_revision, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003',
   'https://www.instagram.com/reel/test123/',
   'Instagram', '@test_revision',
   'Pendiente', now() - interval '2 days');

-- Revision aprobada for the "Aprobado" alumno
INSERT INTO revisiones_video (id, alumno_id, video_enviado, redes_sociales, usuarios_rrss, estado_revision, puntuacion, feedback, revisor_responsable, fecha_revision, resumen_inteligente, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000004',
   'https://www.instagram.com/reel/test456/',
   'Instagram, TikTok', '@test_aprobado',
   'Aprobado', 4, 'Buen contenido, buena presencia. Aprobado.',
   'Alonso y Noelia', '2025-12-15',
   'Video de buena calidad con presencia profesional.',
   now() - interval '10 days');

-- Revision rechazada for the "Rechazado" alumno
INSERT INTO revisiones_video (id, alumno_id, video_enviado, redes_sociales, usuarios_rrss, estado_revision, puntuacion, feedback, revisor_responsable, fecha_revision, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000005',
   'https://www.youtube.com/watch?v=test789',
   'YouTube', '@test_rechazado',
   'Rechazado', 2, 'Video no cumple requisitos minimos. Reenviar.',
   'Alonso y Noelia', '2025-12-14',
   now() - interval '12 days');

-- Second revision for "Pagado" alumno (history)
INSERT INTO revisiones_video (id, alumno_id, video_enviado, redes_sociales, usuarios_rrss, estado_revision, puntuacion, feedback, revisor_responsable, fecha_revision, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000004',
   'c0000000-0000-0000-0000-000000000008',
   'https://www.instagram.com/reel/testabc/',
   'Instagram', '@test_pagado',
   'Aprobado', 5, 'Excelente video, muy profesional.',
   'Alonso y Noelia', '2025-11-25',
   now() - interval '30 days');

-- Revision for "Pendiente de pago" alumno
INSERT INTO revisiones_video (id, alumno_id, video_enviado, redes_sociales, usuarios_rrss, estado_revision, puntuacion, feedback, revisor_responsable, fecha_revision, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000005',
   'c0000000-0000-0000-0000-000000000006',
   'https://www.instagram.com/reel/testdef/',
   'Instagram', '@test_pendientepago',
   'Aprobado', 4, 'Buen video. Aprobado, pendiente de pago.',
   'Alonso y Noelia', '2025-12-08',
   now() - interval '20 days');

-- ============================================================
-- 5. PAGOS
-- ============================================================

-- Pago completado for "Pagado" alumno
INSERT INTO pagos (id, alumno_id, importe, moneda, estado_pago, fecha_pago, id_sesion_stripe, link_recibo, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000008',
   297.00, 'EUR', 'Pagado', '2025-11-28',
   'cs_test_abc123', 'https://receipt.stripe.com/test1',
   now() - interval '28 days');

-- Pago pendiente for "Pendiente de pago" alumno
INSERT INTO pagos (id, alumno_id, importe, moneda, estado_pago, fecha_pago, link_pago_stripe, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000006',
   297.00, 'EUR', 'Pendiente', NULL,
   'https://checkout.stripe.com/pay/test2',
   now() - interval '5 days');

-- Pago fallido for "Pago Fallido" alumno
INSERT INTO pagos (id, alumno_id, importe, moneda, estado_pago, fecha_pago, id_sesion_stripe, notas_internas, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000011',
   547.00, 'EUR', 'Fallido', '2025-12-18',
   'cs_test_failed456',
   'Tarjeta rechazada - fondos insuficientes',
   now() - interval '7 days');

-- Pago reembolsado (for "Finalizado" alumno, old edition)
INSERT INTO pagos (id, alumno_id, importe, moneda, estado_pago, fecha_pago, id_sesion_stripe, link_recibo, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000004',
   'c0000000-0000-0000-0000-000000000009',
   297.00, 'EUR', 'Pagado', '2025-06-20',
   'cs_test_old789', 'https://receipt.stripe.com/test3',
   now() - interval '180 days');

-- Second payment (different month, for chart data)
INSERT INTO pagos (id, alumno_id, importe, moneda, estado_pago, fecha_pago, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000005',
   'c0000000-0000-0000-0000-000000000008',
   150.00, 'EUR', 'Pagado', '2026-01-10',
   now() - interval '14 days');

-- ============================================================
-- 6. HISTORIAL (activity log)
-- ============================================================

INSERT INTO historial (alumno_id, descripcion, tipo_accion, origen_evento, admin_responsable, clasificacion_importancia, created_at) VALUES
  ('c0000000-0000-0000-0000-000000000002',
   'Alumno preinscrito via formulario web', 'Preinscripcion', 'Webhook',
   NULL, 'Media', now() - interval '10 days'),

  ('c0000000-0000-0000-0000-000000000003',
   'Video enviado para revision', 'Envio Video', 'Manual',
   NULL, 'Alta', now() - interval '2 days'),

  ('c0000000-0000-0000-0000-000000000004',
   'Video aprobado con puntuacion 4/5', 'Aprobacion Video', 'Manual',
   'Alonso y Noelia', 'Alta', now() - interval '10 days'),

  ('c0000000-0000-0000-0000-000000000005',
   'Video rechazado - no cumple requisitos', 'Rechazo Video', 'Manual',
   'Alonso y Noelia', 'Alta', now() - interval '12 days'),

  ('c0000000-0000-0000-0000-000000000008',
   'Pago completado via Stripe - 297 EUR', 'Pago Recibido', 'Webhook',
   NULL, 'Alta', now() - interval '28 days'),

  ('c0000000-0000-0000-0000-000000000011',
   'Pago fallido - tarjeta rechazada', 'Error Pago', 'Webhook',
   NULL, 'Alta', now() - interval '7 days'),

  ('c0000000-0000-0000-0000-000000000006',
   'Estado cambiado a Pendiente de pago', 'Cambio Estado', 'Automatico',
   NULL, 'Media', now() - interval '20 days'),

  ('c0000000-0000-0000-0000-000000000010',
   'Plazo vencido automaticamente', 'Plazo Vencido', 'Workflow Automatico',
   NULL, 'Media', now() - interval '25 days');

-- ============================================================
-- 7. COLA DE EMAILS
-- ============================================================

INSERT INTO cola_emails (alumno_id, alumno_nombre, tipo, asunto, mensaje, estado, descripcion) VALUES
  -- Pendiente Aprobacion (for revisor to approve)
  ('c0000000-0000-0000-0000-000000000006',
   'Test Pendiente Pago', 'recordatorio',
   'Recordatorio de pago - ProEv Enero 2026',
   'Hola Test Pendiente Pago, te recordamos que tu pago esta pendiente...',
   'Pendiente Aprobacion',
   'Recordatorio automatico de pago pendiente'),

  -- Another pending approval
  ('c0000000-0000-0000-0000-000000000011',
   'Test Pago Fallido', 'informacion',
   'Informacion sobre tu pago - ProEv',
   'Hola, hemos detectado un problema con tu ultimo pago...',
   'Pendiente Aprobacion',
   'Notificacion de pago fallido'),

  -- Already sent
  ('c0000000-0000-0000-0000-000000000008',
   'Test Pagado', 'bienvenida',
   'Bienvenido a ProEv Enero 2026!',
   'Felicidades! Tu inscripcion esta confirmada...',
   'Enviado',
   'Email de bienvenida post-pago'),

  -- Pending send (approved but not yet sent)
  ('c0000000-0000-0000-0000-000000000004',
   'Test Aprobado', 'felicitacion',
   'Tu video ha sido aprobado!',
   'Enhorabuena! Tu video ha sido aprobado con una puntuacion de 4/5...',
   'Pendiente',
   'Notificacion de aprobacion de video');

-- ============================================================
-- 8. INBOX
-- ============================================================

INSERT INTO inbox (de, para, asunto, fecha, contenido, direccion, estado, alumno_id, resumen_ia, tipo_consulta, requiere_atencion) VALUES
  -- Received email needing attention
  ('andara14+pendientepago@gmail.com', 'proevolutioncourse@gmail.com',
   'Consulta sobre metodos de pago',
   now() - interval '1 day',
   'Hola, me gustaria saber si aceptan transferencia bancaria ademas de tarjeta. Gracias.',
   'Recibido', 'Nuevo',
   'c0000000-0000-0000-0000-000000000006',
   'Alumno pregunta por metodos de pago alternativos (transferencia bancaria).',
   'Pagos', true),

  -- Received email, already read
  ('andara14+revision@gmail.com', 'proevolutioncourse@gmail.com',
   'Estado de mi revision de video',
   now() - interval '3 days',
   'Buenas tardes, envie mi video hace 2 dias y no he recibido respuesta. Podrian confirmar que lo recibieron?',
   'Recibido', 'Leido',
   'c0000000-0000-0000-0000-000000000003',
   'Alumno pregunta por estado de revision de video enviado hace 2 dias.',
   'Revisiones', false),

  -- Sent email
  ('proevolutioncourse@gmail.com', 'andara14+pagado@gmail.com',
   'Confirmacion de inscripcion',
   now() - interval '5 days',
   'Hola Test Pagado, confirmamos tu inscripcion en ProEv Enero 2026.',
   'Enviado', 'Respondido',
   'c0000000-0000-0000-0000-000000000008',
   NULL, NULL, false),

  -- Received, requires attention, not linked
  ('unknown-student@gmail.com', 'proevolutioncourse@gmail.com',
   'Informacion sobre el curso',
   now() - interval '6 hours',
   'Hola, me gustaria recibir informacion sobre el proximo curso de ProEv. Precio y fechas disponibles.',
   'Recibido', 'Nuevo',
   NULL,
   'Nuevo interesado solicita informacion general sobre curso ProEv.',
   'Informacion General', true);

-- ============================================================
-- 9. CLEAN UP AUDIT LOG FROM SEED
-- ============================================================

-- The seed inserts above will have generated audit_log entries with
-- user_email='system@seed'. You can optionally clean these:
-- DELETE FROM audit_log WHERE user_email = 'system@seed';

-- Or keep them as a record of initial data load.
-- For testing, we'll keep them so audit queries return data.

-- ============================================================
-- DONE! Verify with:
-- SELECT estado_general, COUNT(*) FROM alumnos GROUP BY estado_general;
-- SELECT COUNT(*) FROM revisiones_video;
-- SELECT COUNT(*) FROM pagos;
-- SELECT COUNT(*) FROM historial;
-- SELECT COUNT(*) FROM cola_emails;
-- SELECT COUNT(*) FROM inbox;
-- SELECT COUNT(*) FROM audit_log;
-- ============================================================
