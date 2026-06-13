# MIGRACIÓN — Parity Schema (Airtable → Supabase)

**Análisis NO destructivo.** Compara `dashboard/supabase/schema.sql` (escrito 2026-03-27) con el schema VIVO de Airtable (base `app4ZpoxaWOyV4RnR`, leído vía MCP 2026-06-13). No se modificó nada.

Fuentes:
- schema.sql: 10 tablas, 10 ENUM types.
- Airtable live: 14 tablas (8 en alcance ProEv). singleSelect choices verificados vía `get_table_schema`.
- App: `src/utils/constants.ts` (`AIRTABLE_TABLES`, `ESTADO*`, `MODULO`, `ORIGEN`).

---

## (a) Resumen de drift

| Severidad | Conteo |
|---|---|
| Columnas faltantes (campos operativos) | **18** |
| ENUM singleSelect con choices nuevos (rompen import) | **5** |
| Type mismatch | **1** |
| Tabla faltante en schema.sql | **1** (`configuracion`) |
| **TOTAL drift items** | **25** |

> El schema.sql es anterior a varias features post-marzo 2026: `Pareja Email/Link`, revisión `Video no accesible`, `Origen` en Cola de Emails e Inbox, tracking de aperturas/lectura en Inbox, y flags de campaña prelanzamiento en Alumnos.

---

## (b) Parity por tabla

Leyenda: `present?` = ✅ existe / ❌ falta / ⚠️ type-mismatch.

### Alumnos (`tblmfv5beVBGOZ2sb` → `alumnos`)

| Airtable field | Tipo AT | Columna PG esperada | present? |
|---|---|---|---|
| Nombre / Email / Phone | lookup | nombre / email / telefono | ✅ |
| Estado General | singleSelect | estado_general (ENUM) | ✅ |
| Idioma | singleSelect | idioma | ✅ |
| Modulo Solicitado | singleSelect | modulo_solicitado | ✅ |
| Modulos Completados | multiSelect | modulos_completados | ✅ |
| Edicion | link | edicion_id | ✅ |
| Plazo/Fecha/Reserva | varios | plazo_revision… | ✅ |
| Engagement / Resumen IA / Notas | varios | engagement_score… | ✅ |
| **Pareja Email** (`fld9FwoVXp2225Zjq`) | singleLineText | `pareja_email` | ❌ |
| **Pareja (Link)** (`fld8rUNYDgAxNcBzt`) | link | `pareja_alumno_id` | ❌ |
| **Onboarding Enviado** | checkbox | `onboarding_enviado` | ❌ |
| **Bloqueado ProEv26** | checkbox | `bloqueado_proev26` | ❌ |
| **Disculpa Enviada** | checkbox | `disculpa_enviada` | ❌ |
| **Prelanzamiento Enviado** | checkbox | `prelanzamiento_enviado` | ❌ |
| **Followup Prelanzamiento** | number | `followup_prelanzamiento` | ❌ |

### Revisiones de Video (`tbluWapTseCcfcfXc` → `revisiones_video`)

| Airtable field | present? |
|---|---|
| Estado de Revisión (singleSelect) | ⚠️ **ENUM falta `Video no accesible`** (live=5 choices, schema=4) |
| Email del Alumno (`fldgdSeOD…`) | ❌ `email_alumno` no existe |
| Perfiles Redes Sociales | ❌ `perfiles_rrss` no existe (solo `redes_sociales`) |
| resto (puntuacion, feedback, revisor_responsable…) | ✅ |

> Nota: ENUM `estado_revision` en schema.sql lista `'Pendiente','Aprobado','Rechazado','Revision Necesaria'` — ORDEN distinto e **incompleto**.

### Pagos (`tblWC5K2xuLr3XXQ4` → `pagos`)

| Airtable field | present? |
|---|---|
| Estado de Pago (singleSelect) | ⚠️ **ENUM falta `Completado` y `Pendiente Verificación`**. Live choices: Pendiente, Fallido, Reembolsado, Enviado, **Completado**, **Pendiente Verificación**. schema.sql ENUM: Pendiente, **Pagado**, Fallido, Reembolsado, Enviado (incluye `Pagado` que NO existe en Airtable). |
| Moneda | ✅ (CHECK EUR/USD/MXN coincide) |
| Recibo (Foto) attachment | ❌ no migrado (opcional) |

