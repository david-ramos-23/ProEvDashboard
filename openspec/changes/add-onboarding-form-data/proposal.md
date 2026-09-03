# Proposal — add-onboarding-form-data

Status: `done`
Date: 2026-09-03
Artifact store: `openspec`
Source exploration: `openspec/changes/add-onboarding-form-data/explore.md`

## Why

The six Onboarding-form answers are **event logistics**: t-shirt size, t-shirt kind, name to
print, welcome-book language, Instagram consent and Instagram handle. They are what the course
admin needs when ordering merchandise, printing books and planning social posts.

Today they exist only in Airtable, and nobody opens Airtable during operations. The admin either
guesses, asks the student again, or context-switches out of the dashboard. The data is already
linked to the student record — it is simply invisible where the work happens.

Secondary gap: the Pagos table shows a student name that is not clickable, so reconciling a
payment against a student requires navigating to Alumnos and searching by name.

**After this change**: opening a student's Info tab shows their onboarding answers inline, and a
student name in Pagos is a link to that student's detail page.

## What changes

### Data layer (frontend)

| File | Impact | Change |
| --- | --- | --- |
| `src/utils/constants.ts` | Modified | `AIRTABLE_TABLES.ONBOARDING = 'tblyBkdLq0Ja06CH6'`; an `ONBOARDING_FIELDS` map holding the misspelled upstream literals verbatim; `CONSENT_COLORS` for the badge |
| `src/types/index.ts` | Modified | `Onboarding extends BaseRecord` interface |
| `src/data/adapters/airtable/OnboardingAdapter.ts` | New | `fetchOnboarding()` via `listRecords`, `mapToOnboarding()`, no `maxRecords` |
| `src/data/adapters/supabase/OnboardingAdapter.ts` | New | `select()` over the `onboarding` table, same return shape |
| `src/data/adapters/index.ts` | Modified | Barrel wiring behind `VITE_DATA_SOURCE` |
| `src/data/adapters/airtable/OnboardingAdapter.test.ts` | New | Mapping + client-side filter + latest-submission selection |

### Persistence (Supabase parity)

| File | Impact | Change |
| --- | --- | --- |
| `supabase/schema.sql` | Modified | `onboarding` table, 3 indexes, `ENABLE ROW LEVEL SECURITY`, `Allow all for anon` policy, `GRANT SELECT` — all four, per the `inscripciones` precedent |
| `supabase/MIGRACION-ONBOARDING-2026-09-03.sql` | New | Same DDL, idempotent (`IF NOT EXISTS`), for the already-provisioned shadow DB |
| `supabase/migrate_airtable_data.py` | Modified | `AIRTABLE_TABLES` + `TABLE_COLUMNS` + `LOAD_ORDER` — all three, so no orphan is created |

### UI

| File | Impact | Change |
| --- | --- | --- |
| `src/hooks/useAlumnoDetail.ts` | Modified | `useQuery({ queryKey: ['onboarding'] })`, filter client-side by `alumnoId`, return the latest submission |
| `src/pages/admin/AlumnoDetail.tsx` | Modified | Third card in the Info tab, `gridColumn: '1 / -1'` (the `.saveBar` precedent — no new CSS class) |
| `src/pages/admin/Pagos.tsx` | Modified | Wrap the `alumnoNombre` cell in `<Link to={/admin/alumnos/${row.alumnoId}}>` |
| `src/components/shared/StatusBadge.tsx` | Modified | One `case 'consent'` in `getStatusColor` (2 lines) |
| `src/i18n/es.json`, `src/i18n/en.json` | Modified | 9 keys under `alumnos.*`, ES/EN parity |

## Capabilities

### New Capabilities

- `onboarding-form-data`: read the onboarding form answers for a student through either adapter
  and surface them on the student detail page.
- `pagos-alumno-navigation`: navigate from a payment row to the corresponding student detail.

### Modified Capabilities

None. `openspec/specs/` does not yet exist in this project, so there is no prior spec to delta.

## Decisions

### D1 — Supabase table name: `onboarding`

Bare domain noun, matching every sibling table (`inscripciones`, `historial`, `pagos`). It also
keeps the table name, the adapter file name and the React Query key (`['onboarding']`) identical,
so there is one word to grep for across SQL, TypeScript and Python.

