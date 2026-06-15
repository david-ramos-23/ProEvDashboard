# MIGRACION — Reverse-Sync Field Audit (Airtable writable-field check)

Source of truth: live Airtable Metadata API on base `app4ZpoxaWOyV4RnR` (production PAT, full scope), cross-checked against `COLUMN_TO_AIRTABLE_FIELD` in `sync_supabase_to_airtable.py`.

**Total curated fields audited: 103** · Verdicts: WRITABLE = safe to PATCH/POST · READ-ONLY = would HTTP 422 · MISSING = curated name not on live table.

READ-ONLY field types treated as non-writable: `formula`, `rollup`, `lookup`, `multipleLookupValues`, `count`, `autoNumber`, `createdTime`, `lastModifiedTime`, `createdBy`, `lastModifiedBy`, `button`, `aiText`.


## `ediciones` → Airtable **Ediciones**

| pg_column | airtable_field | type | verdict |
|---|---|---|---|
| `nombre` | `Nombre` | singleLineText | WRITABLE |
| `estado` | `Estado` | singleSelect | WRITABLE |
| `es_edicion_activa` | `Es Edicion Activa` | checkbox | WRITABLE |
| `fecha_inicio_inscripcion` | `Fecha Inicio Inscripcion` | date | WRITABLE |
| `fecha_fin_inscripcion` | `Fecha Fin Inscripcion` | date | WRITABLE |
| `fecha_inicio_curso` | `Fecha Inicio Curso` | date | WRITABLE |
| `fecha_fin_curso` | `Fecha Fin Curso` | date | WRITABLE |
| `modulos_disponibles` | `Modulos Disponibles` | multipleSelects | WRITABLE |
| `fecha_inicio_prelanzamiento` | `Fecha Inicio Prelanzamiento` | date | WRITABLE |
| `plazos_revision` | `Plazos Revision` | richText | WRITABLE |

## `modulos` → Airtable **Modulos**

| pg_column | airtable_field | type | verdict |
|---|---|---|---|
| `modulo_id` | `ID` | singleLineText | WRITABLE |
| `nombre` | `Nombre` | singleLineText | WRITABLE |
| `precio_online` | `Precio Online` | currency | WRITABLE |
| `precio_efectivo` | `Precio Efectivo` | currency | WRITABLE |
| `activo` | `Activo` | checkbox | WRITABLE |
| `capacidad` | `Capacidad` | number | WRITABLE |
| `reserva_prelanzamiento_plazas` | `Reserva Prelanzamiento` | number | WRITABLE |

## `alumnos` → Airtable **Alumnos**

| pg_column | airtable_field | type | verdict |
|---|---|---|---|
| `nombre` | `Nombre` | multipleLookupValues | READ-ONLY |
| `email` | `Email` | multipleLookupValues | READ-ONLY |
| `telefono` | `Phone Number` | multipleLookupValues | READ-ONLY |
| `estado_general` | `Estado General` | singleSelect | WRITABLE |
| `idioma` | `Idioma` | singleSelect | WRITABLE |
| `modulo_solicitado` | `Modulo Solicitado` | singleSelect | WRITABLE |
| `modulos_completados` | `Modulos Completados` | multipleSelects | WRITABLE |
| `edicion_id` | `Edicion` | multipleRecordLinks | WRITABLE |
| `foto_perfil` | `Foto de Perfil` | multipleAttachments | WRITABLE |
| `plazo_revision` | `Plazo Revision` | singleLineText | WRITABLE |
| `fecha_plazo` | `Fecha Plazo` | date | WRITABLE |
| `fecha_preinscripcion` | `Fecha Preinscripcion` | createdTime | READ-ONLY |
| `modulo_reserva` | `Modulo Reserva` | singleLineText | WRITABLE |
| `fecha_entrada_reserva` | `Fecha Entrada Reserva` | date | WRITABLE |
| `notas_internas` | `Notas Internas` | multilineText | WRITABLE |
| `admin_responsable` | `Admin Responsable` | singleLineText | WRITABLE |
| `pareja_email` | `Pareja Email` | singleLineText | WRITABLE |
| `pareja_alumno_id` | `Pareja (Link)` | multipleRecordLinks | WRITABLE |
| `onboarding_enviado` | `Onboarding Enviado` | checkbox | WRITABLE |
| `bloqueado_proev26` | `Bloqueado ProEv26` | checkbox | WRITABLE |
| `disculpa_enviada` | `Disculpa Enviada` | checkbox | WRITABLE |
| `prelanzamiento_enviado` | `Prelanzamiento Enviado` | checkbox | WRITABLE |
| `followup_prelanzamiento` | `Followup Prelanzamiento` | number | WRITABLE |

