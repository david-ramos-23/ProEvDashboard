# Plan de twins Supabase para los 24 workflows n8n (ProEv)

> **Análisis no destructivo.** Ningún workflow existente se modificó, activó ni
> desactivó. Solo se **crearon twins NUEVOS** (prefijo `[SB-TWIN] `, `active:false`).
> Generado: 2026-06-14. Complementa `MIGRACION-INVENTARIO-N8N.md` y `MIGRACION-CUTOVER-RUNBOOK.md`.

## 0. Estado de la credencial (DESBLOQUEANTE RESUELTO)

- **Existe** una credencial Supabase write-capable en n8n producción:
  - id `8VXztyOWvaGzChfz`, nombre **"Supabase ProEv Cloud"**, tipo `supabaseApi`.
  - Es la Data API (PostgREST) de Supabase: soporta create/get/getAll/update/delete sobre filas.
- Patrón canónico verificado en el twin existente `Z2PZdRgimnJvA1hn`
  (`[Supabase] Consultar Plazas`): nodo `n8n-nodes-base.supabase` (typeVersion 1),
  `tableId` = nombre snake_case de tabla (coincide con `schema.sql`), filtros vía
  `filterString` PostgREST (`col=op.valor`) o `filters.conditions[]` manual, y los Code
  nodes leen columnas en **snake_case**.
- **Conclusión:** se pueden construir todos los twins sin crear credenciales nuevas.

## 1. Patrón de conversión (node swaps)

| Origen Airtable | Reemplazo Supabase |
|---|---|
| `n8n-nodes-base.airtable` op `search` + `filterByFormula` | `supabase` `getAll`, `filterType:string`, `filterString:"col=op.valor"` (PostgREST) |
| `n8n-nodes-base.airtable` op `create` | `supabase` `create`, `dataToSend:defineBelow`, `fieldsUi.fieldValues[]` (snake_case) |
| `n8n-nodes-base.airtable` op `update` | `supabase` `update`, `filters.conditions[{keyName:id,condition:eq,keyValue}]`, `fieldsUi` |
| `n8n-nodes-base.airtable` op `get`/lista | `supabase` `getAll`/`get` con filtros |
| **HTTP `api.airtable.com` GET** | `supabase` `getAll` (reescribir URL+`filterByFormula` -> filterString) |
| **HTTP `api.airtable.com` PATCH** (fields:{...}) | `supabase` `update` (record id -> filtro `id eq`; fields -> fieldsUi) |
| **HTTP `api.airtable.com` POST** | `supabase` `create` |
| `n8n-nodes-base.airtableTrigger` (polling) | **No hay trigger Supabase nativo.** Ver §4. |
| Code nodes leyendo `item.json['Campo Airtable']` | reescribir a `item.json.columna_snake` usando FIELD_MAP |

**Mapeo de campos:** usar `FIELD_MAP` y `TABLE_COLUMNS` de
`dashboard/supabase/migrate_airtable_data.py` como fuente de verdad
(p.ej. `Estado General`->`estado_general`, `Nombre`->`nombre`, `Estado`->`estado`,
`Fecha Envio`->`fecha_envio`, `Edicion`->`edicion_id`). En REST/HTTP de Airtable los
linked fields devolvían **arrays de record IDs**; en Supabase los FK son **UUID directos**
(p.ej. `edicion_id` es un UUID, no `[recXXX]`) — ajustar Code nodes que hacían `[0]`.

**Tablas (schema.sql):** `ediciones, modulos, alumnos, revisiones_video, pagos,
historial, cola_emails, envios_emails, inbox, audit_log, configuracion`.
Nombres de tabla en Airtable -> Supabase: `Cola de Emails`->`cola_emails`,
`Inbox`->`inbox`, `Alumnos`->`alumnos`, `Ediciones`->`ediciones`, `Modulos`->`modulos`,
`Pagos`->`pagos`, `Revisiones`->`revisiones_video`.

## 2. Orden de cutover (read-only primero, Stripe el ÚLTIMO)

1. **Pilotos read-only / ya twinados** (riesgo mínimo): `vAXmsu9exm9LEbID` (ya tiene
   twin `Z2PZdRgimnJvA1hn`), `R3mQiCRZ8tu66yaQ` (twin creado `sJ3HEoC6C9qFEhFR`).
2. **LOW writers de tracking** (idempotentes, bajo volumen): #4 Link Tracking,
   #9 Pixel Tracking, #7 Sub Campaña, #8 Reprocesar Cola.
3. **MED sync/reads**: #2, #3, #6, #10, #11, #12, #13, #14, #15, #16, #17, #18.
4. **HIGH multi-tabla**: #19, #20, #21, #22, #23.
5. **`[Stripe] Pago Recibido` (`5qjxfOD03sHUeRbr`) — EL ÚLTIMO.** Toca 4 tablas
   (Alumnos, Cola de Emails, Inbox/Comunicaciones, Pagos), 14 puntos Airtable
   (11 nativos + 3 HTTP). Es el camino de dinero: cualquier fallo pierde un pago.

