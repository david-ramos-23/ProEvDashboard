# Apply progress — add-onboarding-form-data

Status: in-progress
Engram: DOWN (CONNECT_TIMEOUT) — using file-based progress tracking only.

## Completed

- **T1** — resolved by orchestrator (no-op for apply).
- **T2** — `src/types/index.ts`: added `Onboarding extends BaseRecord` interface after `Historial`
  (before `Edicion`). Matches design §4.1 exactly.
- **T3** — `src/utils/constants.ts`: added `AIRTABLE_TABLES.ONBOARDING`, `ONBOARDING_FIELDS` (with
  the T1-resolved `INSTAGRAM_CONSENT` literal, embedded `\n` between the two sentences — verified
  against T1's resolution, not the truncated design §4.2 placeholder), and `CONSENT_COLORS` (design
  §11.2, placed after `EMAIL_COLORS`).
- **T4** — `src/data/adapters/airtable/OnboardingAdapter.test.ts` (new), 7 `it` blocks across 6
  `describe` groups covering design §14.3 cases 1-6 (mapping, client-side filter + D-A2
  no-`filterByFormula`/no-`maxRecords` guard, latest-by-Timestamp tie-break, empty result, missing
  alumno link, sparse submission). Ran RED first: `Cannot find module
  '/src/data/adapters/airtable/OnboardingAdapter'` — confirmed via
  `npx vitest run src/data/adapters/airtable/OnboardingAdapter.test.ts`.
- **T5** — `src/data/adapters/airtable/OnboardingAdapter.ts` (new): `mapToOnboarding()` +
  `fetchOnboarding({ alumnoId })`, sorted newest-first by `submittedAt`, no `maxRecords`/
  `filterByFormula` passed (D-A2). Ran GREEN: `PASS (6) FAIL (0)`.

## Reconciliation with updated tasks.md (team-lead corrections found mid-apply)

`tasks.md` was updated on disk after my initial read, with corrected T1 findings I didn't have when
I first wrote T3/T4. Applied the corrections:

- **T3** — `CONSENT_COLORS` redesigned per T1: the field has exactly ONE real choice
  (`✅ Yes, I give my consent`, choiceId `selQhGFRjgLwuIwKN`) — it's a checkbox in singleSelect
  clothing, no "No" option exists. Replaced the guessed yes/si/sí/no/maybe/tal vez/quizás map with
  a single normalised key `'✅ yes, i give my consent'`.
- **T4** — fixed `FULL_SUBMISSION` fixture to use real Airtable choice values instead of
  placeholders: `'Kind os T-Shirt?': 'Male'` (was `'Fitted'`), `'Languaje on the Welcome book?':
  '🇪🇸 Español'` (flag emoji, was bare `'Español'`), consent value `'✅ Yes, I give my consent'`
  (was `'Yes'`). Updated the matching assertions in the mapping test. Re-ran: still `PASS (6) FAIL
  (0)` — the adapter is a pure passthrough so behavior didn't change, only fixture fidelity.
