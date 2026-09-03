# Tasks — add-onboarding-form-data

Status: `apply-complete` (T1-T15, T17-T24 done; T16 intentionally NOT executed — no live DB access
from apply, left for the user)
Date: 2026-09-03
Artifact store: `openspec`
Inputs: `proposal.md`, `design.md`, `specs/onboarding-form-data/spec.md`, `specs/pagos-alumno-navigation/spec.md`

**Delivery strategy: `single-pr`, `size:exception` GRANTED.** Diff ≈410 lines against the 400-line
budget. One PR — the data layer (T1-T16) delivers no user value alone, and the UI layer (T17-T22)
would not compile without the adapters (T7). Do not split into chained PRs.

**Repo target:** `dashboard/` is a nested git repo (ProEvDashboard, branch `master`). All commits
and the PR go there, not to the parent repo.

**Strict TDD:** T4 (adapter test) is written and run RED before T5 (adapter implementation) exists.

## Parallelizable work

- T1 is now a **resolved data record** (closed 2026-09-03 by team-lead via live Airtable schema
  read) — no lookup work remains, T2 and T3 proceed directly using its verified values.
- T8-T9 (`schema.sql`) have no dependency on the TypeScript work (T2-T7) — run in parallel with it.
- T20-T21 (i18n) have no dependency on the TypeScript work — run in parallel, but must land before
  T19's manual verification (the card renders the keys).
- T22 (Pagos link) is fully independent of the onboarding data layer — run any time.
- Everything else is sequential per its stated `After:`.

---

## Group 0 — Blocking pre-work

- [x] **T1** — RESOLVED by the orchestrator via Airtable MCP `get_table_schema` on 2026-09-03.
  Apply has NO Airtable MCP access, so do not attempt to re-query — use these verified literals.

  Field name (`fldSJA4YmlT7FlTYW`) — contains a real newline between the two sentences:

  ```
  Do you give us permission to use your Instagram account in future posts related to the course content?
  *This includes the possibility of tagging you in photos, videos, or collaborations created during the event.
  ```

  **Design correction — this singleSelect has exactly ONE choice:** `✅ Yes, I give my consent`
  (`selQhGFRjgLwuIwKN`). There is no "No" option; it is a checkbox in single-select clothing.

  Therefore an ABSENT value means "did not answer", NOT "withheld consent". These are different
  facts and this is consent data, so T3/T18/T19 MUST render a present value as the affirmative
  badge and an absent value as the codebase's neutral `—` empty state. Rendering "No" for an
  empty field would assert a refusal the student never made. Keep `StatusBadge`'s muted fallback
  so choices added later in the Airtable UI still render their own text.

  Other verified choices (data strings — NOT translated via i18n; only field LABELS are):
  - `Languaje on the Welcome book?` (`fld86fKkqLeWVNJBS`): `🇪🇸 Español`, `🇬🇧 English` — the flag
    emoji is part of the literal string value; any equality comparison must account for it.
  - `Kind os T-Shirt?` (`fldmRUwtEWGnt9vxN`): `Male`, `Female`
  - `T-Shirt Size?` (`fldP0CGbIUeIsr24D`): `S`, `M`, `XL`, `L`, `XS` — there is no XXL. Airtable
    returns them unordered; display order is `XS, S, M, L, XL`.

  Verify: none needed — literals are recorded above.

## Group 1 — Types & constants

- [x] **T2** — `src/types/index.ts`: append the `Onboarding extends BaseRecord` interface after
  `Historial` (design §4.1).
  Requirement: onboarding-form-data (six answers surfaced).
  After: none.
  Verify: `npm run build` (tsc).

