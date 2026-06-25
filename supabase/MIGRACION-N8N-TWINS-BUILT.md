# n8n Supabase twins — build log (COMPLETO)

**Estado: 24/24 workflows ProEv tienen twin Supabase. TODOS INACTIVOS.** Nada de producción
se tocó ni activó. Activación = solo en el cutover big-bang (Stripe el último).
Instancia n8n: `https://drava-n8n.lk0nyk.easypanel.host` (prod). Credencial Supabase: `8VXztyOWvaGzChfz`.
Buscar `[SB-TWIN]` en la lista de workflows para verlos.

## Twins (original → twin, inactivo, validado 0 errores salvo nota)
| # | Original | Twin id | Workflow | Trigger |
|---|---|---|---|---|
| 1 | R3mQiCRZ8tu66yaQ | `sJ3HEoC6C9qFEhFR` | Gestionar Estado Edicion (→Sub repunteado) | Schedule |
| 5 | vAXmsu9exm9LEbID | `Z2PZdRgimnJvA1hn` | Consultar Plazas (canónico pre-existente) | Webhook |
| 7 | yP0Ehu1fk86ZAJoS | `mEDU1PCOKqQt2NIE` | [Sub] Campaña Email Apertura | executeWorkflow |
| 2 | RHglZuskaIiC42lg | `eV7qKsqMr6fDdN7P` | Sync 60min Papelera Gmail→Inbox | Schedule |
| 3 | qaDQHyiZ8WKPfFUJ | `QTTxz42B9Ml8yVkC` | Estado Leido - Marcar Gmail | **airtableTrigger→Webhook** |
| 4 | eEc8XBMo2ej1xSlv | `9JLmrgFRBCvOtdLs` | Link Tracking Click | Webhook |
| 6 | NjXLz3D0Fd87KjzC | `cDszir6TGOldTLfS` | Estado Eliminado - Papelera Gmail | **airtableTrigger→Webhook** |
| 8 | 1ECKTnP1Nvo6x-5BydqFY | `xZpHLPtTCqPZj72b` | Reprocesar Cola de Emails | Manual/Webhook |
| 9 | a9F0DmOsWFohjKlM | `9xkOkOFjcxTiI2tK` | Pixel Tracking Apertura | Webhook |
| 10 | KvsgidqUkHMMjPxA | `MxkkVlHoQ4GRXXDL` | Respuesta Final - Reply Gmail | **airtableTrigger→Webhook** |
| 11 | RrcIiAsEnAWBbQTi | `eq1kDPCepRoNFCiE` | Sync 30min Enviados→Inbox | Schedule |
| 12 | yXqwbWnocDa1bG48 | `DMW24WqkScM7GpHi` | Diario 3am Borrar Eliminados +30d | Schedule |
| 13 | 6IyUv44O8X8JZv9J | `n8iB6hVEVw6xlIsc` | Campana Reactivacion Promo Anti-Ban | Webhook/Manual |
| 14 | iFHwczOWaQxD8hdG | `GZMY1flgIfw7mN4C` | Emails segun Estado | **airtableTrigger→Webhook** |
| 15 | 0C0AuwYqsJNh8yZ4 | `KrFiR9Q1fE9VO0mm` | Gmail Nuevo Email - Clasificar AI | Gmail |
| 16 | 86TaFQgNjXIFP2rA | `q0S3dYF0mO4S656q` | Alertas - Detectar Alumnos en Riesgo | Schedule |
| 17 | tAsjIcEV9celCA7y | `T9zLpcIboZvTlhe1` | Alumno Pagado - Enviar Onboarding | **airtableTrigger→Webhook** |
| 18 | L0d0Nj24XosJI0HB | `Hhc5F2Y8UKpYihrb` | Envio Masivo - Crear Cola Individual | **airtableTrigger→Webhook** |
| 19 | 8uotHUeyyM01LfFx | `ZpTKSzQJeMDowOM1` | Cola Email - Procesar y Enviar AI | **airtableTrigger→Webhook** |
| 20 | JzY10GKy2yaNJmEI | `9nRDVRzKctOw7lGH` | Formulario Interes - Opciones Modulo (41 nodos) | Webhook |
| 21 | kWDjtwTRmQfUC0B5 | `3WDtM629rGgWsvkB` | Nueva Inscripcion - Crear Alumno | **airtableTrigger→Webhook** |
| 22 | MqNEU6FH4sOkvzwq | `jl67tZr0ibxrVoVV` | Sync Video - Revisiones | **airtableTrigger→Webhook** |
| 23 | jVbu6iqRWsgfYvTI | `YZPmyXrQlJyXyeqP` | Boton Modulo - Verificar Capacidad y Pago | Webhook ⚠️2 warnings-as-errors |
| 24 | 5qjxfOD03sHUeRbr | `XikVC07KC9xNURhK` | [Stripe] Pago Recibido (money path) | Stripe webhook |