> **Dependencia de sub-workflows:** varios workflows llaman a subworkflows vía
> `executeWorkflow` (p.ej. el piloto llama a `yP0Ehu1fk86ZAJoS`). El twin de un padre
> NO sirve hasta que su sub-workflow también tenga twin Supabase. Construir twins de
> abajo-arriba (subs antes que padres).

## 3. Plan por workflow (los 24)

Leyenda Airtable*: `(at = nodos airtable nativos / trig = airtableTrigger / http = HTTP a api.airtable.com)`.

### Pilotos / LOW

| # | Workflow | ID | R/W | Airtable* | Twin approach | Esfuerzo |
|---|---|---|:--:|---|---|:--:|
| 1 | [Schedule] Gestionar Estado Edicion | `R3mQiCRZ8tu66yaQ` | R(+W estado) | at1/trig0/http1 | **HECHO**: twin `sJ3HEoC6C9qFEhFR`. search->getAll, PATCH->update. Sub `yP0Ehu1fk86ZAJoS` pendiente de twin. | LOW |
| 2 | [Schedule] Sync 60min Papelera Gmail a Inbox | `RHglZuskaIiC42lg` | R | at1/trig0/http1 | getAll inbox + reescribir 1 HTTP GET a getAll. Lógica Gmail intacta. | LOW |
| 3 | [Airtable] Estado Leido Marcar en Gmail | `qaDQHyiZ8WKPfFUJ` | R | at0/trig1/http1 | **Trigger Airtable (§4)**: sin equivalente Supabase. Reemplazar por Schedule poll a `inbox` (estado=Leido) o webhook desde dashboard. 1 HTTP -> getAll. | LOW |
| 4 | [Webhook] Link Tracking Registrar Click | `eEc8XBMo2ej1xSlv` | W | at1/trig0/http0 | Webhook intacto; 1 airtable update `cola_emails` -> supabase update (filtro por id/token). | LOW |
| 7 | [Sub] Campana Email Apertura Publica | `yP0Ehu1fk86ZAJoS` | R/W | at2/trig0/http0 | **PRIORITARIO** (es sub de #1 y otros). 2 airtable (alumnos read + inbox/comunicaciones write) -> getAll + create/update. | LOW |
| 8 | [Manual] Reprocesar Cola de Emails | `1ECKTnP1Nvo6x-5BydqFY` | R/W | at2/trig0/http0 | 2 airtable sobre inbox/comunicaciones -> getAll + update. Manual trigger intacto. | LOW |
| 9 | [Webhook] Pixel Tracking Registrar Apertura | `a9F0DmOsWFohjKlM` | W | at1/trig0/http1 | Webhook intacto; update `cola_emails` (fecha_apertura) -> supabase update; 1 HTTP -> getAll. | LOW |

### MED

| # | Workflow | ID | R/W | Airtable* | Twin approach | Esfuerzo |
|---|---|---|:--:|---|---|:--:|
| 5 | [Webhook] Consultar Plazas API Publica | `vAXmsu9exm9LEbID` | R | at3/trig0/http0 | **YA TWINADO**: `Z2PZdRgimnJvA1hn`. 3 airtable (alumnos/ediciones/modulos) -> 3 supabase getAll. Patrón de referencia. | MED |
| 6 | [Airtable] Estado Eliminado Mover Papelera | `NjXLz3D0Fd87KjzC` | R | at0/trig1/http2 | **Trigger Airtable (§4)** + **2 HTTP rewrites**. Trigger -> Schedule poll inbox(estado=Eliminado); 2 HTTP GET/PATCH -> getAll/update. | MED |
| 10 | [Airtable] Respuesta Final Enviar Reply | `KvsgidqUkHMMjPxA` | R | at1/trig1/http2 | **Trigger** + **2 HTTP rewrites**. Lógica Gmail reply intacta; alumnos read -> getAll. | MED |
| 11 | [Schedule] Sync 30min Emails Enviados | `RrcIiAsEnAWBbQTi` | R/W | at3/trig0/http0 | 3 airtable (alumnos read, inbox write) -> getAll + create/update. Schedule intacto. | MED |
| 12 | [Schedule] Diario 3am Borrar Eliminados +30d | `yXqwbWnocDa1bG48` | R/W | at2/trig0/http1 | 2 airtable + **1 HTTP**. delete sobre inbox -> supabase delete con filtro fecha. | MED |
| 13 | [Webhook/Manual] Campana Reactivacion Anti-Ban | `6IyUv44O8X8JZv9J` | R/W | at3/trig0/http1 | 3 airtable (alumnos, cola_emails, ediciones) + **1 HTTP**. getAll/create/update. | MED |
| 14 | [Airtable] Emails segun Estado | `iFHwczOWaQxD8hdG` | R/W | at2/trig1/http0 | **Trigger Airtable (§4)** clave (dispara por cambio de estado de alumno). Reemplazar por webhook desde dashboard o Schedule poll. 2 airtable -> supabase. | MED |
| 15 | [Gmail] Nuevo Email Clasificar con AI | `0C0AuwYqsJNh8yZ4` | R/W | at3/trig0/http0 | Gmail trigger + AI intacto; 3 airtable (alumnos read, inbox write x2) -> getAll/create. | MED |
| 16 | [Schedule] Alertas Detectar Alumnos en Riesgo | `86TaFQgNjXIFP2rA` | R/W | at3/trig0/http0 | 3 airtable (alumnos, cola_emails, inbox) -> getAll + create. Schedule + Telegram intacto. | MED |
| 17 | [Airtable] Alumno Pagado Enviar Onboarding | `tAsjIcEV9celCA7y` | R/W | at1/trig1/http3 | **Trigger** + **3 HTTP rewrites**. Dispara por estado=Pagado. cola_emails create. | MED |
| 18 | [Airtable] Envio Masivo Crear Cola Individual | `L0d0Nj24XosJI0HB` | R/W | at2/trig1/http3 | **Trigger** + **3 HTTP rewrites**. Itera inbox/comunicaciones -> cola_emails create por alumno. | MED |

### HIGH (alto esfuerzo — los 6)

| # | Workflow | ID | R/W | Airtable* | Twin approach | Esfuerzo |
|---|---|---|:--:|---|---|:--:|
| 19 | [Airtable] Cola Email Procesar y Enviar con AI | `8uotHUeyyM01LfFx` | R/W | at2/trig1/http5 | **Trigger** + **5 HTTP rewrites**. Núcleo del pipeline de emails (22 nodos). alumnos+cola_emails. Validar cada expresión de URL/fórmula. | HIGH |
| 20 | [Webhook] Formulario Interes Enviar Opciones | `JzY10GKy2yaNJmEI` | R/W | at4/trig0/http5 | **5 HTTP rewrites** (40 nodos). alumnos/cola_emails/ediciones. Webhook público intacto. | HIGH |
| 21 | [Airtable] Nueva Inscripcion Crear Alumno | `kWDjtwTRmQfUC0B5` | R/W | at3/trig1/http6 | **Trigger** + **6 HTTP rewrites** (25 nodos). create alumno + ediciones link (UUID FK, no array). | HIGH |
| 22 | [Airtable] Sync Video Revisiones | `MqNEU6FH4sOkvzwq` | R/W | at6/trig1/http4 | **Trigger** + **4 HTTP rewrites** (29 nodos). 4 tablas (alumnos, cola_emails, ediciones, inbox). revisiones_video. | HIGH |
| 23 | [Webhook] Boton Modulo Verificar Capacidad | `jVbu6iqRWsgfYvTI` | R/W | at9/trig0/http4 | **9 airtable + 4 HTTP** (38 nodos). 4 tablas + Stripe. Capacidad por módulo (lógica de plazas, ver twin #5). | HIGH |
| 24 | **[Stripe] Pago Recibido** Actualizar a Pagado | `5qjxfOD03sHUeRbr` | R/W | at11/trig0/http3 | **EL ÚLTIMO. 11 airtable + 3 HTTP** (21 nodos). 4 tablas incl. **pagos**. Camino de dinero: no twinar hasta que todo lo demás esté verificado en paralelo. | HIGH |

## 4. Riesgo crítico: `airtableTrigger` no tiene equivalente Supabase

**9 nodos `airtableTrigger`** en workflows #3, #6, #10, #14, #17, #18, #19, #21, #22.
Supabase no tiene un trigger de polling nativo en n8n. Opciones por orden de preferencia:

1. **Webhook desde el dashboard/backend**: cuando el dashboard escribe en Supabase,
   que llame a un webhook n8n (mejor consistencia, sin polling).
2. **Supabase DB webhooks / Edge Functions**: emiten POST al cambiar filas -> Webhook n8n.
3. **Schedule poll**: `scheduleTrigger` + `supabase getAll` filtrando por
   `updated_at > last_run` o por estado. Más simple, peor latencia.

Esto es la **decisión de arquitectura más importante** antes del cutover y afecta a 9 de 24.

## 5. Total de reescrituras HTTP (alto esfuerzo)

**43 nodos HTTP a `api.airtable.com`** repartidos así (de mayor a menor):
#21(6), #19(5), #20(5), #22(4), #23(4), #17(3), #18(3), #24(3), #6(2), #10(2),
#1(1 hecho), #2(1), #3(1), #9(1), #12(1), #13(1). Cada uno requiere:
reescribir URL (base/tabla/recordId) -> nodo supabase, convertir `filterByFormula`
a filterString PostgREST, y mapear `fields:{...}` a `fieldsUi` snake_case.

## 6. Artefactos

- Twin creado (INACTIVO): n8n id `sJ3HEoC6C9qFEhFR`.
- JSON del twin: `dashboard/supabase/n8n-twins/sb-twin-gestionar-estado-edicion.json`.
- Credencial Supabase: `8VXztyOWvaGzChfz` "Supabase ProEv Cloud".