### D2 — The `inscripciones` migrator orphan is a separate follow-up, not part of this change

Fixing it means adding a *different* table's field mapping to `migrate_airtable_data.py` and
verifying it against a *different* Airtable table — roughly 30 more lines with its own
verification burden, unrelated to onboarding. Bundling it would push an already-borderline diff
over the 400-line budget and make the rollback non-atomic. This change fixes the *pattern* (it
lands onboarding in all three places) without retrofitting the older gap. Logged under
**Out of scope** as named follow-up work.

### D3 — Instagram consent renders as a badge, not plain text

It is consent data gating a real operational action (publishing a student's content). A badge
gives the colour+text signal the codebase already uses for every other state value, and
`StatusBadge` is built for exactly this extension — 7 `StatusType` values already exist and
unknown values fall back to `var(--color-text-muted)`. Cost: one `case 'consent'` line plus a
`CONSENT_COLORS` map in `constants.ts`, which is already in scope. The badge renders the Airtable
choice value verbatim, consistent with every other badge in the app; only the *label* is
translated.

### D4 — Structured columns vs `respuestas_formulario JSONB`

All six answers become **structured columns**, because all six are consumed by the UI. Following
the `inscripciones` shape at `schema.sql:468`, everything else the form carries now or grows later
goes into `respuestas_formulario JSONB` verbatim (key = the upstream label). `Email (from Alumnos)`
is a lookup and gets no column — it is derivable by joining `alumnos`.

| Supabase column | Type | Airtable source (verbatim) |
| --- | --- | --- |
| `id` | `UUID PK` | — |
| `airtable_id` | `TEXT UNIQUE` | record id |
| `alumno_id` | `UUID REFERENCES alumnos(id) ON DELETE SET NULL` | `Alumnos` |
| `tshirt_size` | `TEXT` | `T-Shirt Size?` |
| `tshirt_kind` | `TEXT` | `Kind os T-Shirt?` |
| `tshirt_name` | `TEXT` | `Name on the T-Shirt` |
| `welcome_book_language` | `TEXT` | `Languaje on the Welcome book?` |
| `instagram_consent` | `TEXT` | `Do you give us permission to use your Instagram account…` |
| `instagram_username` | `TEXT` | `Instagram username: (only if you selected "Yes")` |
| `timestamp_form` | `TIMESTAMPTZ` | `Timestamp` |
| `respuestas_formulario` | `JSONB` | all remaining fields |
| `created_at` / `updated_at` | `TIMESTAMPTZ DEFAULT now()` | — |

Indexes: `timestamp_form DESC`, `alumno_id`, `airtable_id`.

### D5 — `Onboarding` TypeScript interface

```ts
export interface Onboarding extends BaseRecord {
  alumnoId: string;
  alumnoNombre?: string;
  tshirtSize?: string;
  tshirtKind?: string;
  tshirtName?: string;
  welcomeBookLanguage?: string;
  instagramConsent?: string;
  instagramUsername?: string;
  submittedAt?: string;
}
```

`alumnoId` / `alumnoNombre` keep the established cross-entity convention shared by `Pago`,
`Historial` and `RevisionVideo`. The six answer fields are English because the upstream source is
English and identifiers in this change are English. All six are optional — a submission may leave
any single-select blank. `submittedAt` maps from Airtable `Timestamp` / Supabase `timestamp_form`.

### D6 — Multiple submissions: show the latest by `Timestamp`

The Airtable link is `multipleRecordLinks`, so a student can submit twice. The card renders the
**most recent submission** (descending `submittedAt`). Rationale: the answers are operational
inputs — the latest answer is the operative one, and there is no business rule for reconciling
contradictory answers. To keep this honest rather than silent, the card displays the submission
date, so an admin can see how fresh the answer is. Listing every submission is deferred.

### D7 — Empty state

A student with no onboarding record still gets the card, showing a single `alumnos.sinOnboarding`
message (ES: "Sin datos de onboarding" / EN: "No onboarding data"), mirroring the
`alumnos.sinHistorial` convention. The same state is shown if the query errors, so a missing
Supabase GRANT or a dropped table degrades to an empty card, never a crash.

## Out of scope

- **Writing or editing onboarding answers from the dashboard.** Read-only. The form is the system
  of record.
- **Modifying the Airtable schema**, including fixing the `Kind os T-Shirt?` and `Languaje on the
  Welcome book?` typos. The PAT has no `schema:write` in production.
- **Backfilling `inscripciones` into `migrate_airtable_data.py`** (D2). Follow-up: *"Map the
  orphaned `inscripciones` table in the Airtable→Supabase migrator"*.
- **A dedicated Onboarding tab**, list of all submissions, or export.
- **Aggregate views** (e.g. a t-shirt size tally across an edition). Real need, different change.
- **Backend/serverless changes.** No new `api/` route: Airtable reads go through the existing
  client path, Supabase through the existing anon-key client.
- **React component tests.** `vitest.config.ts` runs `environment: 'node'` with no JSDOM.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Silent RLS failure — omitting `ENABLE ROW LEVEL SECURITY`, the anon policy or `GRANT SELECT` makes `select()` return zero rows with **no error** | High | High | The apply phase must land all four SQL statements together, copied structurally from `inscripciones` (`schema.sql:603/619/622`). Verification step: run a `select` under the anon key and assert a non-zero row count — an empty card is not proof of correctness |
| Upstream field-name typos drift or get "corrected" by a well-meaning edit | Low | High | The literals live in one `ONBOARDING_FIELDS` constant with a comment stating they are verbatim upstream names; the adapter test asserts the mapping against a fixture using those exact keys |
| Cache thrash from a per-student query key | Low (decided) | Medium | Global `['onboarding']` key + client-side filter, matching `fetchAlumnos()` at `AlumnoDetail.tsx:54`. The apply phase must not "optimise" this into a per-student key |
| Third card breaks the Info-tab layout — `.infoGrid` is a fixed `1fr 1fr`, not `auto-fit` | Medium | Low | `gridColumn: '1 / -1'` on the new card, the existing `.saveBar` precedent; no new CSS class, and the ≤800px collapse to `1fr` keeps working |
| Another migrator orphan: table in `schema.sql` but absent from the migrator | Medium | Medium | The change explicitly touches all three of `AIRTABLE_TABLES`, `TABLE_COLUMNS` and `LOAD_ORDER`; `LOAD_ORDER` must place `onboarding` after `alumnos` because of the FK |
| Missing `alumnoId` on a submission (link left empty in Airtable) | Medium | Low | `mapToOnboarding` treats an empty link array as `''`; such records are filtered out client-side and never match a student |
| Instagram consent values differ from the assumed choice labels | Medium | Low | `CONSENT_COLORS` is a lookup with `StatusBadge`'s existing muted fallback — an unmapped value renders grey with correct text, never blank |
| Diff lands at the 400-line review budget | High | Medium | Chained PRs — see the forecast below |

## Estimated changed lines

| Group | Files | Est. lines |
| --- | --- | --- |
| Constants + types | `constants.ts`, `types/index.ts` | 32 |
| Airtable adapter | `airtable/OnboardingAdapter.ts` (new) | 55 |
| Supabase adapter | `supabase/OnboardingAdapter.ts` (new) | 45 |
| Adapter barrel | `data/adapters/index.ts` | 8 |
| Adapter test | `airtable/OnboardingAdapter.test.ts` (new) | 70 |
| SQL schema + migration | `schema.sql`, `MIGRACION-ONBOARDING-2026-09-03.sql` (new) | 65 |
| Migrator | `migrate_airtable_data.py` | 35 |
| Hook | `useAlumnoDetail.ts` | 18 |
| Detail card | `AlumnoDetail.tsx` | 45 |
| Pagos link | `Pagos.tsx` | 8 |
| Badge type | `StatusBadge.tsx` | 2 |
| i18n | `es.json`, `en.json` | 20 |
| **Total** | **14 files (5 new)** | **≈ 403** |

Note: 14 files, not the 12 scoped by the orchestrator. The two additions are the adapter test
(required — strict TDD is enabled) and the 2-line `StatusBadge.tsx` `consent` case implied by D3.

## Review workload forecast

- **Does the total exceed the 400-line budget?** Yes — ≈ 403 authored lines, essentially all
  additions. It sits exactly on the threshold, so any estimation slack pushes it over.
- **400-line budget risk**: High
- **Chained PRs recommended**: Yes
- **Decision needed before apply**: Yes (`delivery_strategy` is `ask-on-risk`)

Recommended split — two chained PRs, each with a clear finish, its own verification and an atomic
rollback:

| Slice | Contents | Est. lines | Verification |
| --- | --- | --- | --- |
| **PR #1 — data + persistence** | constants, types, both adapters, barrel, adapter test, `schema.sql`, `MIGRACION-*.sql`, migrator | ≈ 240 | `npm test` green; anon-key `select` on `onboarding` returns rows |
| **PR #2 — UI** (targets PR #1's branch) | hook, `AlumnoDetail.tsx` card, `Pagos.tsx` link, `StatusBadge.tsx`, i18n | ≈ 163 | `npm run build`; manual check of a student with data, a student without, and a Pagos row |

PR #1 ships adapters with no consumer, which is intentional in a stacked chain — PR #2 lands the
consumer. If the reviewer prefers finer slices, the SQL + migrator group (≈ 100 lines) peels off
PR #1 cleanly, since nothing in the Airtable path depends on it.

## Rollback plan

Frontend (either slice): `git revert` the slice's merge commit on `master` in the `dashboard`
nested repo, then redeploy on Vercel. The change is purely additive — no existing query, type or
component contract is altered, so reverting cannot orphan other code. The only shared-file edits
are appends (`constants.ts`, `types/index.ts`, `i18n/*.json`) plus a 2-line `StatusBadge.tsx` case.

Supabase: `DROP TABLE IF EXISTS onboarding CASCADE;`. Safe because no other table has a foreign key
into `onboarding` — the dependency points outward to `alumnos`. Nothing in the app writes to it, so
no data is lost that is not still in Airtable, which remains the system of record.

Partial rollback: the UI slice can be reverted alone, leaving the data layer in place with no user
impact.

## Dependencies

- Airtable base `app4ZpoxaWOyV4RnR`, table `tblyBkdLq0Ja06CH6` — read access via the existing PAT.
- Supabase shadow DB, for applying `MIGRACION-ONBOARDING-2026-09-03.sql`.
- No new npm or Python packages.

## Success criteria

- [ ] Opening a student who submitted the form shows a card in the Info tab with all six answers
      plus the submission date, in the active language.
- [ ] A student with no submission shows the `alumnos.sinOnboarding` empty state — no crash, no
      blank card, no console error.
- [ ] Instagram consent renders as a `StatusBadge`; an unmapped choice value still shows correct
      text in the muted colour.
- [ ] Clicking a student name in Pagos navigates to `/admin/alumnos/:id` for that student.
- [ ] Switching a student in the detail view does **not** refetch the onboarding table (one fetch
      per session under the `['onboarding']` key).
- [ ] `npm test` passes, including the new adapter test.
- [ ] With `VITE_DATA_SOURCE=supabase`, the card renders the same data as with Airtable.
- [ ] A `select` on `onboarding` under the **anon** key returns a non-zero row count.
- [ ] `onboarding` appears in all three of `AIRTABLE_TABLES`, `TABLE_COLUMNS` and `LOAD_ORDER` in
      `migrate_airtable_data.py`, and a migrator run populates the table.
- [ ] Upstream field names are consumed verbatim; no attempt is made to write to Airtable.

## Proposal question round

`execution_mode` is `auto` and this executor has no direct channel to the user, so the following
assumptions are stated rather than asked. Each is low-cost to reverse before `sdd-apply`.

1. **Latest submission only (D6).** Assumed: duplicate submissions are rare and the newest answer
   wins. If the admin needs to see that a student changed their answer, the card should list all
   submissions instead — that changes the card layout, not the data layer.
2. **Read-only.** Assumed: the admin never needs to correct a wrong t-shirt size from the
   dashboard. If they do, that is a write path back to Airtable and a materially larger change.
3. **No aggregate view.** Assumed: the immediate need is per-student lookup, not "how many
   size-L shirts do I order for this edition". The latter is a real operational need and would be
   the natural follow-up change.
4. **`inscripciones` deferral (D2).** Assumed acceptable that the older orphan stays broken for
   now. If it is actually blocking something, it should be its own change rather than a rider here.
5. **Consent values.** Assumed the Instagram consent single-select uses Yes/No-style choices. The
   exact choice labels must be read from the Airtable schema during `sdd-design` to key
   `CONSENT_COLORS` correctly.