## `revisiones_video` → Airtable **Revisiones de Video**

| pg_column | airtable_field | type | verdict |
|---|---|---|---|
| `alumno_id` | `Alumno` | multipleRecordLinks | WRITABLE |
| `video_enviado` | `Video Enviado` | url | WRITABLE |
| `redes_sociales` | `Redes Sociales` | multipleSelects | WRITABLE |
| `usuarios_rrss` | `Usuarios RRSS` | multilineText | WRITABLE |
| `estado_revision` | `Estado de Revision` | — | MISSING (accent typo) → **RENAME to `Estado de Revisión` (singleSelect, writable)** |
| `puntuacion` | `Puntuacion` | rating | WRITABLE |
| `feedback` | `Feedback` | multilineText | WRITABLE |
| `revisor_responsable` | `Revisor Responsable` | singleLineText | WRITABLE |
| `fecha_revision` | `Fecha de Revision` | — | MISSING (accent typo) → **RENAME to `Fecha de Revisión` (date, writable)** |

## `pagos` → Airtable **Pagos**

| pg_column | airtable_field | type | verdict |
|---|---|---|---|
| `alumno_id` | `Alumno` | multipleRecordLinks | WRITABLE |
| `importe` | `Importe` | currency | WRITABLE |
| `moneda` | `Moneda` | singleSelect | WRITABLE |
| `estado_pago` | `Estado de Pago` | singleSelect | WRITABLE |
| `fecha_pago` | `Fecha de Pago` | date | WRITABLE |
| `link_pago_stripe` | `Link Pago Stripe` | url | WRITABLE |
| `id_sesion_stripe` | `ID Sesion Stripe` | — | MISSING (accent typo) → **RENAME to `ID Sesión Stripe` (singleLineText, writable)** |
| `link_recibo` | `Link Recibo` | url | WRITABLE |

## `envios_emails` → Airtable **Envios de Emails**

| pg_column | airtable_field | type | verdict |
|---|---|---|---|
| `tipo` | `Tipo` | singleSelect | WRITABLE |
| `mensaje` | `Mensaje` | multilineText | WRITABLE |
| `descripcion` | `Descripcion` | singleLineText | WRITABLE |
| `estado` | `Estado` | singleSelect | WRITABLE |
| `total_emails` | `Total Emails` | number | WRITABLE |
| `emails_creados` | `Emails Creados` | number | WRITABLE |
| `fecha_completado` | `Fecha Completado` | date | WRITABLE |

## `cola_emails` → Airtable **Cola de Emails**

| pg_column | airtable_field | type | verdict |
|---|---|---|---|
| `alumno_id` | `Alumno` | multipleRecordLinks | WRITABLE |
| `tipo` | `Tipo` | singleLineText | WRITABLE |
| `asunto` | `Asunto` | — | MISSING → **REMOVE (no such field on table)** |
| `asunto_generado` | `Asunto Generado` | singleLineText | WRITABLE |
| `email_generado` | `Email Generado` | multilineText | WRITABLE |
| `mensaje` | `Mensaje` | singleLineText | WRITABLE |
| `estado` | `Estado` | singleSelect | WRITABLE |
| `origen` | `Origen` | singleSelect | WRITABLE |
| `descripcion` | `Descripcion` | — | MISSING → **REMOVE (no such field on table)** |
| `fecha_envio` | `Fecha Envio` | date | WRITABLE |
| `reprogramado` | `Reprogramado` | checkbox | WRITABLE |
| `ultimo_reproceso` | `Ultimo Reproceso` | dateTime | WRITABLE |

## `inbox` → Airtable **Inbox**

