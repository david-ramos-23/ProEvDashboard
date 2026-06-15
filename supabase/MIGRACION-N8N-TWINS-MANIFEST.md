# BUILD MANIFEST — ProEv n8n → Supabase twins

> **READ-ONLY analysis.** No workflow was created, modified, activated, archived or deleted.
> Generated: 2026-06-15. Source of truth = live PRODUCTION n8n (24 ProEv workflows inspected
> in `structure` mode; #1 also in `full` mode for the executeWorkflow target).
> Complements `MIGRACION-N8N-TWINS-PLAN.md` and `MIGRACION-INVENTARIO-N8N.md`.
> Supabase write credential: `8VXztyOWvaGzChfz` ("Supabase ProEv Cloud", `supabaseApi`).

## 1. Workflow inventory (all 24, verified against live nodes)

R = read-only against Airtable; W = writes to Airtable. Airtable cols: at = native `n8n-nodes-base.airtable`
nodes / http = raw HTTP nodes to `api.airtable.com`. (`airtableTrigger` shown in Trigger column.)

| # | ID | Name | Active | R/W | Trigger | at | http | Twin? |
|---|---|---|:--:|:--:|---|:--:|:--:|---|
| 1 | `R3mQiCRZ8tu66yaQ` | [Schedule] Gestionar Estado Edicion | yes | W | schedule | 1 | 1 | **DONE** `sJ3HEoC6C9qFEhFR` |
| 2 | `RHglZuskaIiC42lg` | [Schedule] Sync 60min Papelera Gmail a Inbox | yes | R | schedule | 1 | 1 | build |
| 3 | `qaDQHyiZ8WKPfFUJ` | [Airtable] Estado Leido Marcar en Gmail | yes | R | **airtableTrigger** | 0 | 1 | build |
| 4 | `eEc8XBMo2ej1xSlv` | [Webhook] Link Tracking Registrar Click | yes | W | webhook | 1 | 0 | build |
| 5 | `vAXmsu9exm9LEbID` | [Webhook] Consultar Plazas API Publica | yes | R | webhook | 3 | 0 | **DONE** `Z2PZdRgimnJvA1hn` |
| 6 | `NjXLz3D0Fd87KjzC` | [Airtable] Estado Eliminado Mover Papelera | yes | W | **airtableTrigger** | 0 | 2 | build |
| 7 | `yP0Ehu1fk86ZAJoS` | [Sub] Campaña Email Apertura Publica | yes | R/W | **executeWorkflowTrigger** | 2 | 0 | build (LEAF, sub of #1) |
| 8 | `1ECKTnP1Nvo6x-5BydqFY` | [Manual] Reprocesar Cola de Emails | yes | R/W | manual + webhook | 2 | 0 | build |
| 9 | `a9F0DmOsWFohjKlM` | [Webhook] Pixel Tracking Registrar Apertura | yes | W | webhook | 1 | 1 | build |
| 10 | `KvsgidqUkHMMjPxA` | [Airtable] Respuesta Final Enviar Reply Gmail | yes | W | **airtableTrigger** | 1 | 2 | build |
| 11 | `RrcIiAsEnAWBbQTi` | [Schedule] Sync 30min Emails Enviados | yes | R/W | schedule | 3 | 0 | build |
| 12 | `yXqwbWnocDa1bG48` | [Schedule] Diario 3am Borrar Eliminados +30d | yes | R/W | schedule | 2 | 1 | build |
| 13 | `6IyUv44O8X8JZv9J` | [Webhook/Manual] Campaña Reactivacion Anti-Ban | yes | R/W | manual + webhook | 3 | 1 | build |
| 14 | `iFHwczOWaQxD8hdG` | [Airtable] Emails segun Estado | yes | R/W | **airtableTrigger** | 2 | 0 | build |
| 15 | `0C0AuwYqsJNh8yZ4` | [Gmail] Nuevo Email Clasificar con AI | yes | R/W | gmailTrigger | 3 | 0 | build |
| 16 | `86TaFQgNjXIFP2rA` | [Schedule] Alertas Detectar Alumnos en Riesgo | yes | R/W | schedule | 3 | 0 | build |
| 17 | `tAsjIcEV9celCA7y` | [Airtable] Alumno Pagado Enviar Onboarding | yes | R/W | **airtableTrigger** | 1 | 3 | build |
| 18 | `L0d0Nj24XosJI0HB` | [Airtable] Envio Masivo Crear Cola Individual | yes | R/W | **airtableTrigger** | 2 | 3 | build |
| 19 | `8uotHUeyyM01LfFx` | [Airtable] Cola Email Procesar y Enviar con AI | yes | R/W | **airtableTrigger** | 2 | 5 | build |
| 20 | `JzY10GKy2yaNJmEI` | [Webhook] Formulario Interes Enviar Opciones | yes | R/W | webhook | 4 | 5 | build |
| 21 | `kWDjtwTRmQfUC0B5` | [Airtable] Nueva Inscripcion Crear Alumno | yes | R/W | **airtableTrigger** | 3 | 6 | build |
| 22 | `MqNEU6FH4sOkvzwq` | [Airtable] Sync Video Revisiones | yes | R/W | **airtableTrigger** | 6 | 4 | build |
| 23 | `jVbu6iqRWsgfYvTI` | [Webhook] Boton Modulo Verificar Capacidad | yes | R/W | webhook | 9 | 4 | build |
| 24 | `5qjxfOD03sHUeRbr` | **[Stripe] Pago Recibido Actualizar a Pagado** | yes | R/W | **stripeTrigger** | 11 | 3 | build — **LAST / highest risk** |

All 24 are **active** in production. Native-Airtable=66, airtableTrigger=9, raw-HTTP=43 (118 total touchpoints).

## 2. executeWorkflow dependency graph

Every one of the 24 was inspected for `n8n-nodes-base.executeWorkflow` nodes.
**Result: exactly ONE sub-workflow edge exists.**

```
#1 [Schedule] Gestionar Estado Edicion (R3mQiCRZ8tu66yaQ)
      │  node "Ejecutar Campaña Email" (executeWorkflow, waitForSubWorkflow:false, async)
      ▼
#7 [Sub] Campaña Email Apertura Publica (yP0Ehu1fk86ZAJoS)   ← has executeWorkflowTrigger
```

- **Edge:** `R3mQiCRZ8tu66yaQ` → `yP0Ehu1fk86ZAJoS` (async, fire-and-forget).
- **PARENT (calls a sub):** only #1.
- **LEAF (calls no sub):** all other 23, including #7 (#7 calls nothing — it only has the executeWorkflowTrigger entry + a disabled schedule).
- **Implication:** #1's twin is useless until #7's twin exists. Build #7 before #1. Since #1 is already done (`sJ3HEoC6C9qFEhFR`), #7's twin must be built and wired so the existing #1 twin's executeWorkflow node points at #7's twin (or #7 twin is swapped in place at cutover).
- **Side note (not a build target):** #1 declares `errorWorkflow: 5R7voQ7DIOtsgjDw` — a shared error-handler workflow outside the 24-workflow ProEv set. No Airtable coupling; ignore for twin build.

No other workflow contains executeWorkflow. The graph is otherwise 23 independent islands.

## 3. Already-built twins (SKIP)

| Original | Twin | Status |
|---|---|---|
| #5 `vAXmsu9exm9LEbID` Consultar Plazas | `Z2PZdRgimnJvA1hn` [Supabase] Consultar Plazas | built, inactive — reference pattern |
| #1 `R3mQiCRZ8tu66yaQ` Gestionar Estado Edicion | `sJ3HEoC6C9qFEhFR` [SB-TWIN] Gestionar Estado Edicion | built, inactive |

**To build = 22** workflows (24 minus these 2).

## 4. Ordered build batches (bottom-up; items within a batch are parallel-safe)

Order is driven by the dependency graph first (sub before parent), then by risk
(read-only & idempotent trackers first, money path last).

### Batch 0 — already done (skip)
`Z2PZdRgimnJvA1hn` (#5), `sJ3HEoC6C9qFEhFR` (#1).
> #1's twin pre-exists but logically belongs *after* #7's twin (its sub-dependency).
> Re-point / verify #1 twin's executeWorkflow target once #7 twin lands (Batch 1).

### Batch 1 — LEAF sub-workflow + standalone read-only / idempotent trackers (no dependencies)
| # | ID | Name | Why first |
|---|---|---|---|
| 7 | `yP0Ehu1fk86ZAJoS` | [Sub] Campaña Email Apertura | LEAF + sub of #1; unblocks #1's twin |
| 4 | `eEc8XBMo2ej1xSlv` | [Webhook] Link Tracking | 1 write, idempotent, high-volume, no deps |
| 9 | `a9F0DmOsWFohjKlM` | [Webhook] Pixel Tracking | 1 write, idempotent, no deps |
| 2 | `RHglZuskaIiC42lg` | [Schedule] Sync 60min Papelera | read + 1 HTTP, no deps |
| 3 | `qaDQHyiZ8WKPfFUJ` | [Airtable] Estado Leido | airtableTrigger (re-trigger §6), trivial |
| 8 | `1ECKTnP1Nvo6x-5BydqFY` | [Manual] Reprocesar Cola | manual trigger, 2 at, no deps |

### Batch 2 — parent of Batch 1 + MED single/dual-table sync/reads
| # | ID | Name | Note |
|---|---|---|---|
| 1-verify | `sJ3HEoC6C9qFEhFR` | [SB-TWIN] Gestionar Estado Edicion | re-point executeWorkflow → #7 twin, verify |
| 6 | `NjXLz3D0Fd87KjzC` | [Airtable] Estado Eliminado | airtableTrigger + 2 HTTP |
| 10 | `KvsgidqUkHMMjPxA` | [Airtable] Respuesta Final Reply | airtableTrigger + 2 HTTP |
| 11 | `RrcIiAsEnAWBbQTi` | [Schedule] Sync 30min Enviados | 3 at |
| 12 | `yXqwbWnocDa1bG48` | [Schedule] Diario 3am Borrar | 2 at + 1 HTTP (delete) |
| 13 | `6IyUv44O8X8JZv9J` | [Webhook/Manual] Reactivacion | 3 at + 1 HTTP |
| 14 | `iFHwczOWaQxD8hdG` | [Airtable] Emails segun Estado | airtableTrigger (state change) |
| 15 | `0C0AuwYqsJNh8yZ4` | [Gmail] Clasificar con AI | gmailTrigger, 3 at |
| 16 | `86TaFQgNjXIFP2rA` | [Schedule] Alertas Riesgo | 3 at |
| 17 | `tAsjIcEV9celCA7y` | [Airtable] Alumno Pagado Onboarding | airtableTrigger + 3 HTTP |
| 18 | `L0d0Nj24XosJI0HB` | [Airtable] Envio Masivo Cola | airtableTrigger + 3 HTTP |

### Batch 3 — HIGH multi-table cores (≥4 HTTP rewrites)
| # | ID | Name | Touchpoints |
|---|---|---|---|
| 19 | `8uotHUeyyM01LfFx` | [Airtable] Cola Email Procesar/Enviar | 2 at + 5 HTTP, airtableTrigger |
| 20 | `JzY10GKy2yaNJmEI` | [Webhook] Formulario Interes | 4 at + 5 HTTP (40 nodes) |
| 21 | `kWDjtwTRmQfUC0B5` | [Airtable] Nueva Inscripcion | 3 at + 6 HTTP, airtableTrigger |
| 22 | `MqNEU6FH4sOkvzwq` | [Airtable] Sync Video Revisiones | 6 at + 4 HTTP, airtableTrigger |
| 23 | `jVbu6iqRWsgfYvTI` | [Webhook] Boton Modulo Capacidad | 9 at + 4 HTTP (38 nodes) |

### Batch 4 — MONEY PATH (last, alone)
| # | ID | Name | Why last |
|---|---|---|---|
| 24 | `5qjxfOD03sHUeRbr` | **[Stripe] Pago Recibido** | 11 at + 3 HTTP, only writer of `pagos`; stripeTrigger; a failure loses a real payment. Build only after all others verified in shadow mode. |

## 5. Build dependency edges (summary)
- `yP0Ehu1fk86ZAJoS` (#7) **must precede** `R3mQiCRZ8tu66yaQ`/`sJ3HEoC6C9qFEhFR` (#1).
- All other 21 build targets have **no inter-workflow build dependency** (parallel-safe within their batch).

## 6. Top risks
1. **`airtableTrigger` has no Supabase equivalent (9 workflows): #3, #6, #10, #14, #17, #18, #19, #21, #22.** Each twin needs a replacement trigger — Supabase DB webhook / dashboard-emitted webhook, or scheduleTrigger poll on `updated_at`/estado. This is the #1 architecture decision; affects 9 of 24.
2. **Raw-HTTP-heavy workflows** (most expression/formula rewrites): #21 (6 HTTP), #19 (5), #20 (5), #22 (4), #23 (4). Each HTTP node → rewrite URL (base/table/recordId), `filterByFormula` → PostgREST `filterString`, and `fields:{}` → `fieldsUi` snake_case.
3. **Linked-record FK shift:** Airtable REST returned arrays of record IDs; Supabase FKs are direct UUIDs (e.g. `edicion_id`). Code nodes doing `[0]` indexing must be fixed (notably #21, #22).
4. **#24 Stripe** is the single point of money-path failure (only `pagos` writer, 14 Airtable touchpoints, duplicate-payment guard logic). Highest blast radius.
5. **#1 → #7 async edge** (`waitForSubWorkflow:false`): #1 twin silently no-ops the campaign trigger if #7's twin isn't wired in — easy to miss because the parent won't error.
