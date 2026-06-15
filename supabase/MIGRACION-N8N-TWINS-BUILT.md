# n8n Supabase twins — build log

Todos los twins se crean **INACTIVOS** (`active:false`), validados (`valid:true`, 0 errores).
Nada de producción se toca/activa. Activación = solo en el cutover big-bang (Stripe último).
Credencial Supabase usada: `8VXztyOWvaGzChfz` ("Supabase ProEv Cloud").

## Batch 0 — pre-existentes
| # | Original | Twin | Workflow |
|---|---|---|---|
| 5 | `vAXmsu9exm9LEbID` | `Z2PZdRgimnJvA1hn` | [Webhook] Consultar Plazas (canónico) |
| 1 | `R3mQiCRZ8tu66yaQ` | `sJ3HEoC6C9qFEhFR` | [Schedule] Gestionar Estado Edicion |

## Batch 1 — hojas read-only / idempotentes ✅
| # | Original | Twin | Workflow | Tablas SB |
|---|---|---|---|---|
| 7 | `yP0Ehu1fk86ZAJoS` | `mEDU1PCOKqQt2NIE` | [Sub] Campaña Email Apertura Publica | alumnos, cola_emails |
| 4 | `eEc8XBMo2ej1xSlv` | `9JLmrgFRBCvOtdLs` | [Webhook] Link Tracking - Click | historial |
| 9 | `a9F0DmOsWFohjKlM` | `9xkOkOFjcxTiI2tK` | [Webhook] Pixel Tracking - Apertura | historial, inbox |
| 2 | `RHglZuskaIiC42lg` | `eV7qKsqMr6fDdN7P` | [Schedule] Sync 60min Papelera Gmail→Inbox | inbox |
| 3 | `qaDQHyiZ8WKPfFUJ` | `QTTxz42B9Ml8yVkC` | [Airtable] Estado Leido - Marcar en Gmail | inbox |
| 8 | `1ECKTnP1Nvo6x-5BydqFY` | `xZpHLPtTCqPZj72b` | [Manual] Reprocesar Cola de Emails | cola_emails |

## Flags de cutover (de Batch 1)
- **Re-point** del twin `sJ3HEoC6C9qFEhFR` (Gestionar Estado Edicion): su `executeWorkflow` debe llamar
  al nuevo Sub `mEDU1PCOKqQt2NIE` (no al original `yP0Ehu1fk86ZAJoS`). → en curso.
- **Supabase DB Webhooks a crear** (inactivos hasta cutover):
  - #3 → tabla `inbox`, evento **UPDATE**, condición `estado='Leido' AND direccion='Recibido' AND
    message_id<>'' AND gmail_leido=false`. ⚠️ **Loop-guard**: el propio UPDATE `gmail_leido=true` del
    twin NO debe re-disparar (filtrar en el trigger/función).
- **Paths webhook** renombrados con prefijo `sb-` (`sb-email-click`, `sb-email-track`, `sb-reprocesar`,
  `sb-inbox-estado-leido`) para no colisionar con prod → repuntar generadores de URL al cutover.
- **recId → UUID en URLs**: las URLs de pixel/click (`?alumno=`, `?inboxId=`) llevan recIds Airtable;
  quien las genere debe emitir UUIDs Supabase antes de activar (#4, #9).
- **#7 Sub**: `Simular Input` tiene recId hardcoded `recLTGTKislECUVYG` (solo ruta de test) → cambiar a
  UUID de edición Supabase. No afecta la ruta `executeWorkflowTrigger` real.
- **Verificar en 1ª ejecución de test**: coerción boolean (`gmail_eliminado`, `reprogramado`) y el
  envelope del payload de DB-webhook (`body.record` vs anidado).
- **Reconciliar plan**: `MIGRACION-N8N-TWINS-PLAN.md` row #4 dice `cola_emails`; el workflow live
  escribe `historial` (twin construido del JSON live, autoritativo).

## Pendiente
- Batch 2 (10): #6, #10, #11, #12, #13, #14, #15, #16, #17, #18.
- Batch 3 (5 HIGH): #19, #20, #21, #22, #23.
- Batch 4: #24 [Stripe] Pago Recibido (último).
