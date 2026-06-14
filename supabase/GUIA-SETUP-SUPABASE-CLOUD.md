# Guía paso a paso — Setup de Supabase Cloud para la migración ProEv

> Objetivo: reutilizar el proyecto Supabase Cloud existente (free tier), cargar el esquema ya parcheado, y obtener
> las 3 credenciales que desbloquean la migración de datos. **Nada de esto afecta producción ni cambia
> el backend activo** — el dashboard sigue leyendo de Airtable (`VITE_DATA_SOURCE=airtable`) hasta el
> cutover explícito (fase posterior).

---

## Paso 0 — Antes de empezar (2 min)
- Ten a mano una cuenta en [supabase.com](https://supabase.com) (login con GitHub vale).
- Decide un **password de base de datos** fuerte y guárdalo (lo pide al crear el proyecto y no se vuelve a mostrar entero).

---

## Paso 1 — Reutilizar el proyecto existente (5 min)
> **Nota:** ya existe un proyecto Supabase reutilizable, `qktvdmoggniufynaodzq` (estaba pausado; restaurado).
> Úsalo en lugar de crear uno nuevo. Solo si por alguna razón no está disponible, crea uno nuevo siguiendo los pasos de abajo.

1. Entra en [app.supabase.com](https://app.supabase.com) → abre el proyecto `qktvdmoggniufynaodzq` (si está pausado, **Restore**).
2. Si tuvieras que crear uno nuevo (**New project**), rellena:
   - **Name**: `proev-dashboard` (o el que prefieras).
   - **Database Password**: el que guardaste en el Paso 0.
   - **Region**: **West EU (Ireland)** o **Central EU (Frankfurt)** — cercanía a usuarios ES + RGPD.
   - **Plan**: **Free**.
3. Si lo creaste nuevo: **Create new project** → espera ~2 min a que aprovisione.

> ⚠️ Free tier: 500 MB de base de datos, 1 GB de storage, y **el proyecto se pausa tras ~7 días de
> inactividad** (se reactiva manualmente desde el panel). Suficiente para el volumen actual de ProEv,
> pero a vigilar.

---

## Paso 2 — Cargar el esquema parcheado (5 min)
1. En el proyecto → menú lateral **SQL Editor** → **New query**.
2. Abre el archivo `dashboard/supabase/schema.sql` del repo (ya parcheado: 25 drift items + columna
   `airtable_id` en las 9 tablas de negocio). Copia **todo** su contenido y pégalo en el editor.
3. Pulsa **Run** (Ctrl/Cmd + Enter).
4. Verifica que terminó sin errores. En **Table Editor** deberías ver las tablas:
   `ediciones`, `modulos`, `alumnos`, `revisiones_video`, `pagos`, `envios_emails`, `cola_emails`,
   `inbox`, `historial`, `configuracion`, `audit_log` + las vistas `alumnos_enriched` / `modulos_enriched`.

> Si algún `CREATE` falla por "already exists", el script ya se corrió antes — bórralo o usa un proyecto limpio.

---

## Paso 3 — Obtener las credenciales (3 min)
Necesito estas para arrancar la migración de datos. Las claves van en **`dashboard/.env.local`** (NO en el `.env.local` de la raíz del repo):

| Variable | Dónde encontrarla en el panel |
|----------|-------------------------------|
| `VITE_SUPABASE_URL` | **Settings → API → Project URL** (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | **Settings → API → Project API keys → `anon` / `public`** |
| `SUPABASE_DB_URL` | **Settings → Database → Connection string → URI** |
| `AIRTABLE_PAT` | PAT de Airtable (lectura) |
| `AIRTABLE_BASE_ID` | `app4ZpoxaWOyV4RnR` |

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` ya están contempladas para el frontend; aquí solo se confirman.

Para `SUPABASE_DB_URL`:
- Usa la pestaña **URI**. Formato: `postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres`.
- Sustituye `[PASSWORD]` por el password del Paso 0.
- Para una carga por lotes (psycopg2) usa la **conexión directa (puerto 5432)**, no el transaction pooler (6543).

> 🔒 Trátalas como secretos. Ponlas en `dashboard/.env.local` (o como variables de entorno) y yo las leo desde ahí (ver Paso 4).

---

## Paso 4 — Ejecutar la migración de datos (lo hago yo)
Una vez tenga las credenciales:

```bash
# 1. Dependencias del migrador (aún no instaladas; imports guardados)
pip install requests psycopg2-binary

# 2. DRY-RUN: lee Airtable, valida contra el schema, NO escribe. Revisar el reporte.
export AIRTABLE_PAT=...            # PAT de Airtable (lectura)
export AIRTABLE_BASE_ID=app4ZpoxaWOyV4RnR
python dashboard/supabase/migrate_airtable_data.py --dry-run
#   → genera dashboard/supabase/migration_data_report.md (conteos + fallos de validación por tabla)

# 3. LOAD real (idempotente, ON CONFLICT (airtable_id)): solo tras revisar el dry-run
export SUPABASE_DB_URL='postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres'
python dashboard/supabase/migrate_airtable_data.py --load
```

El `--load` es **re-ejecutable**: si algo falla a mitad, se vuelve a correr sin duplicar (upsert por `airtable_id`).

---

## Paso 5 — Después de cargar (fases siguientes, NO automáticas)
Estas las coordinamos después, una a una, con verificación:
1. **CSP/env en Vercel**: `connect-src 'self'` en `dashboard/vercel.json` bloquea el SDK Supabase directo
   → añadir la URL Supabase a `connect-src` (con RLS) **o** proxiar `/api/data/*`. Setear
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` en Vercel.
2. **Modo sombra**: comparar lecturas Airtable vs Supabase sin cambiar el backend activo.
3. **Repoint n8n** (24 workflows): empezar por los pilotos read-only
   (`[Schedule] Gestionar Estado Edicion`, `[Webhook] Consultar Plazas`), `[Stripe] Pago Recibido` el último.
4. **Cutover**: cambiar `VITE_DATA_SOURCE` a `supabase` solo cuando sombra + workflows estén verdes.

---

## Resumen de qué necesito de ti
1. ✅ Proyecto Supabase Cloud disponible — reutilizar `qktvdmoggniufynaodzq` (Paso 1).
2. ✅ `schema.sql` ejecutado sin errores (Paso 2).
3. ✅ Las 3 credenciales (Paso 3): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`.

Con eso corro dry-run → te enseño el reporte → y solo entonces hacemos el load.