### Historial (`tbl3Zkove7j24eCho` → `historial`)

| Airtable field | present? |
|---|---|
| Origen del Evento (singleSelect) | ⚠️ **ENUM falta `Sistema`** (live tiene Manual, Automático, Webhook, API, Workflow Automatico, **Sistema**) |
| **workflow** (url) | ❌ `workflow` no existe |
| resto | ✅ |

### Cola de Emails (`tblVqFfucbW5POC5u` → `cola_emails`)

| Airtable field | present? |
|---|---|
| Estado (singleSelect) | ✅ ENUM coincide |
| **Origen** (`fld0QZocgnG8ioHSx`) | ❌ singleSelect nuevo (`manual_template`,`manual_quick`) — sin columna ni ENUM |
| **Asunto Generado** | ⚠️ schema tiene `asunto`; Airtable usa `Asunto Generado` (distinto de `Mensaje`) |
| **Email Generado** (HTML) | ❌ `email_generado` no existe |
| **Fecha Envio** | ❌ `fecha_envio` no existe (clave para el trigger n8n) |
| **Reprogramado** / Ultimo Reproceso | ❌ no existen |

### Envios de Emails (`tblsh8KaCMQ8KoKeU` → `envios_emails`)

| Airtable field | present? |
|---|---|
| Estado (singleSelect: Borrador, Pendiente, Procesando, Completado, Error) | ⚠️ schema usa `estado TEXT DEFAULT 'Pendiente'` (sin ENUM/CHECK) — choices no validados |
| Total Emails / Emails Creados / Fecha Completado | ❌ no existen |

### Ediciones (`tblYhOznRk0bdEROJ` → `ediciones`)

| Airtable field | present? |
|---|---|
| Estado (singleSelect) | ✅ ENUM coincide (Planificada, Prelanzamiento, Abierta, Finalizada) |
| Modulos Disponibles | ✅ |
| **Fecha Inicio Prelanzamiento** | ❌ no existe |
| **Plazos Revision** (JSON richText) | ❌ no existe |

### Modulos (`tbly892Tp5KZBDWgr` → `modulos`)

| Airtable field | present? |
|---|---|
| Precio Online | ✅ |
| **Precio Efectivo** | ❌ no existe |
| Reserva Prelanzamiento | ⚠️ **type-mismatch**: Airtable = `number` (plazas), schema = `BOOLEAN` |

### Inbox (`tblyp8NSzdpnTqkPD` → `inbox`)

| Airtable field | present? |
|---|---|
| Estado (singleSelect) | ✅ ENUM coincide |
| Direccion / Tipo Consulta | ✅ |
| **Origen** (`fldoGWwxwJd2B82je`) | ❌ singleSelect (Automatico/Manual) sin columna |
| **Fecha Apertura** | ❌ no existe (tracking pixel) |
| **Gmail Leido** | ❌ no existe |
| **Gmail Eliminado** | ❌ no existe |

### Configuración (`tblVyseTbKEU2CrTX`)

❌ **No existe tabla `configuracion` en schema.sql.** Contiene parámetros de sistema + plantillas visuales. Evaluar si entra en alcance de migración.

---

## (c) Checklist de parche de schema ANTES del data load

Ejecutar en este orden. (No ejecutado — propuesta.)

