# MIGRACION — Reverse-Sync Field Audit (Airtable writable-field check)

> Audit goal: verify that every target Airtable field in `COLUMN_TO_AIRTABLE_FIELD`
> (in `supabase/sync_supabase_to_airtable.py`, post-hardening version on `origin/master`)
> is **writable** via the Airtable REST API, so a future
> `sync_supabase_to_airtable.py --load` will not 422 on read-only/computed fields.

**Date:** 2026-06-15
**Base ID:** `app4ZpoxaWOyV4RnR`
**Mode:** READ-ONLY against Airtable (nothing written to Airtable or Supabase).

---

## RESULT: BLOCKED — PAT lacks `schema.bases:read` metadata scope

The Airtable Metadata API is required to read each field's **type** (formula / rollup /
lookup / autoNumber / createdTime / etc.), which is the only reliable way to tell
writable fields from read-only ones. The provided PAT cannot reach it.

| Check | Endpoint | HTTP | Result |
|---|---|---|---|
| Token validity | `GET /v0/meta/whoami` | **200** | OK — token is valid (`usrVSI2iCD8Qtv8Tk`) |
| Base schema (tables+fields) | `GET /v0/meta/bases/app4ZpoxaWOyV4RnR/tables` | **403** | `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND` |
| List bases | `GET /v0/meta/bases` | **403** | `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND` |

The token authenticates (whoami 200) but **every Metadata API call returns 403**.
This is the documented signature of a PAT that has **data scopes**
(`data.records:read/write`) but **not** `schema.bases:read`.

Consistent with project memory: *"Airtable Meta API schema:write — el PAT de producción
no tiene scope schema:write"* — and this audit shows it also lacks **schema.bases:read**.

### What unblocks this audit
Provide a PAT (same base) that additionally has the **`schema.bases:read`** scope.
With it, re-run the audit: pull each table's `fields[].type`, build a
`name → type` map per table, and cross-check the curated inventory below.
No guessing of field types was done (per instructions).

---

## Pre-staged inventory (extracted from `origin/master` source — ready for cross-check)

Curated `COLUMN_TO_AIRTABLE_FIELD`: **9 tables, 103 column→field entries.**
For each, the cross-check will fill the **Type** and **Verdict** columns
(WRITABLE / READ-ONLY / MISSING) once metadata is available.

### Table: `ediciones`  (10 fields)

| Supabase column | → Airtable field | Type | Verdict |
|---|---|---|---|
| `nombre` | `Nombre` | _(pending: needs metadata)_ | _(pending)_ |
| `estado` | `Estado` | _(pending: needs metadata)_ | _(pending)_ |
| `es_edicion_activa` | `Es Edicion Activa` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_inicio_inscripcion` | `Fecha Inicio Inscripcion` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_fin_inscripcion` | `Fecha Fin Inscripcion` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_inicio_curso` | `Fecha Inicio Curso` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_fin_curso` | `Fecha Fin Curso` | _(pending: needs metadata)_ | _(pending)_ |
| `modulos_disponibles` | `Modulos Disponibles` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_inicio_prelanzamiento` | `Fecha Inicio Prelanzamiento` | _(pending: needs metadata)_ | _(pending)_ |
| `plazos_revision` | `Plazos Revision` | _(pending: needs metadata)_ | _(pending)_ |

### Table: `modulos`  (7 fields)

| Supabase column | → Airtable field | Type | Verdict |
|---|---|---|---|
| `modulo_id` | `ID` | _(pending: needs metadata)_ | _(pending)_ |
| `nombre` | `Nombre` | _(pending: needs metadata)_ | _(pending)_ |
| `precio_online` | `Precio Online` | _(pending: needs metadata)_ | _(pending)_ |
| `precio_efectivo` | `Precio Efectivo` | _(pending: needs metadata)_ | _(pending)_ |
| `activo` | `Activo` | _(pending: needs metadata)_ | _(pending)_ |
| `capacidad` | `Capacidad` | _(pending: needs metadata)_ | _(pending)_ |
| `reserva_prelanzamiento_plazas` | `Reserva Prelanzamiento` | _(pending: needs metadata)_ | _(pending)_ |

### Table: `alumnos`  (23 fields)

| Supabase column | → Airtable field | Type | Verdict |
|---|---|---|---|
| `nombre` | `Nombre` | _(pending: needs metadata)_ | _(pending)_ |
| `email` | `Email` | _(pending: needs metadata)_ | _(pending)_ |
| `telefono` | `Phone Number` | _(pending: needs metadata)_ | _(pending)_ |
| `estado_general` | `Estado General` | _(pending: needs metadata)_ | _(pending)_ |
| `idioma` | `Idioma` | _(pending: needs metadata)_ | _(pending)_ |
| `modulo_solicitado` | `Modulo Solicitado` | _(pending: needs metadata)_ | _(pending)_ |
| `modulos_completados` | `Modulos Completados` | _(pending: needs metadata)_ | _(pending)_ |
| `edicion_id` | `Edicion` | _(pending: needs metadata)_ | _(pending)_ |
| `foto_perfil` | `Foto de Perfil` | _(pending: needs metadata)_ | _(pending)_ |
| `plazo_revision` | `Plazo Revision` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_plazo` | `Fecha Plazo` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_preinscripcion` | `Fecha Preinscripcion` | _(pending: needs metadata)_ | _(pending)_ |
| `modulo_reserva` | `Modulo Reserva` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_entrada_reserva` | `Fecha Entrada Reserva` | _(pending: needs metadata)_ | _(pending)_ |
| `notas_internas` | `Notas Internas` | _(pending: needs metadata)_ | _(pending)_ |
| `admin_responsable` | `Admin Responsable` | _(pending: needs metadata)_ | _(pending)_ |
| `pareja_email` | `Pareja Email` | _(pending: needs metadata)_ | _(pending)_ |
| `pareja_alumno_id` | `Pareja (Link)` | _(pending: needs metadata)_ | _(pending)_ |
| `onboarding_enviado` | `Onboarding Enviado` | _(pending: needs metadata)_ | _(pending)_ |
| `bloqueado_proev26` | `Bloqueado ProEv26` | _(pending: needs metadata)_ | _(pending)_ |
| `disculpa_enviada` | `Disculpa Enviada` | _(pending: needs metadata)_ | _(pending)_ |
| `prelanzamiento_enviado` | `Prelanzamiento Enviado` | _(pending: needs metadata)_ | _(pending)_ |
| `followup_prelanzamiento` | `Followup Prelanzamiento` | _(pending: needs metadata)_ | _(pending)_ |