- **T5** — no code change needed (adapter doesn't hardcode any choice value).

- **T6** — `src/data/adapters/supabase/OnboardingAdapter.ts` (new). Mirrors design §6 exactly:
  `alumnos ( nombre )` embed, `.order('timestamp_form', { ascending: false, nullsFirst: false })`,
  optional server-side `alumno_id` filter. Not affected by T1 corrections (no hardcoded choice
  values). Verify: `npm run build` deferred to T23.
- **T7** — `src/data/adapters/index.ts`: added `onboarding` to both `Promise.all` arrays
  (airtable + supabase) and their destructuring/returned object, plus the `fetchOnboarding`
  re-export via the `Parameters<typeof import(...)>` idiom, placed after the `--- Historial ---`
  block. Verify: `npm run build` deferred to T23.
- **T8** — `supabase/schema.sql`: inserted section 4c (`onboarding` table + 3 indexes) after the
  `inscripciones` indexes, before `-- 5. VIEWS`. Matches design §7.1 verbatim.
- **T9** — `supabase/schema.sql`: inserted the 3 RLS statements next to their `inscripciones`
  siblings (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` at line ~604, `CREATE POLICY "Allow all for
  anon"` at ~620, `GRANT SELECT ... TO anon, authenticated, service_role` at ~623). This is R1 —
  all three landed together.
- **T10** — `supabase/MIGRACION-ONBOARDING-2026-09-03.sql` (new): same DDL as T8+T9, idempotent
  (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` guard, naturally-idempotent `GRANT`).
  **NOT applied to any database** — per hard prohibition #2, this is left as a file for the user to
  apply to the shadow DB.

- **T11** — `supabase/migrate_airtable_data.py`: appended `"onboarding": "tblyBkdLq0Ja06CH6"` to
  `AIRTABLE_TABLES`.
- **T12** — same file: appended the onboarding comment block + 6 field mappings to `FIELD_MAP`
  (end of dict, after `"Alumnos": "alumnos_ids"`). `INSTAGRAM_CONSENT` key uses the T1-resolved
  literal with the real embedded newline (`\n`), matching `ONBOARDING_FIELDS.INSTAGRAM_CONSENT` in
  the TS side exactly. Deliberately does NOT add an `"Alumnos"` key (stays bound to
  `envios_emails.alumnos_ids`).
- **T15** — added `TABLE_FIELD_OVERRIDES: dict[str, dict[str, str]] = {"onboarding": {"Alumnos":
  "alumno_id"}}` declared immediately after `FIELD_MAP`, and changed `map_record`'s lookup line to
  `col = overrides.get(at_field) or FIELD_MAP.get(at_field)`. This is the D-A5 collision fix.
- **T13** — appended the `"onboarding"` block to `TABLE_COLUMNS` (after `"historial"`): 7
  `ColSpec`s, `fk="alumnos"` on `alumno_id`, no `enum=`, no `not_null`. `respuestas_formulario`
  deliberately absent (D-A4).
- **T14** — appended `"onboarding"` to `LOAD_ORDER`, last position (after `"historial"`),
  correctly after `"alumnos"` for FK safety.
- **Verification (T15's gate, R2)** — ran `python migrate_airtable_data.py --self-test` from
  `dashboard/supabase/`. Output: `SELF-TEST: PASS (run rc=1)`, all listed assertions `True`,
  including `pareja self-FK mapped`, `lookup-list coerced->scalar`, `envio uuid[] cast in
  template`, etc. — confirms every table OTHER than `onboarding` still maps byte-identically after
  the override-lookup change. This is offline/self-contained; no DB was touched (confirmed by
  reading the script — `--self-test` builds synthetic fixtures and never opens a psycopg2
  connection).

- **T17** — `src/hooks/useAlumnoDetail.ts`: added `fetchOnboarding` import, `useMemo` to the
  `react` import, `onboardingQuery` (global `['onboarding']` key, `staleTime: 5 * 60 * 1000`, no
  `enabled` clause — D-A1), the latest-submission `useMemo`, `onboardingLoading`; returned both.
- **T18** — `src/components/shared/StatusBadge.tsx`: extended `StatusType` with `'consent'`,
  imported `CONSENT_COLORS`, added `case 'consent': return
  CONSENT_COLORS[status.trim().toLowerCase()] || 'var(--color-text-muted)'`.
- **T19** — `src/pages/admin/AlumnoDetail.tsx`: inserted the onboarding card as the third child of
  `.infoGrid` with `style={{ gridColumn: '1 / -1' }}` (the `.saveBar` precedent). Loading skeleton /
  `sinOnboarding` empty state / 6-answer grid using `styles.field`. **Consent ternary implemented
  per T1's load-bearing requirement**: `onboarding.instagramConsent ? <StatusBadge ... type="consent"
  /> : <span>—</span>` — an absent value renders the plain em-dash, never a badge. Added
  `onboarding`, `onboardingLoading` to the `useAlumnoDetail` destructuring.
- **T20** — `src/i18n/es.json`: added the 9 keys under `alumnos.*` next to `sinHistorial`.
- **T21** — `src/i18n/en.json`: added the matching 9 keys, same paths, key-by-key parity with T20.
- **T22** — `src/pages/admin/Pagos.tsx`: imported `Link` from `react-router-dom`; wrapped the
  `alumnoNombre` column render in a `<Link to={`/admin/alumnos/${p.alumnoId}`}>` guarded on
  `p.alumnoId` (not `p.alumnoNombre`), falling back to the original plain `<span>` when absent.

- **T23** — `npm run build` (`tsc -b && vite build`). Clean, exit 0. Confirmed both
  `OnboardingAdapter` chunks (airtable + supabase) present in the dist output as separate
  lazy-loaded chunks (`OnboardingAdapter-DvuQGIAh.js`, `OnboardingAdapter-BS0oTQnd.js`) — barrel
  wiring (T7) and the `VITE_DATA_SOURCE` tree-shaking pattern both hold.
- **T24** — `npx vitest run` (full suite, not just the new file). `PASS (40) FAIL (0)`, exit code
  0. No existing test regressed; includes the 6 (7 `it`) new `OnboardingAdapter.test.ts` cases,
  RED-then-GREEN per strict TDD.

## Remaining

- **T16 ONLY** — running `migrate_airtable_data.py --load` against the shadow DB, and applying
  `MIGRACION-ONBOARDING-2026-09-03.sql` to that DB. NOT executed — hard prohibition #1/#2 in the
  task brief: no live DB access from apply. This is the user's operational step.

## Status: apply-complete except T16

All 23 code/artifact tasks (T1-T15, T17-T24) are done and verified by the tools available to apply
(vitest, tsc/vite, the migrator's offline `--self-test`). T16 and the manual/Playwright items in
the Verification gate (gate #1, #2, #5-#12) require either a live Supabase connection or a running
browser and are explicitly out of apply's reach — they are the next step for the user or
`sdd-verify`.

## Notes / deviations from design literal text

- `ONBOARDING_FIELDS.INSTAGRAM_CONSENT` uses the FULL two-sentence literal with an embedded newline
  (per T1's resolution), not the shorter placeholder shown in design.md §4.2's code sample. This is
  the correct, more specific source — design.md itself flags this constant as the one open item
  (R3) requiring a live re-read at apply time.