```sql
-- 1. ENUMS: añadir valores nuevos (ALTER TYPE ... ADD VALUE no es transaccional en bloque)
ALTER TYPE estado_revision ADD VALUE IF NOT EXISTS 'Video no accesible';
ALTER TYPE estado_pago     ADD VALUE IF NOT EXISTS 'Completado';
ALTER TYPE estado_pago     ADD VALUE IF NOT EXISTS 'Pendiente Verificación';
ALTER TYPE origen_evento   ADD VALUE IF NOT EXISTS 'Sistema';

-- 2. Nuevo ENUM para Origen (Cola de Emails + Inbox)
CREATE TYPE origen_email AS ENUM ('manual_template','manual_quick','Automatico','Manual');

-- 3. Alumnos: pareja + flags campaña
ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS pareja_email TEXT,
  ADD COLUMN IF NOT EXISTS pareja_alumno_id UUID REFERENCES alumnos(id),
  ADD COLUMN IF NOT EXISTS onboarding_enviado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueado_proev26 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS disculpa_enviada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS prelanzamiento_enviado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_prelanzamiento INT DEFAULT 0;

-- 4. Revisiones
ALTER TABLE revisiones_video
  ADD COLUMN IF NOT EXISTS email_alumno TEXT,
  ADD COLUMN IF NOT EXISTS perfiles_rrss TEXT;

-- 5. Historial
ALTER TABLE historial ADD COLUMN IF NOT EXISTS workflow TEXT;

-- 6. Cola de Emails
ALTER TABLE cola_emails
  ADD COLUMN IF NOT EXISTS origen origen_email,
  ADD COLUMN IF NOT EXISTS asunto_generado TEXT,
  ADD COLUMN IF NOT EXISTS email_generado TEXT,
  ADD COLUMN IF NOT EXISTS fecha_envio DATE,
  ADD COLUMN IF NOT EXISTS reprogramado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultimo_reproceso TIMESTAMPTZ;

-- 7. Inbox
ALTER TABLE inbox
  ADD COLUMN IF NOT EXISTS origen origen_email,
  ADD COLUMN IF NOT EXISTS fecha_apertura TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gmail_leido BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmail_eliminado BOOLEAN DEFAULT false;

-- 8. Envios de Emails
ALTER TABLE envios_emails
  ADD COLUMN IF NOT EXISTS total_emails INT,
  ADD COLUMN IF NOT EXISTS emails_creados INT,
  ADD COLUMN IF NOT EXISTS fecha_completado DATE;

-- 9. Ediciones
ALTER TABLE ediciones
  ADD COLUMN IF NOT EXISTS fecha_inicio_prelanzamiento DATE,
  ADD COLUMN IF NOT EXISTS plazos_revision JSONB;

-- 10. Modulos: precio efectivo + corregir type de reserva
ALTER TABLE modulos ADD COLUMN IF NOT EXISTS precio_efectivo NUMERIC(10,2);
-- type-mismatch: Airtable "Reserva Prelanzamiento" es número de plazas, no boolean
ALTER TABLE modulos ADD COLUMN IF NOT EXISTS reserva_prelanzamiento_plazas INT;
-- (decidir si se reemplaza la columna boolean existente)

-- 11. (opcional, fuera de alcance core) tabla configuracion
-- CREATE TABLE configuracion (...);
```

> **Cuidado con `estado_pago`:** schema.sql incluye `'Pagado'` que NO existe en Airtable. Antes del import, mapear/limpiar: probablemente `Pagado`(legacy) → `Completado`. Verificar con datos reales.

---

## (d) singleSelect que rompen el import de datos

Estos valores existen en filas de Airtable pero NO en el ENUM de Postgres — el INSERT fallaría:

| Tabla.campo | Valor en Airtable ausente del ENUM | Acción |
|---|---|---|
| `revisiones_video.estado_revision` | **`Video no accesible`** | ADD VALUE antes del load |
| `pagos.estado_pago` | **`Completado`**, **`Pendiente Verificación`** | ADD VALUE; revisar mapeo de `Pagado` legacy |
| `historial.origen_evento` | **`Sistema`** | ADD VALUE |
| `cola_emails.origen` | `manual_template`, `manual_quick` | crear ENUM/columna |
| `inbox.origen` | `Automatico`, `Manual` | crear ENUM/columna |
| `envios_emails.estado` | `Borrador`, `Procesando`, `Completado` (vs `estado TEXT` libre) | añadir CHECK o ENUM |

Nota adicional: Airtable `idioma` usa `Español`/`Ingles`; el ENUM PG usa `Espanol` (sin ñ) — **mapear con normalización** en el migrador o el import fallará para todos los alumnos en español.
