# Onboarding Form Data Specification

## Purpose

Read-only access to a student's Onboarding form answers (t-shirt size, t-shirt kind, name to
print, welcome-book language, Instagram consent, Instagram username), sourced from whichever
adapter is active (Airtable or Supabase), surfaced on the student detail page's Info tab, and
degrading to a defined empty state whenever no submission exists or the read fails.

## Requirements

### Requirement: Onboarding answers are visible on the Info tab

The system MUST display, on a student's detail page Info tab, all six Onboarding form answers for
a student who has submitted the form, without requiring navigation away from the Info tab.

#### Scenario: Student has one submission

- GIVEN a student with exactly one Onboarding submission linked to their record
- WHEN an admin opens that student's detail page
- THEN all six answers are visible on the Info tab
- AND no additional click or tab switch is required to see them
- (Verification: manual/Playwright — React component, project runs vitest with no JSDOM)

### Requirement: Latest submission wins when multiple exist

When a student has more than one Onboarding submission linked, the system MUST display only the
most recent one, ordered by submission timestamp descending, and MUST show that submission's date
alongside the answers.

#### Scenario: Student submitted the form twice

- GIVEN a student with two Onboarding submissions carrying different timestamps
- WHEN an admin opens that student's detail page
- THEN the answers shown are from the submission with the latest timestamp
- AND the submission date is visible on the card
- (Verification: npm test — adapter's latest-submission selection; date rendering is manual/Playwright)

### Requirement: Empty state when no submission exists

The system MUST show the `alumnos.sinOnboarding` message instead of a blank or missing card when a
student has no linked Onboarding submission.

#### Scenario: Student never submitted the form

- GIVEN a student with no Onboarding record linked
- WHEN an admin opens that student's detail page
- THEN the Info tab shows the `alumnos.sinOnboarding` message
- AND no error is thrown and no card is missing
- (Verification: manual/Playwright)

### Requirement: Read failures degrade to the empty state, never a crash

The system MUST treat a failed onboarding fetch, or a data source returning zero rows for any
reason (including a misconfigured Supabase Row Level Security policy), the same as "no
submission" — the empty state renders, not an unhandled error or a blank card.

#### Scenario: Onboarding fetch throws

- GIVEN the onboarding data fetch rejects (network or adapter error)
- WHEN an admin opens a student's detail page
- THEN the Info tab shows the `alumnos.sinOnboarding` empty state
- AND the page does not crash or surface an unhandled error boundary
- (Verification: manual/Playwright)

#### Scenario: Supabase RLS misconfiguration returns zero rows silently

- GIVEN the `onboarding` table queried under the Supabase anon key
- WHEN a `select` is run against it in an environment known to have onboarding rows
- THEN the query MUST return a non-zero row count
- AND a zero-row result under these conditions MUST be treated as a configuration defect, not as
  proof the feature works — an empty card alone is not verification
- (Verification: manual — anon-key `select` against Supabase during apply/verify)

### Requirement: Behavior is identical across data sources

The system MUST show the same onboarding answers, empty state, and latest-submission behavior
whether `VITE_DATA_SOURCE` is `airtable` or `supabase`.

#### Scenario: Same student, both data sources

- GIVEN the same student and the same underlying onboarding data
- WHEN the app runs once with `VITE_DATA_SOURCE=airtable` and once with `VITE_DATA_SOURCE=supabase`
- THEN the six answers and the submission date shown are identical in both runs
- (Verification: npm test for adapter mapping parity; manual for end-to-end UI parity)

### Requirement: Instagram consent renders as a status badge

The system MUST render the Instagram consent answer as a `StatusBadge`, and MUST render an
unmapped consent value with legible text in the badge's muted fallback color rather than a blank
or broken badge.

#### Scenario: Known consent value

- GIVEN a submission with a recognized Instagram consent value
- WHEN the card renders
- THEN the badge shows that value's text in its mapped color
- (Verification: manual/Playwright)

#### Scenario: Unmapped consent value

- GIVEN a submission with a consent value absent from the color mapping
- WHEN the card renders
- THEN the badge still shows the value's text, in the muted fallback color, never blank
- (Verification: manual/Playwright)

### Requirement: Onboarding strings exist in both supported languages

Every new user-facing string introduced for onboarding data, including the empty state, MUST exist
with a matching key in both `es.json` and `en.json`.

#### Scenario: Key parity check

- GIVEN the new i18n keys added under `alumnos.*` for this feature
- WHEN each key is looked up in `es.json` and in `en.json`
- THEN both files define a translated value for that key
- (Verification: manual review — no automated i18n parity check exists in this project)

## Non-Requirements

- Writing or editing onboarding answers from the dashboard (read-only; Airtable is system of record).
- A dedicated Onboarding tab, list of all submissions, or export.
- Aggregate/cross-student views (e.g., t-shirt size tally for an edition).
