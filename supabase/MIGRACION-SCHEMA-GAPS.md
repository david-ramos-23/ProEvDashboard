# Supabase Schema Gaps — Analysis (DRAFT, nothing applied)

Companion to `MIGRACION-SCHEMA-GAPS.sql`. Defines the fields/tables that
block activating the n8n Supabase twins for **Alertas** and **Nueva
Inscripcion**. **READ-ONLY investigation — no DDL was run on any DB.**

## Authoritative sources consulted
| Source | What it gave us |
|---|---|
| n8n `86TaFQgNjXIFP2rA` (Alertas) | exact Airtable `filterByFormula` + the Code node branching on `{Alerta Activa}` substrings; reads `{Dias desde Ultimo Evento}` |
| n8n `kWDjtwTRmQfUC0B5` (Nueva Inscripcion) | trigger table `tbl6I5p5adeeGDv2S`, triggerField `Timestamp`, which form fields the flow consumes |
| Airtable live data (PAT, read-only) | actual shape/values of `Alerta Activa`, `Modules`, `Dias desde Ultimo Evento`; full field list of the form table (50 records) |
| `schema.sql` + live Supabase DB (psycopg2) | current `alumnos`/`historial`/`cola_emails` columns and the `alumnos_enriched` view body |

## Finding #2 — view vs base table (the load-bearing decision)
The n8n twins filter the **base table** `alumnos` over PostgREST
(`alerta_activa=not.is.null`, `dias_desde_ultimo_evento=gt.X`), **not** the
`alumnos_enriched` view. A column that exists only in the view is invisible
to that filter. So derived alumnos fields are proposed as **base-table
columns maintained by trigger + daily cron (Approach A)**, with a
**view-only fallback (Approach B)** kept commented in case the twin is
repointed to `alumnos_enriched`. Postgres `GENERATED ALWAYS` columns are
ruled out for GAP 1/2: they're STORED, can only reference the same row, and
can't aggregate `historial` — and a "days since" value would be stale once
stored.

---

