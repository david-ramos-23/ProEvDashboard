# Supabase Twin — [Stripe] Pago Recibido (money path)

- **Twin ID**: XikVC07KC9xNURhK  (active:false — LAST to activate at cutover)
- **Source**: 5qjxfOD03sHUeRbr  (PRODUCTION, untouched)
- **Canonical pattern**: Z2PZdRgimnJvA1hn
- **Validation**: 0 errors (runtime profile). 4 warnings are benign and identical to those the production source emits (Switch/IF second outputs flagged as "main[1] error outputs" — false positives; "Code can throw" advisory).

## Node swaps (14 Supabase ops; 0 Airtable nodes remain)
Preserved verbatim: Stripe Trigger LIVE/TEST, Procesar Pago (Code), Resultado Pago (Switch, upgraded 3.2->3.4 + outputKeys), Esperar 45min (Wait), Pago Duplicado? / Alumno Encontrado? (IF).

| Twin node | Op | table | notes |
|---|---|---|---|
| Buscar Alumno / Error | getAll | alumnos | filter: id=eq.<uuid> if metadata.alumno_id else email=ilike.<email> |
| Actualizar a Pagado | update | alumnos | estado_general='Pagado', filter id=eq.{{$json.id}} |
| Actualizar Pago Fallido | update | alumnos | estado_general='Pago Fallido' |
| Buscar Pago Existente | getAll | pagos | dedup: id_sesion_stripe=eq.<sid> |
| Registrar Pago | create | pagos | estado_pago='Completado' |
| Registrar Pago Sin Alumno | create | pagos | estado_pago='Pendiente Verificación' + notas_internas |
| Log Historial/Error/Evento/Alerta | create | historial | tipo_accion + origen_evento='Webhook' |
| Crear Email Recuperacion | create | cola_emails | tipo='recuperacion_pago', estado='Pendiente' |
| Buscar Alumno Evento / Verificar Email | getAll | alumnos | email lookup |

## FK shift
Airtable linked-array `[$('Buscar Alumno').first().json.id]` (recXXX) -> scalar UUID `$('Buscar Alumno').first().json.id` (alumno_id). `records[0].id` HTTP refs -> `$json.id`. IF nodes that read `$json.records.length` (Airtable HTTP) -> `$input.all().length` (Supabase getAll item count).

## Idempotency (pago dedup)
Preserved. "Buscar Pago Existente" does a Supabase getAll on pagos.id_sesion_stripe before insert; "Pago Duplicado?" routes on `$input.all().length > 0` — TRUE (dup exists) -> Log Historial only; FALSE -> Registrar Pago. Source guard fully mapped (it existed; via raw api.airtable.com HTTP query on {ID Sesion Stripe}).

## Stripe webhook note
Triggers kept as-is (stripeTrigger, events:['*']) — NOT renamed. At cutover the Stripe dashboard webhook endpoint must be repointed to THIS workflow's webhook URL (or the new trigger's path/webhookId kept identical to the production one). Until then the twin stays inactive and registers no webhook.

## Flags
- MISSING alumnos cols (alerta_activa, dias_desde_ultimo_evento, display_name, feedback_video, enlace_pago, modules) — NOT referenced in money path; no fallback needed.
- enum 'Pendiente Verificación' (estado_pago) and 'Pago Fallido' (estado_general) verified live in schema.sql.
- Sin-alumno TRUE branch terminated with NoOp ("Alumno Ya Existe") to keep graph clean.
- Validator quirk: stripeTrigger needs parameters.events set or workflow-load .match() crashes.
