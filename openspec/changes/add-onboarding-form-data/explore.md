# Exploration — add-onboarding-form-data

Status: `done`
Date: 2026-09-03
Artifact store: `openspec`

## Goal

1. Surface the Onboarding form answers (t-shirt size/kind/name, welcome-book language,
   Instagram permission + username) on the student detail page.
2. Let an admin open the student detail from the Pagos page.

## Data source (verified via Airtable MCP)

Base `app4ZpoxaWOyV4RnR`, table **"Onboarding (form)"** = `tblyBkdLq0Ja06CH6`.

| Airtable field (literal) | Type |
| --- | --- |
| `Languaje on the Welcome book?` | singleSelect |
| `Kind os T-Shirt?` | singleSelect |
| `T-Shirt Size?` | singleSelect |
| `Name on the T-Shirt` | multilineText |
| `Do you give us permission to use your Instagram account in future posts related to the course content?…` | singleSelect |
| `Instagram username: (only if you selected "Yes")` | multilineText |
| `Timestamp` | createdTime |
| `Alumnos` | multipleRecordLinks |
| `Email (from Alumnos)` | multipleLookupValues |

Field names are misspelled upstream (`Kind os T-Shirt?`, `Languaje`). The PAT has no
`schema:write` in production, so they must be consumed verbatim — do not "fix" them.

## Findings

### Frontend data layer

- `AIRTABLE_TABLES` in `src/utils/constants.ts` has no ONBOARDING entry.
- `src/data/adapters/index.ts` is the barrel switching Airtable/Supabase via
  `VITE_DATA_SOURCE`; production defaults to Airtable.
- `src/data/adapters/airtable/HistorialAdapter.ts:45` documents the governing gotcha:
  `FIND({Alumno})` resolves display names, not record IDs, so per-student filtering
  MUST happen client-side, and `maxRecords` must not be applied before that filter.
- `listRecords<T>(tableId, options)` (`AirtableClient.ts:146`) auto-paginates via
  `offset` and slices `maxRecords` only after accumulating pages. FIFO rate limiter,
  `MIN_INTERVAL_MS = 210`.
- `BaseRecord` (`src/types/index.ts:67-70`) is `{ id: string; createdTime?: string }`.
  Sibling entities (`Pago`, `Historial`, `RevisionVideo`) all follow
  `alumnoId: string` + `alumnoNombre?: string`.
- None of the six onboarding fields is an Airtable AI field, so the `{state, value}`
  extraction pattern does not apply. `Email (from Alumnos)` is a lookup and would
  return an array if ever mapped.

### Detail page

- `src/hooks/useAlumnoDetail.ts:16` — `AlumnoDetailTab = 'info' | 'revisiones' | 'pagos' | 'historial' | 'ia'`.
- Secondary tabs are lazy: `enabled: !!id && visitedTabs.has('<tab>')` (lines 37, 45, 53).
- **`useAlumnoDetail.ts:21` seeds `visitedTabs` with `new Set(['info'])`** — the Info tab
  is "visited" from first render, so a lazy gate on `'info'` is inert.
- `src/pages/admin/AlumnoDetail.tsx:249` — the Info tab is a two-card `styles.infoGrid`.
- `AlumnoDetail.module.css:177-181` — `.infoGrid` is `grid-template-columns: 1fr 1fr`,
  **fixed**, collapsing to `1fr` at `max-width: 800px` (line 241). It is not `auto-fit`,
  so a third card leaves a hole unless it spans both columns. `.saveBar` already sets
  `grid-column: 1 / -1`, so the precedent exists and no new CSS class is required.

### Caching consequence (decides the layout)

Because per-student filtering is client-side, the adapter fetches the whole onboarding
table. A per-student query key (`['onboarding', { alumnoId }]`) would therefore miss the
cache on every student and refetch the entire table each time. A **global** query key
(`['onboarding']`) fetches once per session and filters client-side — the pattern
`AlumnoDetail.tsx:54` already uses with `fetchAlumnos()` for the pareja dropdown.

This removes the cost objection to rendering onboarding inside the always-mounted Info
tab, so no new tab is needed.

### Pagos page

- `Pago.alumnoId` is already mapped in `airtable/PagosAdapter.ts` (`mapToPago`).
- Route `/admin/alumnos/:id` already exists.
- `src/pages/admin/Pagos.tsx:59-61` — first column key is `alumnoNombre`. Wrapping the
  rendered name in `<Link>` is the whole change.

### Supabase

- `SupabaseClient.ts` creates the client with the **anon key**, never service-role.
- Every table in `schema.sql` has RLS enabled with a permissive policy. `inscripciones`
  (the closest analog, also a form-intake table) uses exactly:
  ```sql
  ALTER TABLE inscripciones ENABLE ROW LEVEL SECURITY;                                   -- :603
  CREATE POLICY "Allow all for anon" ON inscripciones FOR ALL TO anon USING (true) WITH CHECK (true); -- :619
  GRANT SELECT ON inscripciones TO anon, authenticated, service_role;                    -- :622
  ```
  **Without all three, `select()` under the anon key returns zero rows silently — not an
  error.** The GRANT is per-table and not inherited.
- `supabase/schema.sql:468` defines `inscripciones` with the form-intake shape:
  structured columns for consumed fields + `respuestas_formulario JSONB` for the rest.

### Known gap to not repeat

`inscripciones` exists in `schema.sql` but is absent from `AIRTABLE_TABLES`,
`TABLE_COLUMNS` and `LOAD_ORDER` in `supabase/migrate_airtable_data.py`. It is orphaned
and never populated. The onboarding table must land in all three places.

### Testing

- Command: `npm test` → `"test": "vitest run"` (`package.json:11`), vitest `^4.1.11`.
- `vitest.config.ts` uses `environment: 'node'`, `include: ['src/**/*.test.ts', 'api/**/*.test.ts']`.
  No JSDOM, so adapters and pure logic are testable; React components are not.
- `EnviosEmailsAdapter.test.ts:9-18` mocks the client with
  `vi.mock('./AirtableClient', async (importOriginal) => ({ ...actual, <fn>: vi.fn() }))`.
  A new adapter test mocks `listRecords` the same way.
- There is no CI test run; `npm test` must be run manually before merge.

### i18n

- Both `src/i18n/es.json` and `en.json` carry a parallel `alumnos.*` group (from line 60).
  New labels belong there, in ES/EN parity, key by key.

## Open questions for the proposal phase

1. Table name in Supabase: `onboarding` vs `onboarding_form`. `inscripciones` uses a bare
   domain noun, which argues for `onboarding`.
2. Whether to also backfill `inscripciones` into the migrator while touching that file, or
   keep this change scoped and log the gap separately.
3. Whether the Instagram permission value warrants a badge rather than raw text, since it
   is consent data.

## Risks

- **Silent RLS failure** (high): omitting any of the three SQL lines yields an empty card
  with no error surfaced.
- **Cache thrash** (medium): a per-student query key refetches the whole table per student.
- **Field-name drift** (low): the upstream typos are load-bearing string literals.
- **Migrator parity** (medium): schema without migrator mapping produces another orphan.

## Constraints

- No new npm dependencies.
- Airtable is read-only from this codebase (no `schema:write`).
- Technical artifacts, code, comments and identifiers in English; UI strings via i18n.

## Next recommended

`sdd-propose`

## skill_resolution

`paths-injected`