- [x] **T3** — `src/utils/constants.ts`: three additions.
  (a) `AIRTABLE_TABLES.ONBOARDING` entry.
  (b) `ONBOARDING_FIELDS` map — `INSTAGRAM_CONSENT` uses T1's verified literal VERBATIM, including
  the embedded newline (write it as `\n` inside the TS string; it is one field name, not two).
  (c) `CONSENT_COLORS` — **redesigned per T1's finding; supersedes design.md §11.2's guessed
  `yes`/`si`/`sí`/`no`/`maybe`/`tal vez`/`quizás` keys.** The field has exactly one real choice, so
  the map holds exactly one normalized key:
  ```ts
  export const CONSENT_COLORS: Record<string, string> = {
    // Only real choice as of 2026-09-03 (fieldId fldSJA4YmlT7FlTYW, choiceId
    // selQhGFRjgLwuIwKN). This is a checkbox disguised as a singleSelect — there
    // is no "No" choice. An ABSENT value means "did not answer", not "declined";
    // AlumnoDetail.tsx renders the neutral '—' for that case WITHOUT reaching
    // this map (see T19). Unmapped future choices (an admin can add one from the
    // Airtable UI) fall back to StatusBadge's muted color via T18, never blank.
    '✅ yes, i give my consent': 'var(--color-accent-success)',
  };
  ```
  Do NOT restore the `no`/`maybe`/`tal vez`/`quizás` keys — those choices do not exist in Airtable.
  Requirement: onboarding-form-data; Instagram consent badge requirement (known-value and
  unmapped-value scenarios).
  After: T1.
  Verify: `npm run build`.

## Group 2 — Adapter test (TDD red)

- [x] **T4** — `src/data/adapters/airtable/OnboardingAdapter.test.ts` (new): mock `listRecords`
  per `EnviosEmailsAdapter.test.ts` shape, fixture using the misspelled upstream field KEYS
  verbatim, 6 cases per design §14.3 (mapping, client-side alumno filter with the no-
  `filterByFormula`/no-`maxRecords` regression guard, latest-by-Timestamp tie-break, empty result,
  missing alumno link, sparse submission).
  **Fixture correction per T1:** design.md §14.2's `FULL_SUBMISSION` used placeholder choice
  VALUES that turned out fictitious. Use the real ones instead — `'Kind os T-Shirt?': 'Male'` (not
  `'Fitted'`), `'Languaje on the Welcome book?': '🇪🇸 Español'` (flag emoji included, not bare
  `'Español'`), and the consent key's value is `'✅ Yes, I give my consent'` (not `'Yes'`). The
  adapter is a pure passthrough, so this does not change pass/fail — it stops the test fixture from
  documenting data that doesn't exist.
  Requirement: onboarding-form-data (latest submission wins); D-A2 regression guard.
  After: T2, T3.
  Verify: `npm test` — expected **RED** (`./OnboardingAdapter` does not exist yet).

## Group 3 — Airtable adapter (TDD green)

- [x] **T5** — `src/data/adapters/airtable/OnboardingAdapter.ts` (new): `mapToOnboarding()`,
  `fetchOnboarding({ alumnoId })`, sorted newest-first by `submittedAt`, no `maxRecords` passed
  (design §5, D-A2).
  Requirement: onboarding-form-data.
  After: T4.
  Verify: `npm test` — **GREEN**, all 6 cases pass.

## Group 4 — Supabase adapter

- [x] **T6** — `src/data/adapters/supabase/OnboardingAdapter.ts` (new): `select()` with
  `alumnos ( nombre )` embed, `.order('timestamp_form', { ascending: false, nullsFirst: false })`,
  optional server-side `alumno_id` filter behind the same `options` shape as T5 (design §6).
  Requirement: "Behavior is identical across data sources" (onboarding-form-data spec).
  After: T2.
  Verify: `npm run build`. (No live-client test harness exists for Supabase adapters in this repo —
  stated gap, verified manually in T-Verification-10.)

## Group 5 — Barrel

- [x] **T7** — `src/data/adapters/index.ts`: wire `OnboardingAdapter` into both `Promise.all`
  arrays (Airtable + Supabase) and their destructuring/return objects, then append the
  `fetchOnboarding` re-export using the `Parameters<typeof import(...)>` idiom (design §6.1).
  Requirement: onboarding-form-data (adapter switch via `VITE_DATA_SOURCE`).
  After: T5, T6.
  Verify: `npm run build` (catches barrel type drift between the two adapters).

## Group 6 — Persistence: `schema.sql`

- [x] **T8** — `supabase/schema.sql`: insert new section 4c — the `onboarding` table + 3 indexes —
  after the `inscripciones` indexes (after line 486) and before `-- 5. VIEWS` (design §7.1).
  Requirement: onboarding-form-data (persistence parity with `inscripciones`).
  After: none.
  Verify: manual SQL review against design §7.1.

