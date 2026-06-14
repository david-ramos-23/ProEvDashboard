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

## Hardening pendiente
- **`--prune`** en el migrador: borrar de Supabase filas cuyo `airtable_id` ya no esté en Airtable
  (maneja borrados), con guarda anti-borrado-masivo. Hasta entonces, el sync solo añade/actualiza.
- **Sync inverso** Supabase→Airtable: requerido antes del big-bang. No construido aún.
