# Pre-flight de cutover Airtable → Supabase — 2026-06-15 (≈19:00 GMT+2)

> Verificación read-only / dry-run. **Cero cambios en producción.** Acompaña a
> `MIGRACION-CUTOVER-RUNBOOK.md`. Veredicto: **capa de datos lista; cutover en vivo NO recomendado
> todavía** — faltan gates operativos (ver 🔴).

## ✅ VERIFICADO EN VIVO HOY (verde)

| # | Check | Evidencia |
|---|---|---|
| 1 | n8n MCP apunta a PROD y responde | `drava-n8n.lk0nyk.easypanel.host`, health `ok`, v2.57.4 |
| 2 | 24 originales Airtable **activos** | cross-ref de los 84 workflows live vs `MIGRACION-N8N-TWINS-BUILT.md` |
| 3 | 24 twins + Tally intake (`l4i90Cyy7F8YEPth`) **inactivos** | incl. Stripe twin `XikVC07KC9xNURhK` = `active:false` |
| 4 | 5 nodos dual-write tracking **disabled** | pixel `a9F0DmOsWFohjKlM` (3) + click `eEc8XBMo2ej1xSlv` (2) → `disabled:true`; sin shadow-writes |
| 5 | Sync A→S **verde** | 6/6 últimas runs `success`; última 16:56Z (~hace 27 min). GitHub secrets OK (el job corre) |
| 6 | **Parity field-level = PASS** | `validate_parity.py` live: 2733 filas, **0 missing / 0 orphaned / 0 mismatch** |
| 7 | Datos **frescos** (sync al día) | conteos ↑ vs snapshot runbook: alumnos 143→145, cola_emails 232→234, inbox 393→395, historial 1845→1851 |
| 8 | **Reverse-sync S→A dry-run limpio** | `sync_supabase_to_airtable.py --dry-run`: 9 tablas, 2733 PATCH, 0 CREATE, **0 escrituras, 0 errores/422** |
| 9 | Entorno local listo para dry-runs | Python 3.13.7 + psycopg2 + requests OK; creds en `%TEMP%\migration_creds.sh` |

## ✅ CERRADO EN 2ª PASADA (lecturas live, sin tocar prod)

| Check | Evidencia |
|---|---|
| **9 DB webhooks DISABLED** (guarda anti-bucle) | `pg_trigger.tgenabled='D'` para los 9 `sbwh_*` (inbox×3, alumnos×2, cola_emails, envios_emails, inscripciones, revisiones_video) |
| **Schema gaps aplicados + poblados** | `inscripciones`=147 filas; `alumnos_enriched`: `modules` 136/145, `alerta_activa` 145/145, `dias_desde_ultimo_evento` 145/145 non-null |
| **Twin #23 topología fiel** | `n8n_validate_workflow` del twin `YZPmyXrQlJyXyeqP` y del original prod `jVbu6iqRWsgfYvTI` dan **los 2 mismos "errores"** (fan-out de éxito mal interpretado como error-handler) → falso-positivo del heurístico, reproducido fielmente. El original corre en prod sin problema |

## ✅ Lecturas Supabase validadas (sonda anon-key)

Sonda REST con la **anon key del frontend** (ruta exacta del dashboard): **9/9 tablas HTTP 200 con datos**
(`alumnos_enriched`, `ediciones`, `modulos`, `pagos`, `revisiones_video`, `cola_emails`, `inbox`,
`historial`, `inscripciones`). Conectividad + RLS-permite-SELECT confirmados. (Pendiente solo el
recorrido visual página-a-página, opcional: parity ya probó la corrección de los datos.)

## 🟡 PENDIENTE
- Twins #14/#15/#16/#20 leerán `modules`/`alerta_activa`/`dias_*` (ya poblados) → confirmar en 1ª ejecución del twin (solo posible en el cutover).
- Recorrido visual de lecturas en Preview/local (opcional).

## 🔴 GATES PENDIENTES ANTES DE UN CUTOVER EN VIVO

1. **Cadencia del sync ≈ 2h, no 15 min** (GitHub throttle de crons en repos poco activos). El paso "congelar escrituras + `--load` final" del runbook es **obligatorio** — no asumir Supabase <15 min fresco.
2. **Reverse-sync nunca corrido con `--load`** → red de seguridad sin probar contra Airtable real. El dry-run no detecta 422. Primer `--load` debe ser **por-chunk y monitorizado** (runbook).
3. **Credenciales sin rotar** (password Supabase + PAT Airtable siguen siendo las de migración en `%TEMP%`) — runbook paso 1. **DECISIÓN DEL USUARIO (2026-06-15): no rotar por ahora.** Se asume el riesgo de seguir con las creds de migración hasta nuevo aviso; rotar antes del go-live productivo real.
4. **Precondición "sync estable varios días"**: lleva ~1 día. Borderline.
5. **La mayoría de pasos son manuales/externos** (Vercel flip, endpoint Stripe Dashboard, webhook Tally, ENABLE DB webhooks SQL) → requieren a David en vivo.
6. **🔒 HALLAZGO DE SEGURIDAD (nuevo, 2ª pasada)**: la sonda demuestra que la **anon key** (pública, embebida en el bundle JS; CSP ya permite `connect-src` a `supabase.co`) lee **TODAS** las tablas, incluidas `pagos`, `historial`, `inbox` (PII de alumnos). Hoy, en Airtable, las lecturas pasan por el **proxy serverless `/api/airtable/*` con validación `X-ProEv-Session`**. Con `VITE_DATA_SOURCE=supabase` el navegador iría **directo** a Supabase → cualquiera con la anon key leería todos los datos. **Es un retroceso del modelo de seguridad.** Decidir antes del go-live: (a) mantener el modelo proxy-serverless también para Supabase, o (b) RLS atada a usuario autenticado en vez de anon permisiva. No bloquea el cutover técnico, pero sí el go-live productivo real.

## Recomendación

La **capa de datos está cutover-ready** (parity 0 bugs + reverse-sync limpio + estado n8n correcto).
Antes de la ventana big-bang, cerrar gates operativos en este orden:
1. Rotar credenciales (paso 1 runbook) y reconfigurar secrets/env.
2. Correr el reverse-sync `--load` **una vez, monitorizado por-chunk**, como prueba real de la red de seguridad.
3. Completar la validación de lecturas en Preview deploy.
4. Dejar el sync madurar 2-3 días (o aceptar el `--load` final de la ventana como garantía de frescura).
5. Agendar ventana de mantenimiento: **yo conduzco los flips n8n** (activar 22 twins con Stripe el último + ENABLE de los 5 nodos dual-write tras apagar el sync) mientras **David hace los pasos externos** (Vercel/Stripe/Tally/Supabase/creds).

## Artefactos regenerados (read-only)
- `parity_validation_report.md` (PASS, 2733 filas)
- `reverse_sync_report.md` (dry-run, 2733 PATCH planeados)