### Table: `revisiones_video`  (9 fields)

| Supabase column | → Airtable field | Type | Verdict |
|---|---|---|---|
| `alumno_id` | `Alumno` | _(pending: needs metadata)_ | _(pending)_ |
| `video_enviado` | `Video Enviado` | _(pending: needs metadata)_ | _(pending)_ |
| `redes_sociales` | `Redes Sociales` | _(pending: needs metadata)_ | _(pending)_ |
| `usuarios_rrss` | `Usuarios RRSS` | _(pending: needs metadata)_ | _(pending)_ |
| `estado_revision` | `Estado de Revision` | _(pending: needs metadata)_ | _(pending)_ |
| `puntuacion` | `Puntuacion` | _(pending: needs metadata)_ | _(pending)_ |
| `feedback` | `Feedback` | _(pending: needs metadata)_ | _(pending)_ |
| `revisor_responsable` | `Revisor Responsable` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_revision` | `Fecha de Revision` | _(pending: needs metadata)_ | _(pending)_ |

### Table: `pagos`  (8 fields)

| Supabase column | → Airtable field | Type | Verdict |
|---|---|---|---|
| `alumno_id` | `Alumno` | _(pending: needs metadata)_ | _(pending)_ |
| `importe` | `Importe` | _(pending: needs metadata)_ | _(pending)_ |
| `moneda` | `Moneda` | _(pending: needs metadata)_ | _(pending)_ |
| `estado_pago` | `Estado de Pago` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_pago` | `Fecha de Pago` | _(pending: needs metadata)_ | _(pending)_ |
| `link_pago_stripe` | `Link Pago Stripe` | _(pending: needs metadata)_ | _(pending)_ |
| `id_sesion_stripe` | `ID Sesion Stripe` | _(pending: needs metadata)_ | _(pending)_ |
| `link_recibo` | `Link Recibo` | _(pending: needs metadata)_ | _(pending)_ |

### Table: `envios_emails`  (7 fields)

