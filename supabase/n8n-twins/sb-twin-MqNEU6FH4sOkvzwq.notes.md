# SB-TWIN of MqNEU6FH4sOkvzwq ([Airtable] Sync Video - Revisiones)

New workflow: **`jl67tZr0ibxrVoVV`** — "[SB-TWIN] [Airtable] Sync Video - Revisiones", **active:false**.
JSON: `dashboard/supabase/n8n-twins/sb-twin-sync-video-revisiones.json`.
Supabase write credential: `8VXztyOWvaGzChfz` ("Supabase ProEv Cloud"). Validation: **0 errors** (30 warnings, all inherited style/version — deprecated `continueOnFail`, outdated typeVersions, langchain sub-node reachability).

## Swaps Airtable → Supabase (11 total: 1 trigger + 10 nodes)

| Original node | Original | Twin (Supabase) |
|---|---|---|
| Cambio en Revision | airtableTrigger (revisiones_video `tbluWapTseCcfcfXc`, field "Última Actualización", formula `OR({Email del Alumno}!='',{Alumno}!='')`, poll 5min) | Webhook POST `sb-sync-video-revisiones` (fed by Supabase DB Webhook) |
| Buscar Alumno | airtable search (alumnos, `LOWER(ARRAYJOIN({Email}))=LOWER(email)`) | supabase getAll `alumnos` filterString `email=ilike.<email>` limit 1 |
| Vincular Alumno a Revision | HTTP PATCH revisiones | supabase update `revisiones_video` id=eq, sets alumno_id (scalar), estado_revision |
| Leer Alumno Actual | HTTP GET alumno | supabase getAll `alumnos` id=eq limit 1 |
| Leer Edicion Activa | airtable search `{Es Edicion Activa}=TRUE()` | supabase getAll `ediciones` `es_edicion_activa=is.true` limit 1 |
| Actualizar Estado Alumno | HTTP PATCH alumno | supabase update `alumnos` id=eq: estado_general, edicion_id (scalar), plazo_revision, fecha_plazo |
| Log Historial | airtable create | supabase create `historial`: alumno_id scalar, tipo_accion, origen_evento, descripcion |
| Log No Encontrado | airtable create | supabase create `historial` (no alumno_id) |
| Marcar Revision Inaccesible | HTTP PATCH revisiones | supabase update `revisiones_video` id=eq: estado_revision='Video no accesible' |
| Log Video Inaccesible | airtable create | supabase create `historial`: alumno_id scalar |
| Encolar Cola de Emails | airtable create | supabase create `cola_emails`: alumno_id scalar, tipo, asunto_generado, mensaje, estado, descripcion |

**Preserved (non-Airtable):** `Probar URL Video` (external HTTP HEAD/GET to the student's video URL — NOT Airtable, kept as-is), proactive URL-validation chain (`Validar URL Video?` → `Probar URL Video` → `URL Accesible?`), AI/LLM chain (`Traducir Email Inaccesible` chainLlm + `OpenRouter Model Inaccesible` haiku-4.5 + `Output Parser Inaccesible`), `Email Video Inaccesible` (Gmail), `A/B Split` switch, all IF nodes, Merge, Set nodes.

## FK fixes (Airtable linked `[recXXX]` arrays → scalar UUID)
- `Extraer Datos`: `fields['Alumno']` (array) + `Array.isArray()?[0]` → `record.alumno_id` scalar UUID; all reads via `body.record.<snake_case>` (no `fields.*`, no `[0]`).
- `Preparar Vinculacion`: `alumno.Nombre[0]`/`alumno['Estado General']` → `alumno.nombre`/`alumno.estado_general` scalars; `alumnoId: alumno.id` (UUID).
- `Vincular Alumno`: `fields:{Alumno:[$json.alumnoId]}` array-wrap → `alumno_id` scalar.
- `Calcular Plazo`: alumnos.Edicion was a **link array**; in Supabase `alumnos.edicion_id` is a **scalar UUID** → drop dedup-merge, set `edicion_id = active edition id`. `edicion.fields['Plazos Revision']` → `edicion.plazos_revision`.
- `Actualizar Estado Alumno`: `Edicion: $json.ediciones` (array) → `edicion_id` scalar.
- `Log Historial`/`Log Video Inaccesible`: `Alumno: [$json.alumnoId]` array-wrap → `alumno_id` scalar.
- `Encolar Cola`: `Alumno: [$json.alumnoId]` → `alumno_id` scalar.

## DB-Webhook spec (cutover — also in sticky note)
- **Table:** `revisiones_video`  **Event:** INSERT + UPDATE
- **Fire condition (≡ AT formula):** `(NEW.email_alumno IS NOT NULL AND NEW.email_alumno <> '') OR NEW.alumno_id IS NOT NULL`; on UPDATE add `OLD IS DISTINCT FROM NEW`.
- **Payload:** Supabase default `{type,table,record,old_record}` → `Extraer Datos` reads `$json.body.record` (snake_case).
- **Loop-guard:** WF writes back to `revisiones_video` (Vincular Alumno sets estado_revision to same value; Marcar Revision Inaccesible sets 'Video no accesible'). Use guard `OLD.estado_revision IS DISTINCT FROM NEW.estado_revision` (or `OLD.alumno_id IS DISTINCT FROM NEW.alumno_id`) so no-op writes don't re-fire. 'Video no accesible' re-fires once but `Validar URL Video?` requires `estado_revision='Pendiente'`, which cuts the loop.

## Missing Supabase columns (fallback + flag)
- alumnos `feedback_video`, `enlace_pago`, `modules` — **not read by this WF**, no impact (this twin touches estado_general/edicion_id/plazo_revision/fecha_plazo only).
- cola_emails.envio_id, envios_emails.nombre — not used here.
- `revisiones_video` mapping has **no gaps**: alumno_id, email_alumno, estado_revision, video_enviado, revisor_responsable, feedback, puntuacion, redes_sociales all present.

## Cred note
Twin uses Airtable's `Email Video Inaccesible` Gmail cred `b7Ntns1A8KOn5Fs3` and OpenRouter `QhsRH5XtedXrjlUo` unchanged (not Airtable-coupled). Only Airtable PAT was removed; Supabase cred `8VXztyOWvaGzChfz` added to all 10 swapped nodes.