Patrón aplicado en todos: nodos/HTTP Airtable → nodo `n8n-nodes-base.supabase` (tablas snake_case
de schema.sql, FIELD_MAP del migrador); FK shift `[recXXX]`→UUID escalar (eliminado `field[0]`);
lógica no-Airtable (LLM/Gmail/Code/IF) preservada verbatim.

## Flags de cutover

### A. Triggers — crear Supabase DB Webhooks (INACTIVOS hasta cutover)
Los 9 `airtableTrigger` se reemplazaron por nodos Webhook (path `sb-…`). Crear en Supabase un Database
Webhook por cada uno → nodo Webhook del twin. **Loop-guard obligatorio** en los que escriben su propia
tabla (la condición de disparo excluye el valor que el flujo escribe). Specs en los sticky notes de cada
twin. Tablas/eventos: `inbox` UPDATE (#3,#6,#10), `alumnos` UPDATE (#14,#17), `cola_emails` INSERT/UPDATE
(#19), `envios_emails` INSERT/UPDATE (#18), `inscripciones` INSERT (#21),
`revisiones_video` UPDATE cuando `estado_revision` cambia a `'Revision Necesaria'`
(workflow C3 `Bsmd5DcKXCG244wN` — usa `airtableTrigger` hoy; necesita este webhook al cutover).

### B. Gaps de schema Supabase (añadir ANTES de activar los workflows que los usan)
- ❌ **Tabla `inscripciones` no existe** (form-intake) — bloquea #21. Crearla, o que el form haga POST directo al webhook.
- ❌ **`alumnos.alerta_activa`** (fórmula Airtable) — núcleo de #16. Reimplementar (columna generada / vista / Code).
- ❌ **`alumnos.dias_desde_ultimo_evento`** (derivado) — usado por #16.
- ❌ **`alumnos.modules`** (rollup) — #14,#15,#20 (tienen fallback a `modulos_completados`).
- ⚠️ No bloqueantes (fallback en twin): `display_name`→`nombre`, `feedback_video`→`resumen_feedback_ia`,
  `enlace_pago`→Stripe URL, `envios_emails.nombre`→`descripcion`.
- ⚠️ Opcional: `cola_emails.envio_id` (trazabilidad cola→envío, dropeado en #18).

### C. Repointing de URLs/paths (al cutover)
- Webhook paths con prefijo `sb-` → repuntar los generadores de URLs (dashboard / otros workflows).
- **recId → UUID**: las URLs de pixel/click/token (#4,#9,#20,#21) y los hardcoded recId deben emitir UUIDs Supabase.
- **#7 Sub**: `Simular Input` recId `recLTGTKislECUVYG` (solo test) → UUID edición.
- **Stripe (#24)**: repuntar el endpoint del Stripe Dashboard al webhook del twin (o mantener path/webhookId idénticos).

### D. Seguridad
- Webhooks que disparan envíos (Gmail reply #10, etc.) están **sin auth** (igual que el patrón canónico) →
  asegurar (header/secret) antes de activar.

### E. A verificar en 1ª ejecución
- #23: 2 "errores" de validación = falsos positivos (respondToWebhook en fan-out de éxito, idéntico a prod) — confirmar.
- Coerción boolean (`gmail_eliminado`, `reprogramado`, `prelanzamiento_enviado`) y envelope del payload DB-webhook (`body.record`).
- Idempotencia Stripe (#24): dedup `pagos.id_sesion_stripe` — probar con evento real.

## Cutover (resumen, big-bang coordinado)
1. Aplicar parche de schema (sección B) + crear DB Webhooks inactivos (A).
2. Apagar sync A→S; activar sync inverso S→A (red de seguridad).
3. Flip `VITE_DATA_SOURCE=supabase` en prod + activar twins n8n + DB webhooks; desactivar originales Airtable.
   Orden: pilotos read-only → resto → **Stripe (#24) el ÚLTIMO**.
4. Repuntar URLs/endpoints (C). Vigilar ejecuciones.