| Supabase column | → Airtable field | Type | Verdict |
|---|---|---|---|
| `tipo` | `Tipo` | _(pending: needs metadata)_ | _(pending)_ |
| `mensaje` | `Mensaje` | _(pending: needs metadata)_ | _(pending)_ |
| `descripcion` | `Descripcion` | _(pending: needs metadata)_ | _(pending)_ |
| `estado` | `Estado` | _(pending: needs metadata)_ | _(pending)_ |
| `total_emails` | `Total Emails` | _(pending: needs metadata)_ | _(pending)_ |
| `emails_creados` | `Emails Creados` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_completado` | `Fecha Completado` | _(pending: needs metadata)_ | _(pending)_ |

### Table: `cola_emails`  (12 fields)

| Supabase column | → Airtable field | Type | Verdict |
|---|---|---|---|
| `alumno_id` | `Alumno` | _(pending: needs metadata)_ | _(pending)_ |
| `tipo` | `Tipo` | _(pending: needs metadata)_ | _(pending)_ |
| `asunto` | `Asunto` | _(pending: needs metadata)_ | _(pending)_ |
| `asunto_generado` | `Asunto Generado` | _(pending: needs metadata)_ | _(pending)_ |
| `email_generado` | `Email Generado` | _(pending: needs metadata)_ | _(pending)_ |
| `mensaje` | `Mensaje` | _(pending: needs metadata)_ | _(pending)_ |
| `estado` | `Estado` | _(pending: needs metadata)_ | _(pending)_ |
| `origen` | `Origen` | _(pending: needs metadata)_ | _(pending)_ |
| `descripcion` | `Descripcion` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_envio` | `Fecha Envio` | _(pending: needs metadata)_ | _(pending)_ |
| `reprogramado` | `Reprogramado` | _(pending: needs metadata)_ | _(pending)_ |
| `ultimo_reproceso` | `Ultimo Reproceso` | _(pending: needs metadata)_ | _(pending)_ |

### Table: `inbox`  (21 fields)

| Supabase column | → Airtable field | Type | Verdict |
|---|---|---|---|
| `de` | `De` | _(pending: needs metadata)_ | _(pending)_ |
| `para` | `Para` | _(pending: needs metadata)_ | _(pending)_ |
| `asunto` | `Asunto` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha` | `Fecha` | _(pending: needs metadata)_ | _(pending)_ |
| `contenido` | `Contenido` | _(pending: needs metadata)_ | _(pending)_ |
| `contenido_html` | `Contenido HTML` | _(pending: needs metadata)_ | _(pending)_ |
| `message_id` | `messageId` | _(pending: needs metadata)_ | _(pending)_ |
| `thread_id` | `threadId` | _(pending: needs metadata)_ | _(pending)_ |
| `direccion` | `Direccion` | _(pending: needs metadata)_ | _(pending)_ |
| `estado` | `Estado` | _(pending: needs metadata)_ | _(pending)_ |
| `origen` | `Origen` | _(pending: needs metadata)_ | _(pending)_ |
| `alumno_id` | `Alumno` | _(pending: needs metadata)_ | _(pending)_ |
| `resumen_ia` | `Resumen AI` | _(pending: needs metadata)_ | _(pending)_ |
| `tipo_consulta` | `Tipo Consulta` | _(pending: needs metadata)_ | _(pending)_ |
| `requiere_atencion` | `Requiere Atencion` | _(pending: needs metadata)_ | _(pending)_ |
| `respuesta_sugerida` | `Respuesta Sugerida` | _(pending: needs metadata)_ | _(pending)_ |
| `respuesta_final` | `Respuesta Final` | _(pending: needs metadata)_ | _(pending)_ |
| `respuesta_enviada` | `Respuesta Enviada` | _(pending: needs metadata)_ | _(pending)_ |
| `fecha_apertura` | `Fecha Apertura` | _(pending: needs metadata)_ | _(pending)_ |
| `gmail_leido` | `Gmail Leido` | _(pending: needs metadata)_ | _(pending)_ |
| `gmail_eliminado` | `Gmail Eliminado` | _(pending: needs metadata)_ | _(pending)_ |

### Table: `historial`  (6 fields)

| Supabase column | → Airtable field | Type | Verdict |
|---|---|---|---|
| `alumno_id` | `Alumno` | _(pending: needs metadata)_ | _(pending)_ |
| `descripcion` | `Descripcion` | _(pending: needs metadata)_ | _(pending)_ |
| `tipo_accion` | `Tipo de Accion` | _(pending: needs metadata)_ | _(pending)_ |
| `origen_evento` | `Origen del Evento` | _(pending: needs metadata)_ | _(pending)_ |
| `error_log` | `Error Log` | _(pending: needs metadata)_ | _(pending)_ |
| `workflow` | `workflow` | _(pending: needs metadata)_ | _(pending)_ |

---

## Read-only field types reference (for the cross-check)

Any curated target whose live Airtable type is one of these would **422 on PATCH/POST**
and must be REMOVED from `COLUMN_TO_AIRTABLE_FIELD`:

`formula`, `rollup`, `lookup`, `multipleLookupValues`, `count`, `autoNumber`,
`createdTime`, `lastModifiedTime`, `createdBy`, `lastModifiedBy`, `button`,
`barcode` (sometimes), plus any AI/automation-computed field.

Also flag any curated target field **name that does not exist** in the live base
(typo / renamed) → MISSING.

## Map entries to REMOVE

> **Not determinable yet** — requires the metadata-scoped PAT. This section will be
> filled with the exact `table.field` lines to delete from `COLUMN_TO_AIRTABLE_FIELD`
> once the cross-check runs.