- [x] **T9** — `supabase/schema.sql`: insert the 3 RLS statements (`ALTER TABLE ... ENABLE ROW
  LEVEL SECURITY`, `CREATE POLICY "Allow all for anon"`, `GRANT SELECT ... TO anon, authenticated,
  service_role`) each next to its `inscripciones` sibling (design §7.2).
  Requirement: onboarding-form-data — "Read failures degrade to the empty state" scenario
  (Supabase RLS misconfiguration).
  After: T8.
  Verify: manual SQL review. **This is silent-failure risk R1 — see Verification gate #1.**

## Group 7 — Persistence: migration file

- [x] **T10** — `supabase/MIGRACION-ONBOARDING-2026-09-03.sql` (new): same DDL as T8+T9, fully
  idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` guard before `CREATE POLICY`,
  naturally-idempotent `GRANT`) (design §7.3). This file — not `schema.sql` — is what actually gets
  applied, because the shadow DB is already provisioned.
  Requirement: onboarding-form-data.
  After: T8, T9.
  Verify: apply to the shadow DB, then `SELECT count(*) FROM onboarding;` — table exists (0 rows
  expected at this point; no data loaded yet).

## Group 8 — Migrator

- [x] **T11** — `supabase/migrate_airtable_data.py`: append `"onboarding": "tblyBkdLq0Ja06CH6"` to
  `AIRTABLE_TABLES` (design §8.1).
  Requirement: onboarding-form-data (migration path).
  After: T10.
  Verify: none automated (syntax-level change).

- [x] **T12** — same file: append the onboarding comment block + 6 field mappings to `FIELD_MAP`
  (design §8.2). Deliberately does **not** add an `"Alumnos"` key — that stays bound to
  `envios_emails.alumnos_ids`.
  Requirement: onboarding-form-data.
  After: T11.
  Verify: none automated; guarded by T15's collision fix.

- [x] **T13** — same file: append the `"onboarding"` block to `TABLE_COLUMNS` (7 `ColSpec`s,
  `fk="alumnos"` on `alumno_id`, no `enum=`, no `not_null`, `respuestas_formulario` deliberately
  absent per D-A4) (design §8.3).
  Requirement: onboarding-form-data.
  After: T12.
  Verify: none automated (syntax-level change).

- [x] **T14** — same file: append `"onboarding"` to `LOAD_ORDER`, **after** `"alumnos"`
  (FK-safety — `alumno_id` resolves through the `alumnos` recId map) — last position (design §8.4).
  Requirement: onboarding-form-data (FK integrity).
  After: T13.
  Verify: manual review of the list order.

- [x] **T15** — same file: add the `TABLE_FIELD_OVERRIDES` dict (declared next to `FIELD_MAP`) and
  change the 2 lookup lines inside `map_record` to consult it before the global `FIELD_MAP` (D-A5,
  design §8.5). This is the fix for the `"Alumnos"` global-key collision.
  Requirement: onboarding-form-data — the `alumno_id` FK must resolve correctly, not silently null.
  After: T14.
  Verify: run the migrator's `_self_test()` (if present) to confirm every OTHER table's mapping is
  byte-identical to before this change. **This is silent-failure risk R2 — see Verification gate
  #2.**

- [ ] **T16** — Run `migrate_airtable_data.py` against the shadow DB (execution task, not a code
  change).
  Requirement: onboarding-form-data (data actually lands in Supabase).
  After: T15.
  Verify: `SELECT count(*) FROM onboarding;` returns **> 0**, AND
  `SELECT count(*) FROM onboarding WHERE alumno_id IS NULL;` reconciles against the number of
  Airtable rows whose `Alumnos` link is empty (not a high/unexplained count). **See Verification
  gate #1 and #2 — both are mandatory, neither crashes on failure.**

## Group 9 — Hook

- [x] **T17** — `src/hooks/useAlumnoDetail.ts`: add `fetchOnboarding` to the existing adapter
  import, add `useMemo` to the `react` import, add `onboardingQuery` (`queryKey: ['onboarding']` —
  **global key, not per-student**, `staleTime: 5 * 60 * 1000`, no `enabled` clause), the
  `onboarding` latest-submission `useMemo`, and `onboardingLoading`; return both from the hook
  (design §9, D-A1).
  Requirement: onboarding-form-data (visible on Info tab); "Latest submission wins".
  After: T7.
  Verify: `npm run build`. Do **not** change `['onboarding']` into a per-student key — that is
  D-A1's load-bearing decision, checked manually in Verification gate #7.

## Group 10 — StatusBadge

- [x] **T18** — `src/components/shared/StatusBadge.tsx`: extend the `StatusType` union with
  `'consent'`, import `CONSENT_COLORS`, add `case 'consent': return
  CONSENT_COLORS[status.trim().toLowerCase()] || 'var(--color-text-muted)'` inside
  `getStatusColor` (design §11.1). Logic itself is unchanged by T1 — normalization still matters
  so the one real `CONSENT_COLORS` key matches `status.trim().toLowerCase()`.
  Requirement: "Instagram consent renders as a status badge" (onboarding-form-data spec). Per T1:
  "known value" now means the one real choice `✅ Yes, I give my consent`; "unmapped value" now
  means any choice an admin adds later from the Airtable UI — not a fictitious "No"/"Maybe".
  After: T3.
  Verify: `npm run build`.

## Group 11 — UI card

- [x] **T19** — `src/pages/admin/AlumnoDetail.tsx`: insert the onboarding card as the **third
  child inside** `.infoGrid` (after the notas-internas card, before the grid's closing `</div>`),
  with `style={{ gridColumn: '1 / -1' }}` (the `.saveBar` precedent — no new CSS class). Renders
  loading skeleton / empty state (`alumnos.sinOnboarding`) / the 6 answers + submission date, using
  the `styles.field` idiom and the `consent` `StatusBadge` (design §10). Add the two new hook
  return values to the existing `useAlumnoDetail` destructuring.
  **Load-bearing per T1:** the consent field's ternary — `onboarding.instagramConsent ?
  <StatusBadge status={onboarding.instagramConsent} type="consent" /> : <span>—</span>` (design
  §10) — MUST render the plain `—` for an absent value, NEVER a badge. Do not "simplify" this to
  always render `<StatusBadge>`; the field has no "No" choice, so an absent value means "did not
  answer", not "declined" (T1).
  Requirement: "Onboarding answers are visible on the Info tab"; "Empty state when no submission
  exists"; "Latest submission wins when multiple exist" (date display); "Instagram consent renders
  as a status badge" (absent/unmapped handling).
  After: T17, T18, T20, T21.
  Verify: manual/Playwright — student **with** a submission shows all 6 answers + date in ES and
  EN; student **without** shows the empty state, no console error; a student who answered every
  question EXCEPT consent shows `—` for consent, never a "No" badge. See Verification gate #5, #6,
  #8, #11.

## Group 12 — i18n

- [x] **T20** — `src/i18n/es.json`: add the 9 keys under `alumnos.*` (near `sinHistorial`) per the
  table in design §13.
  Requirement: "Onboarding strings exist in both supported languages".
  After: none.
  Verify: manual review.

- [x] **T21** — `src/i18n/en.json`: add the matching 9 keys, same paths as T20.
  Requirement: "Onboarding strings exist in both supported languages" — key parity scenario.
  After: T20.
  Verify: manual key-by-key parity check against `es.json` (no automated i18n parity check exists
  in this project). See Verification gate #12.

## Group 13 — Pagos navigation (independent slice)

- [x] **T22** — `src/pages/admin/Pagos.tsx`: import `Link` from `react-router-dom`; wrap the
  `alumnoNombre` column's `render` in a `<Link to={`/admin/alumnos/${p.alumnoId}`}>` guarded on
  `p.alumnoId` (**not** `p.alumnoNombre` — an empty id must not render `<Link to="/admin/alumnos/">`,
  which would match the list route) (design §12).
  Requirement: pagos-alumno-navigation (both requirements: link on known student, safe render on
  unknown student).
  After: none.
  Verify: manual/Playwright — row with a linked student navigates to `/admin/alumnos/:id`; row
  without a link stays inert plain text, no malformed `<Link>`. See Verification gate #9.

## Group 14 — Build & test gates

- [x] **T23** — Full `npm run build` (type-check via `tsc -b` + Vite build) across every TS/TSX
  change (T2-T7, T17-T22).
  Requirement: all — this is the repo's only CI-equivalent gate; there is no CI on `dashboard/`.
  After: T19, T22, T21.
  Verify: exit code 0, no type errors.

- [x] **T24** — `npm test` (`vitest run`) green, including all 6 new `OnboardingAdapter.test.ts`
  cases (T4).
  Requirement: onboarding-form-data — mapping, latest-submission ordering, D-A2 regression guard.
  After: T5.
  Verify: exit code 0, 6/6 new assertions pass, no existing test regressed.

---

## Verification gate

All of the following MUST pass before this change is done. **The two silent-failure checks are
listed first — neither one crashes, so "it rendered/ran without errors" is not evidence for
either.**

1. **[SILENT FAILURE — RLS, R1]** `SELECT count(*) FROM onboarding;` run under the Supabase
   **anon** key (never service-role) returns **> 0** after T16. A zero-row result with no error
   means one of the three T9 RLS statements is missing or wrong — this is a configuration defect,
   not proof the feature doesn't apply here. Spec: onboarding-form-data, "Supabase RLS
   misconfiguration returns zero rows silently".

2. **[SILENT FAILURE — FIELD_MAP collision, R2]** `SELECT count(*) FROM onboarding WHERE
   alumno_id IS NULL;` after T16 reconciles against the count of Airtable rows whose `Alumnos`
   link is empty (not a high/unexplained count — see D-A5). AND the migrator's `_self_test()` (or
   equivalent manual diff) confirms every table OTHER than `onboarding` maps byte-identically to
   before T15.

3. `npm test` green (T24), including the D-A2 no-`filterByFormula`/no-`maxRecords` regression
   guard in case 2 of `OnboardingAdapter.test.ts`.

4. `npm run build` clean (T23) — run by hand, there is no CI on this repo.

5. Manual: a student **with** a submission shows all 6 answers + submission date, in both ES and
   EN (T19, T20, T21).

6. Manual: a student **without** a submission shows the `alumnos.sinOnboarding` empty state — no
   crash, no blank card, no console error (T19).

7. Manual: open 3 different students in a row with the Network tab open — **exactly one** request
   to the onboarding table/endpoint across all three. More than one means the global `['onboarding']`
   query key (D-A1, T17) was broken into a per-student key.

8. Manual: Info tab at ≥1024px and at ≤800px — the card spans full width and the `.infoGrid`
   collapses cleanly at both breakpoints (T19).

9. Manual: a Pagos row with a linked student navigates to `/admin/alumnos/:id`; a row without a
   link renders inert plain text, no malformed `<Link>` (T22).

10. Manual: with `VITE_DATA_SOURCE=supabase`, the same student renders the same 6 answers as with
    `VITE_DATA_SOURCE=airtable` (T6, T19) — closes the "Behavior is identical across data sources"
    requirement, which has no automated coverage for the Supabase path.

11. Manual: Instagram consent badge — the one real value (`✅ Yes, I give my consent`) shows the
    success color; a future unmapped choice still shows correct text in the muted fallback color,
    never blank; and, separately, a student who left consent blank shows the neutral `—`, **never
    a "No" badge** (T1, T3, T18, T19) — absence means "did not answer", not "declined".

12. Manual: every new `alumnos.*` i18n key exists with a translated value in both `es.json` and
    `en.json` (T20, T21).

13. `onboarding` appears in all three of `AIRTABLE_TABLES`, `TABLE_COLUMNS` and `LOAD_ORDER` in
    `migrate_airtable_data.py` (T11, T13, T14) — no orphaned-table class of bug, matching the
    `inscripciones` failure this change explicitly avoids repeating.

## Out of scope (unchanged from proposal — no task exists for these)

- Writing/editing onboarding answers from the dashboard.
- Fixing the pre-existing `inscripciones` migrator orphan (D2 — separate follow-up).
- Populating `respuestas_formulario` JSONB (D-A4 — separate follow-up, needs a new migrator
  mechanism).
- A dedicated Onboarding tab, list of all submissions, export, or aggregate views.
- React component unit tests (`vitest.config.ts` runs `environment: 'node'`, no JSDOM — UI
  verification is manual/Playwright throughout this file).

## Next recommended

`sdd-apply`