## GAP 1 — `alumnos.alerta_activa`  *(confidence: LOW)*
- **Inferred definition:** human-readable label string (e.g. `"🥶 Alumno Frío"`), empty/NULL when no alert; the twin keys off substrings `Alumno Fr` / `Pago Pendiente` / `Video sin Revisar`.
- **Evidence:** twin filter `AND({Alerta Activa} != '', {Estado General} != 'Finalizado', {Estado General} != 'Rechazado')`; Code node `if (alerta.includes('Alumno Fr')) ... else if (...'Pago Pendiente') ... else if (...'Video sin Revisar') return []`. Live value seen: `"🥶 Alumno Frío"`.
- **Approach:** Approach A — `TEXT` column on `alumnos`, recomputed by `refresh_alerta_activa()` (trigger on `historial` + daily cron). View-only fallback provided.
- **OPEN QUESTIONS:**
  - **OQ-1 (critical):** The exact Airtable formula is **not readable** (data PAT, no schema scope). I reconstructed only the *labels* and a plausible "Frío = >7 days idle" threshold from the `dias_desde_ultimo_evento` sample. **Confirm:** (a) the precise condition + day thresholds for each of the 3 labels; (b) whether `Alerta Activa` can hold **multiple** labels at once (the twin's if/else-if implies one-at-a-time, but a formula could concatenate); (c) the exact label strings incl. emoji (`🥶 Alumno Frío` confirmed; `Pago Pendiente` / `Video sin Revisar` emoji unconfirmed).
  - **OQ-1b:** Should the Supabase value include the emoji, or store a clean label and let the twin match plain text? (Twin matches `.includes('Alumno Fr')`, so plain text is safe.)

## GAP 2 — `alumnos.dias_desde_ultimo_evento`  *(confidence: MED)*
- **Inferred definition:** whole days between today and the alumno's most recent `historial` row.
- **Evidence:** Airtable field is INT (live: 3/80/6/7/104). `historial` table links to `alumnos` and has `created_at`; "ultimo evento" maps naturally to newest historial row. Read by the Alertas twin.
- **Approach:** Approach A — `INT` column refreshed by `refresh_dias_desde_ultimo_evento()` (trigger on `historial` INSERT/UPDATE + daily `pg_cron` so the counter advances with no new events). In-view fallback (always-fresh) provided.
- **OPEN QUESTIONS:**
  - **OQ-2:** Confirm "ultimo evento" = newest `historial.created_at`. It *could* instead be a `LAST_MODIFIED_TIME()` over a specific set of alumno fields, or exclude certain `tipo_accion` values. If Airtable's value diverges from "newest historial", the trigger source must change.
  - **OQ-2b:** `pg_cron` must be enabled in Supabase (Dashboard → Extensions) for the daily recompute. Acceptable? If not, fall back to Approach B (view) so the value is computed at read time.

## GAP 3 — `alumnos.modules`  *(confidence: MED)*
- **Inferred definition:** raw multi-select module answers from the inscription form (a rollup/lookup), distinct from normalized `modulo_solicitado` and from `modulos_completados`.
- **Evidence:** live `Modules` arrays: `["Module 1"]`, `["Module 1","Modules 1 and 2"]`, `["Modules 1 + 2 + 3"]`. In the Nueva Inscripcion twin's Crear Alumno schema, `Modules` is `readOnly: true, removed: true` → it is a derived/rollup field, not writable.
- **Approach:** plain `TEXT[]` column on `alumnos`, loaded by the migrator from Airtable `Modules`. No derivation.
- **OPEN QUESTIONS:**
  - **OQ-3:** Does **any twin actually read** `alumnos.modules`? It appears only as a removed/readOnly schema entry. If nothing consumes it, the column is optional (dashboard/migrator-parity only) and could be dropped from the activation-blocking set. Also confirm it's not redundant with `inscripciones.modules` (GAP 4) — `alumnos.modules` may simply be Airtable's lookup of the linked form's selection.

## GAP 4 — table `inscripciones`  *(confidence: MED)*
- **Inferred definition:** form-intake table mirroring Airtable `tbl6I5p5adeeGDv2S`; the Nueva Inscripcion twin triggers on new rows.
- **Evidence:** twin `airtableTrigger` on `tbl6I5p5adeeGDv2S`, triggerField `Timestamp`. Full live field list (50 records) captured; the flow reads `Email`, `Full Name`, `Email Pareja`, `Which modules…`, `What country…`, and dedupes via the `Alumnos` link. Table does **not** exist in Supabase (verified against live DB).
- **Approach:** `CREATE TABLE inscripciones` — promote the consumed fields to typed columns (`timestamp_form`, `email`, `full_name`, `email_pareja`, `phone_number`, `modules`, `pais`, `codigo_descuento`, `alumno_id` link) + keep the volatile long Tally questions in a `respuestas_formulario JSONB` blob.
- **OPEN QUESTIONS:**
  - **OQ-4a (important):** The twin Code reads `f.Nombre`, but the **live form field is `Full Name`** (there is no `Nombre` field in the form). Today the Airtable trigger payload may expose a `Nombre` alias, or the twin relies on the `Alumnos` link's `Nombre`. Confirm what the **Supabase twin** should read so the email greeting isn't blank. (Draft maps `Full Name` → `full_name`.)
  - **OQ-4b:** Typed-columns + JSONB split vs. a full flat column-per-question. I chose the split because the Tally question strings are long/volatile. Confirm acceptable, and whether any of the "soft" answers (dance level, expectations…) need to be queryable (→ promote out of JSONB).
  - **OQ-4c:** How will the **Supabase twin trigger**? Supabase has no native "airtableTrigger". Options: a webhook from the form, `pg_net`/Realtime on `inscripciones`, or a polling Schedule node querying `timestamp_form > lastChecked`. The table schema supports all three (indexed `timestamp_form`), but the twin design must pick one. Out of scope for DDL — flagged for the twin build.
  - **OQ-4d:** Should `inscripciones` carry the `airtable_id` UNIQUE + audit/RLS triggers like the rest of the schema? (Draft includes `airtable_id UNIQUE`; audit/RLS left commented.)

## GAP 5 — `cola_emails.envio_id` FK  *(confidence: HIGH that it's optional)*
- **Inferred definition:** optional back-reference from a queued email to the bulk-send batch that created it.
- **Evidence:** live `cola_emails` has `alumno_id` but no `envio_id`; `envios_emails.alumnos_ids` is a denormalized `UUID[]`.
- **Approach:** commented-out `ALTER TABLE … ADD COLUMN envio_id UUID REFERENCES envios_emails(id)`. Not required by any twin today.
- **OPEN QUESTIONS:**
  - **OQ-5:** Does any bulk-send twin need to write/read this link? If not, leave it out.

---

## Suggested apply order (after OQs confirmed)
1. GAP 2 column + functions (feeds GAP 1).
2. GAP 1 column + function; wire `refresh_alerta_activa` into the historial trigger + cron.
3. GAP 3 column (if OQ-3 says a twin reads it).
4. GAP 4 `inscripciones` table; then design the twin trigger (OQ-4c).
5. Backfill: `SELECT refresh_dias_desde_ultimo_evento(); SELECT refresh_alerta_activa();` + migrate form rows + `Modules`.
6. GAP 5 only if OQ-5 is yes.

**Reminder:** every threshold/condition in GAP 1 (and the "newest historial"
assumption in GAP 2, and `Full Name`→`Nombre` in GAP 4) is an inference.
Do **not** apply GAP 1 until OQ-1 is answered — wrong thresholds would make
the Alertas twin email the wrong students or stay silent.
