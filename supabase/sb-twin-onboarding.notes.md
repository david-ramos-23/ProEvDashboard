# SB-TWIN of tAsjIcEV9celCA7y ([Airtable] Alumno Pagado - Enviar Onboarding)

New workflow: `[SB-TWIN] [Airtable] Alumno Pagado - Enviar Onboarding`, id **T9zLpcIboZvTlhe1**, active:false. Validated 0 errors.

## Airtable -> Supabase swaps
| Original node | Original op | Twin |
|---|---|---|
| Alumno Pagado (airtableTrigger, alumnos `tblmfv5beVBGOZ2sb`, triggerField "Ultima Modificacion", formula `Estado General='Pagado' AND NOT(Onboarding Enviado)`) | poll everyMinute | Webhook `sb-onboarding` (POST) fed by Supabase DB Webhook on `alumnos`. Sticky note carries DB-webhook spec + fire condition + loop-guard. |
| Preparar Onboarding (Code) reads `item.json.fields.*`, arrays `Email[0]`,`Nombre[0]`, `item.json.id` | n/a | reads `$json.body.record.*` snake_case scalars (`record.email`, `record.nombre`, `record.id`); no `[0]` indexing |
| Crear Inbox Pre-Envio (httpRequest POST -> Airtable inbox `tblyp8NSzdpnTqkPD`) | create | Supabase **create** `inbox`. `Direccion`->`direccion`(Enviado), `De`->`de`, `Para`->`para`, `Asunto`->`asunto`, `Contenido`->`contenido`, `Fecha`->`fecha`, `Estado`->`estado`(Archivado), `Origen`->`origen`(Automatico), `Alumno:[id]`->`alumno_id`(UUID escalar) |
| Actualizar Inbox (httpRequest PATCH -> Airtable inbox by id) | update | Supabase **update** `inbox` WHERE `id = inboxId`. `messageId`->`message_id`, `threadId`->`thread_id`, `Contenido HTML`->`contenido_html`, `Asunto`->`asunto` |
| Marcar Onboarding Enviado (httpRequest PATCH -> Airtable alumnos by id) | update | Supabase **update** `alumnos` WHERE `id = alumnoId` SET `onboarding_enviado=true` |
| Log Historial (airtable create, historial `tbl3Zkove7j24eCho`, `Alumno=[id]`) | create | Supabase **create** `historial`: `Descripción Detallada`->`descripcion`, `Alumno:[id]`->`alumno_id`(escalar UUID), `Tipo de Acción`->`tipo_accion`(Email Enviado), `Origen del Evento`->`origen_evento`(Workflow Automatico) |

Preserved unchanged: Tiene Email? (IF skip), Montar Email HTML (full HTML/track-pixel/click-tracking builder), Traducir? IF, Traducir Email (chainLlm) + OpenRouter Model + Output Parser, Extraer Traduccion, Email Onboarding (Gmail send).

## FK fixes (Airtable linked [recXXX] arrays -> scalar UUID)
- Preparar Onboarding: `fields.Email||[]` then `[0]` -> `record.email` scalar; same for `Nombre`. `alumnoId` was Airtable `item.json.id` (recXXX) -> now `record.id` (UUID).
- Crear Inbox / Log Historial: `Alumno: [$json.alumnoId]` (array wrap for AT link) -> `alumno_id = {{ ...alumnoId }}` scalar UUID.
- `inboxId` = `id` of the row returned by Supabase `create` on `inbox`. Both updates filter by scalar `id` (PostgREST `id=eq.<uuid>`), not AT record-id PATCH.

## Supabase node config (all writes)
- type `n8n-nodes-base.supabase` v1, credential `8VXztyOWvaGzChfz` (Supabase ProEv Cloud), snake_case tableIds (`inbox`, `alumnos`, `historial`). `dataToSend: defineBelow` with `fieldsUi.fieldValues`; updates use `filterType: manual` with `id eq` condition.

## Gmail node fix
- Standalone `n8n-nodes-base.gmail` v2.1 required explicit `resource: message` + `operation: send` (the original implicit default failed validation as a fresh node). Added.

## DB-Webhook spec (for cutover, in sticky note)
- Table: `alumnos`  Event: UPDATE (also INSERT for safety)
- Fire condition: `NEW.estado_general = 'Pagado' AND NEW.onboarding_enviado = false`
- Loop-guard: this WF writes back `alumnos.onboarding_enviado=true` (Marcar Onboarding Enviado). The `onboarding_enviado=false` condition prevents re-trigger after send. Recommend the trigger function also requires `OLD.onboarding_enviado IS DISTINCT FROM false OR OLD.estado_general IS DISTINCT FROM 'Pagado'` to avoid re-firing on unrelated UPDATEs of an already-sent row.
- Payload: Supabase DB webhook sends `{ type, table, record, old_record }`. `Preparar Onboarding` reads `body.record` (NEW row). Verify payload shape on first test execution.

## Verify at cutover
- `Asunto` written to inbox both on create and on update (parity with original).
- `onboarding_enviado=true` boolean coercion (`={{ true }}`) on first run.
- alumnoId flows as Supabase UUID through entire chain (was Airtable recId).
