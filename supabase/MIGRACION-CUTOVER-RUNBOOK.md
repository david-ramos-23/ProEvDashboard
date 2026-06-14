# Runbook de cutover Airtable → Supabase

> Estrategia: **modo sombra con rollback instantáneo**. Airtable sigue siendo la única
> fuente de verdad hasta un cutover deliberado. Supabase corre en paralelo, refrescado por
> un sync unidireccional. Cutover final = **big-bang coordinado** (dashboard + n8n a la vez).

## Estado (2026-06-14)
- Parity de datos **verificada campo a campo**: 2721 filas, 0 discrepancias (`parity_validation_report.md`).
- Sync A→S: GitHub Action `.github/workflows/airtable-supabase-sync.yml` (cron 15 min, `--load` idempotente).
- CSP: `vercel.json` ya permite `https://qktvdmoggniufynaodzq.supabase.co` en `connect-src`.
- `envios_emails` vacía a propósito (tabla huérfana, sin writer/reader). No requiere acción.

---

## Acciones manuales de David (en orden)

### 1. Rotar credenciales (seguridad — pendiente desde la migración)
La password de Supabase se regeneró durante la migración y vive en un fichero temporal local.
- Rotar password DB en Supabase (Settings → Database → Reset password). Usar el **host pooler** (IPv4).
- Rotar el PAT de Airtable "ProEv Migration" (solo lectura).
- Borrar `%Temp%\migration_creds.sh` tras rotar.

### 2. Configurar secrets del GitHub Action (repo ProEvDashboard → Settings → Secrets → Actions)
| Secret | Valor |
|---|---|
| `AIRTABLE_PAT` | PAT lectura sobre la base ProEv |
| `AIRTABLE_BASE_ID` | `app4ZpoxaWOyV4RnR` |
| `SUPABASE_DB_URL` | conn string Postgres con host **pooler** (`...pooler.supabase.com`, IPv4) |

> Poner los secrets **antes** de mergear el workflow a `master`, o el primer cron fallará.

### 3. Activar el sync
- Mergear el workflow a `master`.
- Lanzar 1 ejecución manual (Actions → "Airtable → Supabase sync" → Run workflow) y revisar que el
  resumen del job diga `Fetched: N | Mapped OK: N | Failed: 0`. A partir de ahí, cron cada 15 min.

### 4. Configurar env vars de Supabase en Vercel (scope **Preview** primero)
| Var | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://qktvdmoggniufynaodzq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key del proyecto |
| `VITE_DATA_SOURCE` | `supabase` (solo en el deploy de validación) |

### 5. Validar lecturas en un Preview deploy
Deploy Preview con `VITE_DATA_SOURCE=supabase`. Recorrer todas las páginas y contrastar con prod
(Airtable). Mismo checklist de conteos: alumnos 143, pagos 7, revisiones 93, cola_emails 232,
inbox 393, historial 1845, ediciones 2, módulos 6.

---

## El interruptor (lectura prod) y rollback
La fuente de lectura/escritura del dashboard = env var **`VITE_DATA_SOURCE`** en Vercel.
- A `supabase` + redeploy (~1 min) → dashboard sobre Supabase.
- A `airtable` + redeploy → rollback.

⚠️ **`VITE_DATA_SOURCE` conmuta lectura Y escritura juntas.** Mientras n8n escriba en Airtable, NO
poner el dashboard de prod en `supabase` (las escrituras del dashboard irían a Supabase y el sync
A→S las pisaría). El rollback es **gratis solo mientras no se escriba en Supabase en prod**.

---

## Cutover big-bang coordinado (fase final, planificar aparte)
Precondición: Preview validado + sync estable varios días + sync inverso (Supabase→Airtable) listo.
1. Congelar escrituras (ventana corta de mantenimiento) y correr un `--load` final.
2. Activar sync **inverso** Supabase→Airtable (red de seguridad para rollback).
3. Repointar en bloque: escrituras del dashboard (`VITE_DATA_SOURCE=supabase` en prod) + los 24
   workflows n8n. Orden interno: pilotos read-only primero (`R3mQiCRZ8tu66yaQ`, `vAXmsu9exm9LEbID`
   — ya hay twin Supabase `Z2PZdRgimnJvA1hn`), **`[Stripe] Pago Recibido` el ÚLTIMO**.
4. Apagar el sync A→S. Vigilar ejecuciones.
5. Rollback (si algo falla): `VITE_DATA_SOURCE=airtable` + reactivar workflows Airtable; el sync
   inverso garantiza que Airtable tiene los datos escritos durante la ventana Supabase.

## Hardening — estado
- **`--prune`** ✅ construido (`migrate_airtable_data.py --prune`): borra de Supabase filas cuyo
  `airtable_id` ya no esté en Airtable. Guardas anti-wipe: salta si el fetch de una tabla viene vacío
  (salvo `envios_emails`) y si el borrado superaría el `--prune-threshold` (default 25%, override con
  `--prune-force`). Verificado en dry-run contra la DB real: 0 candidatos. **Para activarlo en el sync,
  añadir `--prune` al comando del GitHub Action** (ahora corre solo `--load`).
- **Sync inverso** Supabase→Airtable ✅ primer corte (`sync_supabase_to_airtable.py`, dry-run por
  defecto). ⚠️ Requiere **auditoría de campos escribibles** contra la base live antes de cualquier
  `--load` (no enviar campos computed/lookup/rollup → 422). Sin manejo de conflictos (PATCH pisa).

## Fase n8n (la pieza grande del cutover — planificar aparte)
24 workflows, **118 puntos de acoplamiento Airtable** (66 nodos nativos + 9 triggers + 43 HTTP crudo
a api.airtable.com). Plan: por cada workflow que ESCRIBE en Airtable, crear su **twin Supabase**
(nodos Postgres/Supabase en vez de Airtable; los 43 HTTP crudos hay que reescribirlos a queries).
Mantener los twins **inactivos**, validar contra datos en sombra, y en el cutover flipear triggers
(desactivar versión Airtable ↔ activar twin). Ya existe 1 twin: `Z2PZdRgimnJvA1hn` (Consultar Plazas).
Orden: pilotos read-only primero (`R3mQiCRZ8tu66yaQ`, `vAXmsu9exm9LEbID`), **`[Stripe] Pago Recibido`
el ÚLTIMO**. El sync inverso es la red de seguridad mientras dura. Mapeo de campos para reescribir
nodos = `FIELD_MAP` del migrador + `schema.sql`.

## Gates operativos (del review pre-merge, 2026-06-14)
El GitHub Action corre SOLO `--load` (upsert, sin borrados, no toca Airtable) → **sin riesgo activo**.
Review = SAFE-TO-MERGE, 0 CRITICAL, guardas anti-wipe del prune verificadas. Antes de habilitar más:
- **Antes de `--prune --load` con `--tables` subset**: podar una tabla PADRE sin sus hijos puede violar
  `alumnos.edicion_id` (RESTRICT) y abortar la transacción (sin pérdida, pero fallo confuso). En
  full-table —como el cron— no aplica.
- **Antes del reverse `--load`**: (a) auditar campos escribibles vs base live (computed/lookup/rollup
  → 422 toda la batch); (b) escribir recId de vuelta **por-chunk** (fallo parcial → POSTs duplicados al
  reintentar). Defaults dry-run mitigan hasta entonces.
- Menores: validar rango de `--prune-threshold` (0<x≤1); docstring "historial parent" self-FK es erróneo
  (inocuo). Pendientes de un hardening pass.