| pg_column | airtable_field | type | verdict |
|---|---|---|---|
| `de` | `De` | email | WRITABLE |
| `para` | `Para` | email | WRITABLE |
| `asunto` | `Asunto` | singleLineText | WRITABLE |
| `fecha` | `Fecha` | dateTime | WRITABLE |
| `contenido` | `Contenido` | multilineText | WRITABLE |
| `contenido_html` | `Contenido HTML` | multilineText | WRITABLE |
| `message_id` | `messageId` | singleLineText | WRITABLE |
| `thread_id` | `threadId` | singleLineText | WRITABLE |
| `direccion` | `Direccion` | singleSelect | WRITABLE |
| `estado` | `Estado` | singleSelect | WRITABLE |
| `origen` | `Origen` | singleSelect | WRITABLE |
| `alumno_id` | `Alumno` | multipleRecordLinks | WRITABLE |
| `resumen_ia` | `Resumen AI` | multilineText | WRITABLE |
| `tipo_consulta` | `Tipo Consulta` | singleSelect | WRITABLE |
| `requiere_atencion` | `Requiere Atencion` | checkbox | WRITABLE |
| `respuesta_sugerida` | `Respuesta Sugerida` | multilineText | WRITABLE |
| `respuesta_final` | `Respuesta Final` | multilineText | WRITABLE |
| `respuesta_enviada` | `Respuesta Enviada` | checkbox | WRITABLE |
| `fecha_apertura` | `Fecha Apertura` | dateTime | WRITABLE |
| `gmail_leido` | `Gmail Leido` | checkbox | WRITABLE |
| `gmail_eliminado` | `Gmail Eliminado` | checkbox | WRITABLE |

## `historial` → Airtable **Historial**

| pg_column | airtable_field | type | verdict |
|---|---|---|---|
| `alumno_id` | `Alumno` | multipleRecordLinks | WRITABLE |
| `descripcion` | `Descripcion` | — | MISSING (accent typo) → **RENAME to `Descripción Detallada` (multilineText, writable)** |
| `tipo_accion` | `Tipo de Accion` | — | MISSING (accent typo) → **RENAME to `Tipo de Acción` (singleSelect, writable)** |
| `origen_evento` | `Origen del Evento` | singleSelect | WRITABLE |
| `error_log` | `Error Log` | multilineText | WRITABLE |
| `workflow` | `workflow` | url | WRITABLE |

---

## REMOVE list — delete these exact `COLUMN_TO_AIRTABLE_FIELD` entries

READ-ONLY (would 422 the whole batch on `--load`):
- `alumnos` → `"nombre": "Nombre"`  (multipleLookupValues)
- `alumnos` → `"email": "Email"`  (multipleLookupValues)
- `alumnos` → `"telefono": "Phone Number"`  (multipleLookupValues)
- `alumnos` → `"fecha_preinscripcion": "Fecha Preinscripcion"`  (createdTime)

MISSING — field genuinely absent on live table (no writable equivalent):
- `cola_emails` → `"asunto": "Asunto"`  (no `Asunto` field exists)
- `cola_emails` → `"descripcion": "Descripcion"`  (no `Descripcion` field exists)

## FIX list — rename (do NOT delete; live field exists, just mis-accented)

- `revisiones_video` → `"estado_revision": "Estado de Revision"`  →  `"estado_revision": "Estado de Revisión"`  (singleSelect, WRITABLE)
- `revisiones_video` → `"fecha_revision": "Fecha de Revision"`  →  `"fecha_revision": "Fecha de Revisión"`  (date, WRITABLE)
- `pagos` → `"id_sesion_stripe": "ID Sesion Stripe"`  →  `"id_sesion_stripe": "ID Sesión Stripe"`  (singleLineText, WRITABLE)
- `historial` → `"descripcion": "Descripcion"`  →  `"descripcion": "Descripción Detallada"`  (multilineText, WRITABLE)
- `historial` → `"tipo_accion": "Tipo de Accion"`  →  `"tipo_accion": "Tipo de Acción"`  (singleSelect, WRITABLE)

## Summary

- Audited: **103** curated field mappings across 9 tables.
- Flagged: **11** (4 READ-ONLY + 2 MISSING-delete + 5 MISSING-rename).
- **Remove: 6** entries (4 read-only + 2 absent).
- **Fix (rename): 5** entries (live field present under accented name).
- Remaining after fixes: **97** writable mappings.
