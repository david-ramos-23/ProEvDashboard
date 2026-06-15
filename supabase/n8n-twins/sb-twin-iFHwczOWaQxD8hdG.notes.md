# SB-TWIN of iFHwczOWaQxD8hdG ([Airtable] Emails segun Estado)

New workflow: "[SB-TWIN] [Airtable] Emails segun Estado", active:false.

## Airtable -> Supabase swaps
| Original node | Original op | Twin |
|---|---|---|
| Cambio Estado Alumno (airtableTrigger, alumnos tblmfv5beVBGOZ2sb, triggerField "Estado Modificado", formula on Estado General) | poll every 5min | Webhook `sb-emails-segun-estado` (POST) fed by Supabase DB Webhook on `alumnos` UPDATE. Sticky note carries DB-webhook spec + fire condition. |
| Preparar Datos (Code) reads `item.json.fields.*`, arrays `Email[0]`,`Nombre[0]` | n/a | reads `$json.body.record.*` snake_case scalars; no `[0]` indexing |
| Log Historial (airtable create, historial tbl3Zkove7j24eCho, Alumno=`[$json.alumnoId]`) | create | Supabase create on `historial`: alumno_id scalar UUID, tipo_accion, descripcion, origen_evento='Workflow Automatico' |
| Marcar Pendiente de Pago (airtable update alumnos by id) | update | Supabase update on `alumnos`, filterString `id=eq.<uuid>`, estado_general='Pendiente de pago' |

## FK fixes (Airtable linked [recXXX] arrays -> scalar UUID)
- Preparar Datos: `fields.Email||[]` then `[0]` -> `record.email` scalar. Same for `Nombre`.
- alumnoId: was Airtable `item.json.id` (recXXX) -> now `record.id` (UUID).
- Log Historial Alumno: `={{ [$json.alumnoId] }}` (array wrap for AT link) -> `alumno_id` = `={{ $json.alumnoId }}` scalar UUID.
- Marcar Pendiente: matching by `id` UUID via PostgREST filter, not AT record-id update.

## Columns absent in Supabase alumnos (read defensively, empty fallback preserved)
- `Feedback Video` -> NO column (only resumen_feedback_ia). feedbackVideo='' -> feedback blocks render empty, same as original empty-branch.
- `Enlace Pago` -> NO column. enlacePago='' -> falls back to hardcoded stripeUrl (original already had this fallback).
- `Modules` -> NO column. modulesField='' (unused downstream anyway).
- `Modulo Solicitado`->modulo_solicitado, `Plazo Revision`->plazo_revision, `Fecha Plazo`->fecha_plazo, `Idioma`->idioma, `Prelanzamiento Enviado`->prelanzamiento_enviado, `Estado General`->estado_general all present.

## DB-Webhook spec (for cutover, in sticky note)
- Table: `alumnos`  Event: UPDATE
- Fire condition: NEW.estado_general IN ('En revisión de video','Aprobado','Rechazado','Reserva','Plazo Vencido','Pago Fallido') AND NEW.estado_general IS DISTINCT FROM OLD.estado_general
- Payload: default Supabase webhook JSON -> n8n receives `$json.body.record` (NEW row), `$json.body.old_record` (OLD row), `$json.body.type`='UPDATE'
- Loop-guard: this WF writes BACK to alumnos (Marcar Pendiente de Pago sets estado_general='Pendiente de pago'). 'Pendiente de pago' is NOT in the fire list, so it will NOT retrigger. Safe. Still recommend webhook condition excludes the WF's own writes via the estado_general IN (...) allowlist above.
