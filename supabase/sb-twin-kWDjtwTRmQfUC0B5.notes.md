# SB-TWIN of kWDjtwTRmQfUC0B5 ([Airtable] Nueva Inscripcion - Crear Alumno y Confirmar)

Twin n8n id: **`3WDtM629rGgWsvkB`** — "[SB-TWIN] [Airtable] Nueva Inscripcion - Crear Alumno y Confirmar", active:false.
Validation: **valid:true, 0 errors, 27 warnings** (all cosmetic: typeVersion, Code-node error-handling, deprecated continueOnFail — same class the original/siblings carry).
Supabase cred `8VXztyOWvaGzChfz`. JSON: `n8n-twins/sb-twin-nueva-inscripcion.json`. Build scripts: `n8n-twins/build-sb-twin-nueva-inscripcion.cjs` + `assemble-nueva-inscripcion.cjs` + `graph-nueva-inscripcion.cjs`.

## Node count
26 nodes (25 functional + 1 sticky). Original 25 → trigger swapped (airtableTrigger→webhook), sticky added.

## Airtable → Supabase swaps (8 ops, 0 api.airtable.com refs remaining)
| Original | Original op | Twin |
|---|---|---|
| Nueva Inscripcion Form (airtableTrigger, tbl6I5p5adeeGDv2S, poll Timestamp) | poll 1min | Webhook POST `sb-nueva-inscripcion` (DB-Webhook at cutover). Sticky carries spec. |
| Leer Edicion Activa (airtable search ediciones, `{Es Edicion Activa}=TRUE()`) | search | Supabase getAll `ediciones` filterString `es_edicion_activa=eq.true`, limit 1 |
| Buscar Email Existente (HTTP GET api.airtable alumnos, filterByFormula LOWER(Email)) | http | Supabase getAll `alumnos` `email=ilike.{{Email}}&select=id,email` |
| Crear Alumno (airtable create alumnos) | create | Supabase create `alumnos`; **captures server UUID `row.id`** for downstream (not recId) |
| Crear Inbox Pre-Envio (HTTP POST api.airtable inbox) | http create | Supabase create `inbox` (direccion/de/para/asunto/contenido/fecha/estado=Archivado/origen=Automatico/alumno_id) |
| Actualizar Inbox (HTTP PATCH api.airtable inbox/{id}) | http update | Supabase update `inbox` WHERE id=eq.inboxId (message_id/thread_id/contenido_html/asunto) |
| Log Historial (airtable create historial) | create | Supabase create `historial` (descripcion/tipo_accion/origen_evento=Automatico/alumno_id) |
| Pareja Buscar (HTTP GET) + PATCH A + PATCH B (HTTP PATCH) | http | Supabase getAll + 2× update `alumnos` by id=eq.UUID |

Non-Airtable logic preserved verbatim: Combinar Datos (deadline/module/idioma mapping), Montar Email HTML, Traducir? + chainLlm/OpenRouter/OutputParser + Extraer Traduccion, Gmail send, all IF gates.

## FK fixes (linked [recXXX] arrays → scalar UUID FK)
- `Crear Alumno` no longer returns a recId; `Preparar Email`/`Pareja - Init` read `$('Crear Alumno').first().json.id` = server UUID.
- `Edicion:[id]`→`edicion_id` scalar UUID; `Alumno:[id]`→`alumno_id` scalar; `Pareja (Link):[id]`→`pareja_alumno_id` scalar (no array wrap).
- `Combinar Datos`/`Pareja` read snake_case scalars (`record.email`,`record.pareja_alumno_id`) — removed `field[0]` array indexing.

## DB-Webhook spec (cutover, in sticky)
- Table `inscripciones` (⚠️ MISSING in Supabase — form must write to an `inscripciones` table or POST the webhook directly), Event INSERT, fire on new row with Email. Payload `{type,table,record,old_record}` → `body.record`.
- Loop-guard: WF writes alumnos/inbox/historial, NOT inscripciones → no self-retrigger. Path renamed `sb-nueva-inscripcion`.

## Flags / fallbacks
- **DROPPED** `Inscripcion (form)` link on alumnos — no column in schema.sql.
- Idioma: Supabase enum `idioma_tipo` = `Espanol`/`Ingles` (NO tilde); twin writes `idiomaSb` (Airtable wrote `Español`).
- `plazos_revision` is JSONB (not JSON-string) — Combinar Datos handles object or string.
- recId→UUID in pixel/click URLs (`?alumno=`) + `sb-` path prefixes (consistent with other twins). Generators must emit UUIDs before activation.
- MISSING-col fallbacks per task brief (alerta_activa, dias_desde_ultimo_evento, display_name, feedback_video, enlace_pago, modules / cola_emails.envio_id / envios_emails.nombre): none referenced by this workflow → no fallback needed here.
