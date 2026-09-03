# Design — add-onboarding-form-data

Status: `done`
Date: 2026-09-03
Artifact store: `openspec`
Inputs: `proposal.md` (authoritative decisions), `explore.md` (verified findings)

## 1. Architecture approach

This is a **read-only vertical slice through the existing layered architecture**. No new layer, no
new pattern, no new dependency. Every piece has a sibling in the repo that it copies structurally:

| Layer | New artifact | Structural sibling |
| --- | --- | --- |
| Types | `Onboarding` | `Historial`, `Pago` (`src/types/index.ts`) |
| Adapter (Airtable) | `OnboardingAdapter.ts` | `airtable/HistorialAdapter.ts` |
| Adapter (Supabase) | `OnboardingAdapter.ts` | `supabase/HistorialAdapter.ts` |
| Adapter barrel | 1 re-export | `fetchHistorial` (`data/adapters/index.ts:101`) |
| Persistence | `onboarding` table | `inscripciones` (`schema.sql:468`) |
| Migrator | 4 additions | `historial` entry (`migrate_airtable_data.py`) |
| Hook | `onboardingQuery` | `useAlumnoDetail.ts` existing queries |
| UI | 1 card + 1 link + 1 badge case | `.saveBar`, `StatusBadge` cases |

The only *architectural* decision in this change is where the per-student filter and the cache
boundary sit. Everything else is mechanical replication. That decision is D-A1 below.

## 2. Component map and data flow

```
                       ┌──────────────────────────────────────────┐
 Airtable              │  AlumnoDetail.tsx  (Info tab, 3rd card)   │
 tblyBkdLq0Ja06CH6     │  Pagos.tsx         (<Link> in name cell)  │
        │              └───────────────▲──────────────────────────┘
        │                              │ onboarding: Onboarding | undefined
        │              ┌───────────────┴──────────────────────────┐
        │              │  useAlumnoDetail(id)                     │
        │              │  useQuery({ queryKey: ['onboarding'] })  │  ← GLOBAL key
        │              │  → filter by alumnoId (client-side)      │
        │              │  → pick latest by submittedAt            │
        │              └───────────────▲──────────────────────────┘
        │                              │ Onboarding[]  (whole table)
        │              ┌───────────────┴──────────────────────────┐
        │              │  data/adapters/index.ts                  │
        │              │  fetchOnboarding(...)                    │
        │              └───────▲──────────────────▲───────────────┘
        │           VITE_DATA_SOURCE=airtable  =supabase
        │                      │                  │
        └──────────────► airtable/Onboarding   supabase/Onboarding ──► Supabase
                         Adapter.ts             Adapter.ts             `onboarding`
                         listRecords()          supabase.from().select()

 Migration path (offline, one-way):
   Airtable tblyBkdLq0Ja06CH6 ──► migrate_airtable_data.py ──► Supabase `onboarding`
```

**Integration points (all pre-existing, none created):**

1. `listRecords<T>(tableId, options)` — `airtable/AirtableClient.ts:146`. Auto-paginates via
   `offset`, slices `maxRecords` only after accumulating pages, FIFO rate limiter 210 ms.
2. `supabase` client — `supabase/SupabaseClient.ts`. **Anon key**, never service-role.
3. `getAdapters()` singleton + `VITE_DATA_SOURCE` switch — `data/adapters/index.ts:19-53`.
4. React Query cache — one `QueryClient` for the app; the `['onboarding']` key is new and
   collides with nothing.
5. `StatusBadge` — `components/shared/StatusBadge.tsx`, extended by one `case`.
6. Route `/admin/alumnos/:id` — already registered; `Pagos.tsx` only needs `<Link>`.

## 3. ADR-style decisions

### D-A1 — The per-student filter lives in the hook, over a globally-cached full table

**Decision.** `fetchOnboarding()` fetches the whole table. The React Query key is the constant
`['onboarding']`. `useAlumnoDetail` filters the cached array by `alumnoId` client-side and reduces
to the latest submission.

**Why.** `HistorialAdapter.ts:45` records the governing Airtable gotcha: `FIND({Alumno})` resolves
to *display names*, not record IDs, so a server-side per-student filter is impossible. The fetch is
therefore always full-table. Given that, a per-student query key (`['onboarding', { alumnoId }]`)
would produce a cache miss — and a full-table refetch — on **every student the admin opens**. A
global key fetches once per session. This is exactly the shape `AlumnoDetail.tsx:54` already uses
with `fetchAlumnos()` for the pareja dropdown.

**Rejected — per-student query key.** Reads more naturally and mirrors `['historial', {alumnoId}]`,
but those siblings are lazy-gated behind `visitedTabs`; the onboarding card is on the always-visited
Info tab (`useAlumnoDetail.ts:21` seeds `new Set(['info'])`), so it fires on every student. N students
opened = N full-table fetches. Rejected on cost.

**Rejected — filtering inside the adapter only.** `fetchOnboarding({ alumnoId })` does support the
option (for parity with every sibling adapter and for direct/test use), but the *hook* must not pass
it, because passing it would force a per-student key. The option exists; the hook does not use it.

**Consequence for apply.** The `['onboarding']` key is load-bearing. Do not "optimise" it into a
per-student key. The success criterion "switching a student does not refetch" tests exactly this.

### D-A2 — `fetchOnboarding` never passes `maxRecords` when filtering by student

Same root cause. `listRecords` applies `maxRecords` to the *accumulated* pages before any client-side
filter runs, so a `maxRecords` cap would silently drop the target student's submission. The adapter
follows `HistorialAdapter.ts:50`: `maxRecords` is only honoured when there is no `alumnoId`.

### D-A3 — Latest-submission selection happens in the hook, not the adapter

The adapter returns **all** submissions (`Onboarding[]`), sorted newest-first. The "show the latest"
rule (proposal D6) is a presentation decision and lives in the hook's `select`/`useMemo`. Rationale:
the adapter stays a faithful mirror of the table, so a future "list all submissions" card needs no
adapter change, and the adapter test can assert ordering independently of the UI rule.

### D-A4 — `respuestas_formulario` is created but **not populated by the migrator** in this change

The column exists in `schema.sql` for structural parity with `inscripciones` and forward-compat.
Populating it requires a *new* mechanism in `migrate_airtable_data.py`: `map_record()`
(line 735) keeps only fields present in both `FIELD_MAP` and `TABLE_COLUMNS[table]` and drops
everything else — there is no "collect the remainder into JSONB" hook anywhere in the migrator, and
`inscripciones` does not have one either (it is orphaned entirely). Building one means a new
`ColSpec` kind or a per-table rest-collector plus its own validation and dry-run coverage.

**Decision:** out of scope here. The migrator populates the six structured columns + `timestamp_form`
+ `alumno_id`; `respuestas_formulario` stays `NULL`. This is a *stated limitation*, not an oversight:
nothing in the UI reads it, and Airtable remains the system of record. Logged as follow-up
*"Add a JSONB rest-collector to the Airtable→Supabase migrator (`respuestas_formulario`)"*.

**Rejected — drop the column.** It would diverge from the `inscripciones` shape the proposal (D4)
explicitly adopted, and re-adding it later is a second migration on a live table.

### D-A5 — `FIELD_MAP` collision on `"Alumnos"` — a per-table override is required

**Discovered during design; this is a blocker the proposal did not know about.**

`FIELD_MAP` in `migrate_airtable_data.py:84` is a **single global dict** (Airtable field name →
column), applied to every table by `map_record()` (line 758):

```python
col = FIELD_MAP.get(at_field)
if col is None or col not in columns:
    continue
```

Line 201 already binds `"Alumnos": "alumnos_ids"` — that is the `envios_emails` recipient list
(`UUID[]`). The Onboarding table's link field is *also* literally named `Alumnos`, but it must land
in `onboarding.alumno_id` (a single `UUID` FK). A global dict cannot express both.

If nothing is done, the failure is **silent**: `FIELD_MAP["Alumnos"]` returns `alumnos_ids`,
`alumnos_ids` is not in `TABLE_COLUMNS["onboarding"]`, the `continue` fires, and every onboarding row
loads with `alumno_id = NULL`. That is precisely the orphan class this change exists to avoid, one
layer deeper.

**Decision.** Add a per-table override consulted *before* the global map:

```python
# Per-table overrides for Airtable field names whose global FIELD_MAP binding
# belongs to a DIFFERENT table. "Alumnos" is a UUID[] recipient list on
# envios_emails but a single-row FK on onboarding; a global dict cannot hold both.
TABLE_FIELD_OVERRIDES: dict[str, dict[str, str]] = {
    "onboarding": {"Alumnos": "alumno_id"},
}
```

and in `map_record`, replace the lookup with:

```python
overrides = TABLE_FIELD_OVERRIDES.get(table, {})
for at_field, value in raw_fields.items():
    col = overrides.get(at_field) or FIELD_MAP.get(at_field)
    if col is None or col not in columns:
        continue
```

Net cost: 5 declaration lines + 2 changed lines in `map_record`. Behaviour for every existing table
is byte-identical, because `TABLE_FIELD_OVERRIDES` is empty for all of them.

**Rejected — rename the column to `alumnos_ids` in `onboarding`.** It would make the FK a `UUID[]`,
break `REFERENCES alumnos(id)`, and make the Supabase adapter's join impossible.

**Rejected — a second global entry.** Python dicts cannot hold a duplicate key; the later entry
would silently overwrite the earlier one and break `envios_emails`.

**Verification for apply:** after the migrator run, assert
`SELECT count(*) FROM onboarding WHERE alumno_id IS NULL` is 0 for rows whose Airtable `Alumnos`
link was non-empty. A non-zero count means the override did not take effect.

## 4. Types and constants

### 4.1 `src/types/index.ts` — append after the `Historial` interface

```ts
/** Onboarding (form) — event-logistics answers submitted by the alumno. Read-only. */
export interface Onboarding extends BaseRecord {
  alumnoId: string;
  alumnoNombre?: string;
  tshirtSize?: string;
  tshirtKind?: string;
  tshirtName?: string;
  welcomeBookLanguage?: string;
  instagramConsent?: string;
  instagramUsername?: string;
  /** Airtable `Timestamp` (createdTime) / Supabase `timestamp_form`. */
  submittedAt?: string;
}
```

`BaseRecord` is `{ id: string; createdTime?: string }` (`src/types/index.ts:67-70`). `alumnoId` is
required (`''` when the link is empty) so callers never need a null check before comparing; all six
answers are optional because any single-select may be left blank.

### 4.2 `src/utils/constants.ts` — three additions

**(a)** One line in `AIRTABLE_TABLES` (after `INBOX`, line 89):

```ts
  ONBOARDING: 'tblyBkdLq0Ja06CH6',
```

**(b)** A new `ONBOARDING_FIELDS` map, placed immediately after `AIRTABLE_TABLES`:

```ts
/**
 * Airtable field names for the Onboarding (form) table, VERBATIM.
 *
 * `KIND` and `WELCOME_BOOK_LANGUAGE` are misspelled upstream ("Kind os T-Shirt?",
 * "Languaje on the Welcome book?"). The production PAT has no `schema:write`, so
 * these names cannot be corrected — do NOT "fix" the typos, the API matches on the
 * literal string and a correction silently returns undefined for that field.
 */
export const ONBOARDING_FIELDS = {
  TSHIRT_SIZE: 'T-Shirt Size?',
  TSHIRT_KIND: 'Kind os T-Shirt?',
  TSHIRT_NAME: 'Name on the T-Shirt',
  WELCOME_BOOK_LANGUAGE: 'Languaje on the Welcome book?',
  INSTAGRAM_CONSENT:
    'Do you give us permission to use your Instagram account in future posts related to the course content?',
  INSTAGRAM_USERNAME: 'Instagram username: (only if you selected "Yes")',
  TIMESTAMP: 'Timestamp',
  ALUMNOS: 'Alumnos',
} as const;
```

> **Apply-phase note.** `INSTAGRAM_CONSENT` is the one literal `explore.md` recorded truncated
> (the source line ends in `…`). Before writing the adapter, re-read the full field name from the
> Airtable schema (MCP `get_table_schema` on base `app4ZpoxaWOyV4RnR`, table `tblyBkdLq0Ja06CH6`)
> and paste it exactly. If the trailing text differs, only this one constant changes — nothing else
> in the design depends on it. A wrong literal yields `undefined` for that field and a card that
> renders the consent row as `—`, with no error.

**(c)** `CONSENT_COLORS` — see §11.

## 5. Airtable adapter — `src/data/adapters/airtable/OnboardingAdapter.ts` (new)

```ts
/**
 * Adaptador Airtable para la tabla Onboarding (form). Read-only.
 */

import { Onboarding } from '@/types';
import { AIRTABLE_TABLES, ONBOARDING_FIELDS as F } from '@/utils/constants';
import { listRecords, AirtableRecord } from './AirtableClient';

/**
 * Upstream field names, verbatim. Two are misspelled at the source
 * ("Kind os T-Shirt?", "Languaje on the Welcome book?") and cannot be fixed:
 * the production PAT has no `schema:write`.
 */
interface AirtableOnboardingFields {
  'T-Shirt Size?'?: string;
  'Kind os T-Shirt?'?: string;
  'Name on the T-Shirt'?: string;
  'Languaje on the Welcome book?'?: string;
  'Do you give us permission to use your Instagram account in future posts related to the course content?'?: string;
  'Instagram username: (only if you selected "Yes")'?: string;
  'Timestamp'?: string;
  'Alumnos'?: string[];
  /** Lookup — returns an array. Not mapped; derivable by joining Alumnos. */
  'Email (from Alumnos)'?: string[];
}

function mapToOnboarding(record: AirtableRecord<AirtableOnboardingFields>): Onboarding {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    // Empty link array -> '' so this record can never match a real alumno id.
    alumnoId: f[F.ALUMNOS]?.[0] || '',
    alumnoNombre: undefined,
    tshirtSize: f[F.TSHIRT_SIZE],
    tshirtKind: f[F.TSHIRT_KIND],
    tshirtName: f[F.TSHIRT_NAME],
    welcomeBookLanguage: f[F.WELCOME_BOOK_LANGUAGE],
    instagramConsent: f[F.INSTAGRAM_CONSENT],
    instagramUsername: f[F.INSTAGRAM_USERNAME],
    submittedAt: f[F.TIMESTAMP] || record.createdTime,
  };
}

export async function fetchOnboarding(options?: {
  alumnoId?: string;
}): Promise<Onboarding[]> {
  // alumnoId is filtered CLIENT-SIDE: FIND({Alumnos}) resolves display names,
  // not record IDs (see HistorialAdapter.ts:45). For the same reason no
  // maxRecords is passed — listRecords slices before this filter would run.
  const records = await listRecords<AirtableOnboardingFields>(AIRTABLE_TABLES.ONBOARDING, {});

  const rows = records
    .map(mapToOnboarding)
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  return options?.alumnoId
    ? rows.filter(o => o.alumnoId === options.alumnoId)
    : rows;
}
```

**Design points, each deliberate:**

1. **`F.X` indexing over raw string literals.** The interface keys must be literal (TypeScript needs
   them at type level), but the *runtime* reads go through `ONBOARDING_FIELDS`, so the typo strings
   exist in exactly one editable place. `as const` makes `F.TSHIRT_SIZE` a literal type, so
   `f[F.TSHIRT_SIZE]` type-checks against the interface.
2. **No `sort` option passed to `listRecords`.** Ordering is done client-side on `submittedAt`.
   Passing `sort[0][field]=Timestamp` would add a second dependency on an upstream field name that
   could 422 the whole request; client-side sorting cannot fail. The rows are already all in memory.
3. **Descending ISO-8601 `localeCompare`.** `Timestamp` is a `createdTime` field, so it is always a
   full ISO-8601 UTC string — lexicographic order equals chronological order. Records with no
   timestamp sort last (`''` compares lowest), which is the correct "least authoritative" position.
4. **`submittedAt` falls back to `record.createdTime`.** Belt-and-braces: if the `Timestamp` literal
   is ever wrong, the tie-break still has a real date to work with instead of collapsing to `''`.
5. **No `fetchAlumnoNombresByIds` enrichment.** `HistorialAdapter` needs it because the Historial
   list is rendered outside a student context. The onboarding card renders *inside*
   `AlumnoDetail`, where the name is already on screen. Skipping it avoids an extra Airtable
   round-trip per session. `alumnoNombre` is declared for interface parity and left `undefined`.
6. **`Email (from Alumnos)` is declared but not mapped** — proposal D4. Declaring it documents that
   the field exists and that its array shape was considered.

## 6. Supabase adapter — `src/data/adapters/supabase/OnboardingAdapter.ts` (new)

```ts
/**
 * Adaptador Supabase para la tabla onboarding. Read-only.
 */

import { Onboarding } from '@/types';
import { supabase } from './SupabaseClient';

function mapToOnboarding(row: Record<string, unknown>): Onboarding {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    alumnoId: (row.alumno_id as string) || '',
    alumnoNombre: row.alumno_nombre as string | undefined,
    tshirtSize: row.tshirt_size as string | undefined,
    tshirtKind: row.tshirt_kind as string | undefined,
    tshirtName: row.tshirt_name as string | undefined,
    welcomeBookLanguage: row.welcome_book_language as string | undefined,
    instagramConsent: row.instagram_consent as string | undefined,
    instagramUsername: row.instagram_username as string | undefined,
    submittedAt: (row.timestamp_form as string | undefined) ?? (row.created_at as string | undefined),
  };
}

export async function fetchOnboarding(options?: {
  alumnoId?: string;
}): Promise<Onboarding[]> {
  let query = supabase
    .from('onboarding')
    .select(`
      *,
      alumnos ( nombre )
    `)
    .order('timestamp_form', { ascending: false, nullsFirst: false });

  // Supabase CAN filter server-side (alumno_id is a real UUID FK, unlike the
  // Airtable link). Kept behind the same option so both adapters are drop-in
  // interchangeable; the hook does not pass it (see design D-A1).
  if (options?.alumnoId) {
    query = query.eq('alumno_id', options.alumnoId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchOnboarding: ${error.message}`);

  return (data || []).map((row: Record<string, unknown>) => {
    const alumno = row.alumnos as Record<string, unknown> | null;
    return mapToOnboarding({ ...row, alumno_nombre: alumno?.nombre });
  });
}
```

Mirrors `supabase/HistorialAdapter.ts` line for line, minus the `.limit()` (D-A2: no truncation) and
plus `nullsFirst: false` so rows without a `timestamp_form` sort last, matching the Airtable
adapter's ordering exactly. The embedded `alumnos ( nombre )` join is the same PostgREST idiom
already used at `HistorialAdapter.ts:30-33`; it requires no extra GRANT beyond `alumnos`, which
already has one.

### 6.1 Barrel — `src/data/adapters/index.ts`

Three mechanical edits, matching the existing shape exactly:

1. Add `import('./supabase/OnboardingAdapter')` to the Supabase `Promise.all` array and `onboarding`
   to its destructuring + returned object (lines 21-32).
2. Add `import('./airtable/OnboardingAdapter')` to the Airtable `Promise.all` array and the same
   two spots (lines 34-45).
3. Append the re-export after the `--- Historial ---` block:

```ts
// --- Onboarding (form) ---
export async function fetchOnboarding(...args: Parameters<typeof import('./airtable/OnboardingAdapter').fetchOnboarding>) {
  return (await getAdapters()).onboarding.fetchOnboarding(...args);
}
```

The `Parameters<typeof import('./airtable/...')>` idiom is the file's convention: the Airtable
adapter is the type source and the Supabase adapter must remain structurally assignable to it.
Because both `fetchOnboarding` signatures are identical, this compiles without a cast.

## 7. SQL

### 7.1 `supabase/schema.sql` — table block

Insert as a new section **4c**, immediately after the `inscripciones` indexes (after line 486) and
before `-- 5. VIEWS`:

```sql
-- ============================================================
-- 4c. ONBOARDING (form-intake; Onboarding form tblyBkdLq0Ja06CH6)
-- ============================================================
-- Source: Airtable onboarding form. Structured columns are the six answers the
-- dashboard renders on the alumno detail page; anything else the form carries
-- now or grows later belongs in respuestas_formulario JSONB (key = the upstream
-- label). Airtable field names are misspelled at the source ("Kind os T-Shirt?",
-- "Languaje on the Welcome book?") and are consumed verbatim; the column names
-- here are the corrected snake_case forms.
-- Read-only from the dashboard: no audit trigger (mirrors inscripciones).
CREATE TABLE IF NOT EXISTS onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE,
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,   -- Airtable "Alumnos" link
  tshirt_size TEXT,                                           -- "T-Shirt Size?"
  tshirt_kind TEXT,                                           -- "Kind os T-Shirt?" [sic]
  tshirt_name TEXT,                                           -- "Name on the T-Shirt"
  welcome_book_language TEXT,                                 -- "Languaje on the Welcome book?" [sic]
  instagram_consent TEXT,                                     -- "Do you give us permission to use your Instagram account...?"
  instagram_username TEXT,                                    -- "Instagram username: (only if you selected "Yes")"
  timestamp_form TIMESTAMPTZ,                                 -- Airtable "Timestamp"
  respuestas_formulario JSONB,                                -- all remaining form fields (key=label)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_timestamp ON onboarding(timestamp_form DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_alumno ON onboarding(alumno_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_airtable ON onboarding(airtable_id);
```

Notes: no `TEXT[]` column — all six answers are scalars (four `singleSelect`, two `multilineText`).
No enum types: the single-select choice values are not verified (see §11), and an enum would make an
unmapped upstream choice a **hard load failure**, whereas `TEXT` degrades to a grey badge.
`ON DELETE SET NULL` matches `inscripciones` and keeps `onboarding` off the CASCADE list the
migrator's prune guard consults (`migrate_airtable_data.py:504`) — deleting an alumno must not
silently destroy their submission.

### 7.2 `supabase/schema.sql` — RLS (section 7). All three lines, or the table reads as empty.

Three separate insertions, each next to its `inscripciones` sibling:

```sql
-- after line 603
ALTER TABLE onboarding ENABLE ROW LEVEL SECURITY;

-- after line 619
CREATE POLICY "Allow all for anon" ON onboarding FOR ALL TO anon USING (true) WITH CHECK (true);

-- after line 622
GRANT SELECT ON onboarding TO anon, authenticated, service_role;
```

**Why this is the highest-severity item in the change.** `SupabaseClient.ts` uses the **anon key**.
With RLS enabled and no policy, or with a policy but no `GRANT`, `select()` returns `[]` and
`error === null`. The adapter throws nothing, the hook resolves to an empty array, and the card
renders the `sinOnboarding` empty state — indistinguishable from "this student never submitted".
There is no log line, no console error, no failing test. The three statements land together or the
Supabase path is silently dead.

**Verification (mandatory, not optional):** with `VITE_DATA_SOURCE=supabase`, run a `select` under
the anon key and assert a **non-zero** row count. An empty card is not evidence of correctness.

### 7.3 `supabase/MIGRACION-ONBOARDING-2026-09-03.sql` (new)

The shadow DB is already provisioned, so `schema.sql` (a clean-install script that is never
re-executed) will not reach it. This standalone file carries the same DDL, fully idempotent, and is
the artifact actually applied.

```sql
-- ============================================================
-- MIGRACION-ONBOARDING-2026-09-03
-- Adds the `onboarding` table (Airtable "Onboarding (form)" tblyBkdLq0Ja06CH6).
--
-- Idempotent: safe to re-run. Mirrors dashboard/supabase/schema.sql section 4c
-- plus its three RLS statements from section 7. Apply to the shadow DB; schema.sql
-- is a clean-install script and is never re-executed against a provisioned DB.
-- ============================================================

CREATE TABLE IF NOT EXISTS onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE,
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,
  tshirt_size TEXT,
  tshirt_kind TEXT,
  tshirt_name TEXT,
  welcome_book_language TEXT,
  instagram_consent TEXT,
  instagram_username TEXT,
  timestamp_form TIMESTAMPTZ,
  respuestas_formulario JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_timestamp ON onboarding(timestamp_form DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_alumno ON onboarding(alumno_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_airtable ON onboarding(airtable_id);

-- RLS: all three statements are required. Without the policy OR without the
-- GRANT, select() under the anon key returns ZERO ROWS with error === null.
ALTER TABLE onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON onboarding;
CREATE POLICY "Allow all for anon" ON onboarding FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT SELECT ON onboarding TO anon, authenticated, service_role;

-- Verification (must return > 0 after a migrator run):
--   SELECT count(*) FROM onboarding;
--   SELECT count(*) FROM onboarding WHERE alumno_id IS NULL;  -- see design D-A5
```

`CREATE POLICY` has no `IF NOT EXISTS` in PostgreSQL, hence the `DROP POLICY IF EXISTS` guard — that
is what makes the file re-runnable. `GRANT` is naturally idempotent.

**Three-place rule.** Per the project's schema convention, a schema change touches `schema.sql`
(clean install), a `MIGRACION-*.sql` (the provisioned shadow DB) **and** the migrator. All three are
in this change; §8 is the third.

## 8. Migrator — `supabase/migrate_airtable_data.py`

Five additions. The first four are the documented triple plus the field map; the fifth is the
collision fix from D-A5. Omitting **any** of them produces an orphaned table — the exact failure
`inscripciones` exhibits today.

### 8.1 `AIRTABLE_TABLES` (line 210-220) — append one entry

```python
    "inbox": "tblyp8NSzdpnTqkPD",
    "onboarding": "tblyBkdLq0Ja06CH6",
}
```

### 8.2 `FIELD_MAP` (line 84-202) — append a new comment block at the end

```python
    # Onboarding (form) — upstream names are misspelled ("Kind os T-Shirt?",
    # "Languaje on the Welcome book?") and must stay verbatim: the PAT has no
    # schema:write. NOTE "Alumnos" is deliberately absent here — it is already
    # bound to envios_emails.alumnos_ids above and is resolved for this table
    # via TABLE_FIELD_OVERRIDES (see 8.5).
    "T-Shirt Size?": "tshirt_size",
    "Kind os T-Shirt?": "tshirt_kind",
    "Name on the T-Shirt": "tshirt_name",
    "Languaje on the Welcome book?": "welcome_book_language",
    "Do you give us permission to use your Instagram account in future posts related to the course content?": "instagram_consent",
    'Instagram username: (only if you selected "Yes")': "instagram_username",
    "Timestamp": "timestamp_form",
}
```

`"Timestamp"` is not currently a `FIELD_MAP` key and `timestamp_form` is not a column of any table in
`TABLE_COLUMNS`, so this global entry is collision-free. (`inscripciones` also has a
`timestamp_form`, but it is absent from `TABLE_COLUMNS` entirely and therefore unaffected.)
The `instagram_username` key uses single quotes because the literal contains double quotes.

### 8.3 `TABLE_COLUMNS` (line 308-458) — append after the `"historial"` block

```python
    "onboarding": {
        "alumno_id": ColSpec(kind="uuid", fk="alumnos"),
        "tshirt_size": ColSpec(kind="text"),
        "tshirt_kind": ColSpec(kind="text"),
        "tshirt_name": ColSpec(kind="text"),
        "welcome_book_language": ColSpec(kind="text"),
        "instagram_consent": ColSpec(kind="text"),
        "instagram_username": ColSpec(kind="text"),
        "timestamp_form": ColSpec(kind="timestamptz"),
    },
```

No `enum=` on any column: the upstream single-select choices are unverified, and a wrong enum entry
would fail the whole row (see §7.1). No `not_null`. `respuestas_formulario` is deliberately absent
(D-A4). `fk="alumnos"` makes the loader resolve the Airtable record id through the `alumnos` recId
map and flag an unresolved link as a failure rather than silently nulling it.

### 8.4 `LOAD_ORDER` (line 463-473) — FK-safe position

```python
LOAD_ORDER: list[str] = [
    "ediciones",
    "modulos",
    "alumnos",
    "revisiones_video",
    "pagos",
    "envios_emails",
    "cola_emails",
    "inbox",
    "historial",
    "onboarding",
]
```

`onboarding` must come **after** `alumnos` because `alumno_id` is an FK resolved from the `alumnos`
recId map built during that table's load. Last position is correct and safe — nothing references
`onboarding`, so it has no children to precede.

### 8.5 `TABLE_FIELD_OVERRIDES` + `map_record` — the `"Alumnos"` collision fix

Full rationale in **D-A5**. Add the constant next to `FIELD_MAP` and change two lines inside
`map_record` (line 755-760). Every existing table keeps byte-identical behaviour because its
override dict is empty.

### 8.6 Prune-safety review (no change required, but stated so apply does not guess)

- `PRUNE_KNOWN_EMPTY_ALLOWLIST` (line 480): **not** extended. The onboarding table has real rows; an
  empty fetch there is a transient failure and must block a prune, which is the default behaviour.
- CASCADE map (line 504): **not** extended. `onboarding.alumno_id` is `ON DELETE SET NULL`, so
  deleting an alumno cannot cascade-delete a submission.
- `PRUNE_MIN_FETCH_RATIO` / `PRUNE_FLOOR_MIN_ROWS`: no change; the generic guards apply as-is.

## 9. UI wiring — `src/hooks/useAlumnoDetail.ts`

```ts
import { fetchOnboarding } from '@/data/adapters';   // add to the existing import block
```

```ts
  // Onboarding (form) answers. GLOBAL query key on purpose: the Airtable adapter
  // can only filter by alumno CLIENT-SIDE, so every fetch is full-table. A
  // per-student key would refetch the whole table for each alumno opened. Same
  // pattern as fetchAlumnos() at AlumnoDetail.tsx:54.
  // No visitedTabs gate: the card lives on the Info tab, which is seeded as
  // visited at line 21, so a gate on 'info' would be inert.
  const onboardingQuery = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => fetchOnboarding(),
    staleTime: 5 * 60 * 1000,
  });

  // Latest submission for this alumno. The adapter already returns rows sorted
  // newest-first, so the first match is the operative answer (proposal D6).
  const onboarding = useMemo(
    () => (id ? onboardingQuery.data?.find(o => o.alumnoId === id) : undefined),
    [onboardingQuery.data, id],
  );
  const onboardingLoading = onboardingQuery.isLoading;
```

Return additions: `onboarding`, `onboardingLoading`.

**Details that matter:**

- `useMemo` needs adding to the `react` import (line 9 currently imports `useState, useCallback`).
- `staleTime: 5 * 60 * 1000` — the app default is `2 * 60 * 1000` (`main.tsx:10`); reference data
  that changes rarely uses 5 minutes (`EdicionContext.tsx:33`, the `['ediciones']` query). An
  onboarding form submission is exactly that kind of data, and the query is fetched once for the
  whole session, so the longer window is both consistent and cheaper.
- **No `enabled` clause.** Deliberate: the query is not per-student, so gating it on `!!id` would
  needlessly serialise it behind the route param. `id` is only used in the `useMemo`, which returns
  `undefined` when `id` is falsy.
- **Errors are not surfaced.** `onboardingQuery.data` is `undefined` on error, `onboarding` resolves
  to `undefined`, and the card renders the empty state (proposal D7). A dropped Supabase GRANT or a
  network failure degrades to an empty card, never a crash. `isError` is intentionally **not**
  returned — adding it would invite an error banner this card does not want.

## 10. The card — `src/pages/admin/AlumnoDetail.tsx`

**Placement.** Inside the Info tab fragment, **after** the closing `</div>` of `.infoGrid`
(line 390) and **before** the `hasChanges &&` save bar (line 393). It is a sibling of the grid, not
a third child of it.

**Wait — that is the one thing to get right.** `.infoGrid` is
`grid-template-columns: 1fr 1fr` **fixed** (`AlumnoDetail.module.css:177-181`), not `auto-fit`.
Two options, and the design picks the second:

- *Sibling of `.infoGrid`*: renders full-width automatically, but sits outside the grid's
  `gap: var(--space-lg)`, so the vertical rhythm has to be restated inline.
- *Third child of `.infoGrid` with `style={{ gridColumn: '1 / -1' }}`*: **chosen.** It inherits the
  grid gap, spans both columns, and collapses correctly with the grid at `max-width: 800px`
  (line 241-243). The precedent is `.saveBar`, which already sets `grid-column: 1 / -1`
  (`AlumnoDetail.module.css:56`). **No new CSS class.**

So: insert as the **third child inside** `.infoGrid`, after the notas-internas card closes
(after line 389, before line 390's `</div>`):

```tsx
            {/* Onboarding (form) — full-width third card. .infoGrid is a fixed
                1fr 1fr, so it must span both columns; same trick as .saveBar. */}
            <div className="card" style={{ padding: 'var(--space-lg)', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                <h3>{t('alumnos.onboarding')}</h3>
                {onboarding?.submittedAt && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {t('alumnos.onboardingEnviado')}: {formatDate(onboarding.submittedAt)}
                  </span>
                )}
              </div>
              {onboardingLoading ? (
                <SkeletonBlock width="100%" height="72px" />
              ) : !onboarding ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  {t('alumnos.sinOnboarding')}
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
                  <div className={styles.field}>
                    <label>{t('alumnos.tallaCamiseta')}</label>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{onboarding.tshirtSize || '—'}</span>
                  </div>
                  <div className={styles.field}>
                    <label>{t('alumnos.tipoCamiseta')}</label>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{onboarding.tshirtKind || '—'}</span>
                  </div>
                  <div className={styles.field}>
                    <label>{t('alumnos.nombreCamiseta')}</label>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{onboarding.tshirtName || '—'}</span>
                  </div>
                  <div className={styles.field}>
                    <label>{t('alumnos.idiomaLibro')}</label>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{onboarding.welcomeBookLanguage || '—'}</span>
                  </div>
                  <div className={styles.field}>
                    <label>{t('alumnos.consentimientoInstagram')}</label>
                    {onboarding.instagramConsent
                      ? <StatusBadge status={onboarding.instagramConsent} type="consent" />
                      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </div>
                  <div className={styles.field}>
                    <label>{t('alumnos.usuarioInstagram')}</label>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{onboarding.instagramUsername || '—'}</span>
                  </div>
                </div>
              )}
            </div>
```

- Reuses `styles.field` (`AlumnoDetail.module.css:183+` sibling of `.fieldGroup`) and the `.card`
  global class — the exact idiom of the two existing cards. No new CSS.
- The inner `auto-fit` grid is a plain inline style, matching how the file already does one-off
  layout (e.g. line 447). It is inside the card, so it does not touch `.infoGrid`'s fixed columns.
- `SkeletonBlock`, `StatusBadge`, `formatDate` and `styles` are **already imported** at lines 10-19.
  The only new imports are the two hook return values, destructured from `useAlumnoDetail`.
- The submission date is rendered per proposal D6 — it is what makes "latest submission only"
  honest rather than silent.

## 11. `StatusBadge` consent case + `CONSENT_COLORS`

### 11.1 `src/components/shared/StatusBadge.tsx` — two edits

```ts
// line 2 — extend the existing import
import { ..., ENVIO_ESTADO_COLORS, CONSENT_COLORS } from '@/utils/constants';

// line 6 — extend the union (currently exactly 7 members)
type StatusType = 'estado' | 'revision' | 'pago' | 'email' | 'origin' | 'edicion' | 'envio' | 'consent';

// inside getStatusColor, after the 'envio' case (line 29)
    case 'consent': return CONSENT_COLORS[status.trim().toLowerCase()] || 'var(--color-text-muted)';
```

Note the `.trim().toLowerCase()` — the only case in the switch that normalises the key. §11.2 says
why. The badge still renders `{status}` **verbatim** (line 49), so the user sees the exact Airtable
choice label; normalisation affects colour lookup only.

### 11.2 `CONSENT_COLORS` — designed for *unverified* choice labels

**This closes the proposal's open item.** Proposal question 5 flagged that the exact Instagram-consent
single-select labels were never read from the Airtable schema. They still have not been — this
executor has no Airtable access. So the map is built to be **correct without knowing them**:

```ts
/**
 * Colores de consentimiento (Onboarding — permiso Instagram).
 *
 * The upstream single-select choice labels are NOT verified: the PAT has no
 * schema:write and the exact choices were never read from the Airtable schema.
 * Keys are therefore NORMALISED (trimmed + lowercased) and cover the plausible
 * affirmative/negative wordings in both languages. StatusBadge looks up
 * `status.trim().toLowerCase()` and falls back to var(--color-text-muted), so an
 * unmapped label still renders with the CORRECT TEXT in grey — never blank,
 * never a crash. Add keys here as real values are observed; nothing else changes.
 */
export const CONSENT_COLORS: Record<string, string> = {
  // affirmative
  'yes': 'var(--color-accent-success)',
  'si': 'var(--color-accent-success)',
  'sí': 'var(--color-accent-success)',
  // negative
  'no': 'var(--color-accent-danger)',
  // conditional / deferred
  'maybe': 'var(--color-accent-warning)',
  'tal vez': 'var(--color-accent-warning)',
  'quizás': 'var(--color-accent-warning)',
};
```

**Why normalised keys rather than exact literals.** Every other colour map in `constants.ts`
(`ESTADO_COLORS`, `PAGO_COLORS`, …) keys on exact values, because those values are verified. Here
they are not: a label of `"Yes"`, `"yes"`, `"Yes "` or `"Sí"` would each miss an exact-match map and
render grey. Lowercasing the key collapses the casing/whitespace axis, which is the most likely
source of drift, at the cost of one `.toLowerCase()` call. `REVISION_COLORS` already sets the
precedent for defensive matching in this exact switch (it strips diacritics on a fallback pass,
`StatusBadge.tsx:17-24`) — this is the same instinct, applied more cheaply.

**Failure mode if the labels turn out to be something else entirely** (e.g. `"I agree"`,
`"Doy mi permiso"`): the badge renders that exact text in `var(--color-text-muted)`. Legible,
correct, unremarkable. That is an acceptable steady state, and adding the observed key later is a
one-line change with no other consequence. **No verification of these labels blocks this change.**

## 12. Pagos link — `src/pages/admin/Pagos.tsx`

```tsx
// line 5-6 area — new import
import { Link } from 'react-router-dom';
```

Replace the `alumnoNombre` column render (lines 59-61):

```tsx
    {
      key: 'alumnoNombre', header: t('alumnos.alumno'), width: '180px', sortable: true, minWidth: 120,
      render: (p) => p.alumnoId
        ? (
          <Link
            to={`/admin/alumnos/${p.alumnoId}`}
            style={{ fontWeight: 500, color: 'var(--color-accent-primary)', textDecoration: 'none' }}
          >
            {p.alumnoNombre || '—'}
          </Link>
        )
        : <span style={{ fontWeight: 500 }}>{p.alumnoNombre || '—'}</span>,
    },
```

- **The guard is `p.alumnoId`, not `p.alumnoNombre`.** A payment whose Airtable `Alumno` link is
  empty would otherwise produce `<Link to="/admin/alumnos/">`, which matches the `/admin/alumnos`
  list route and navigates the admin somewhere they did not ask to go. Falling back to the current
  plain `<span>` keeps that row exactly as it renders today.
- `Pagos.tsx` currently imports nothing from `react-router-dom` — this is a new import line. No
  other page in `src/pages` uses `<Link>` (they all use `useNavigate`), but `<Link>` is correct
  here: it produces a real anchor, so middle-click / open-in-new-tab / copy-link work in a table
  cell, which `onClick + navigate` does not.
- **No conflict with a row handler**: the `DataTable` at line 136-148 has no `onRowClick`, so the
  anchor is the only click target in the cell.
- `sortable: true` is preserved; sorting operates on the `alumnoNombre` field value, not the
  rendered node.

## 13. i18n — `src/i18n/es.json` and `en.json`

Nine keys, appended to the existing `alumnos.*` group (near `sinHistorial`, line 84 in both files),
in strict ES/EN parity:

| Key | ES | EN |
| --- | --- | --- |
| `alumnos.onboarding` | `Onboarding` | `Onboarding` |
| `alumnos.onboardingEnviado` | `Enviado` | `Submitted` |
| `alumnos.sinOnboarding` | `Sin datos de onboarding` | `No onboarding data` |
| `alumnos.tallaCamiseta` | `Talla de camiseta` | `T-shirt size` |
| `alumnos.tipoCamiseta` | `Tipo de camiseta` | `T-shirt kind` |
| `alumnos.nombreCamiseta` | `Nombre en la camiseta` | `Name on the t-shirt` |
| `alumnos.idiomaLibro` | `Idioma del libro de bienvenida` | `Welcome book language` |
| `alumnos.consentimientoInstagram` | `Permiso Instagram` | `Instagram permission` |
| `alumnos.usuarioInstagram` | `Usuario de Instagram` | `Instagram username` |

Only *labels* are translated. The answer **values** render verbatim from Airtable (English), which is
consistent with every other badge and select in the app.

## 14. Test design — `src/data/adapters/airtable/OnboardingAdapter.test.ts` (new)

`vitest.config.ts` runs `environment: 'node'` with `include: ['src/**/*.test.ts', 'api/**/*.test.ts']`
and no JSDOM, so this is an **adapter-level** test. React components are out of scope (proposal).
`npm test` = `vitest run`. Strict TDD: this file is written **before** the adapter.

### 14.1 Mocking — follow `EnviosEmailsAdapter.test.ts:9-18` exactly

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AirtableRecord } from './AirtableClient';

const listRecordsMock = vi.fn();

vi.mock('./AirtableClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./AirtableClient')>();
  return {
    ...actual,
    listRecords: (...args: unknown[]) => listRecordsMock(...args),
  };
});

import { fetchOnboarding } from './OnboardingAdapter';
```

Spreading `actual` keeps `AirtableRecord` and every un-mocked export intact — that is why the
sibling test uses this shape rather than a bare factory.

### 14.2 Fixture — the field keys ARE the assertion

```ts
function fakeRecord(id: string, fields: Record<string, unknown>): AirtableRecord<Record<string, unknown>> {
  return { id, createdTime: '2026-09-01T00:00:00.000Z', fields };
}

const FULL_SUBMISSION = {
  'T-Shirt Size?': 'L',
  'Kind os T-Shirt?': 'Fitted',
  'Name on the T-Shirt': 'Ana',
  'Languaje on the Welcome book?': 'Español',
  'Do you give us permission to use your Instagram account in future posts related to the course content?': 'Yes',
  'Instagram username: (only if you selected "Yes")': '@ana',
  'Timestamp': '2026-09-01T10:00:00.000Z',
  'Alumnos': ['recALU1'],
};
```

The fixture must use the **misspelled upstream literals**. That is the point: if someone "corrects"
`Kind os T-Shirt?` in `constants.ts`, this test fails. It is the only automated guard on those
strings.

### 14.3 Cases

| # | Case | Assertion |
| --- | --- | --- |
| 1 | **Mapping** — a full submission | All six answers land on the right `Onboarding` fields; `alumnoId === 'recALU1'`; `submittedAt === '2026-09-01T10:00:00.000Z'`; `id` from `record.id` |
| 2 | **Client-side alumno filter** — three records, two alumnos | `fetchOnboarding({ alumnoId: 'recALU1' })` returns only that alumno's rows, and `listRecordsMock` was called with **no** `filterByFormula` and **no** `maxRecords` (this is the D-A2 regression guard) |
| 3 | **Latest-by-Timestamp tie-break** — two submissions, same alumno, timestamps out of order in the source array | Result `[0].submittedAt` is the newer one. Feed them oldest-first so a missing sort fails the test |
| 4 | **Empty result** | `listRecordsMock` resolves `[]` → `fetchOnboarding()` returns `[]`, no throw |
| 5 | **Missing alumno link** — `Alumnos` absent | `alumnoId === ''`, and the record is **excluded** from `fetchOnboarding({ alumnoId: 'recALU1' })` |
| 6 | **Sparse submission** — only `T-Shirt Size?` present | The five unanswered fields are `undefined` (not `''`, not `null`); `submittedAt` falls back to `record.createdTime` |

Case 2's second assertion is the one that matters most and is easy to drop:

```ts
const [, options] = listRecordsMock.mock.calls[0] as [string, Record<string, unknown>];
expect(options?.filterByFormula).toBeUndefined();
expect(options?.maxRecords).toBeUndefined();
```

Without it, a future "optimisation" that adds `filterByFormula: FIND(...)` or a `maxRecords` cap
would pass every other case while silently truncating real data.

**Not tested here** (stated so the gap is deliberate, not accidental): the Supabase adapter (needs a
live client or a PostgREST mock — no precedent in the repo), the hook, and the card. Their
verification is manual, per §15.

## 15. Build order and verification

Mapped onto the proposal's two chained PRs.

**PR #1 — data + persistence** (§4, §5, §6, §7, §8, §14)

1. `OnboardingAdapter.test.ts` first (strict TDD — red).
2. Types + `constants.ts` (re-read the `INSTAGRAM_CONSENT` literal from the Airtable schema first).
3. Airtable adapter → `npm test` green.
4. Supabase adapter + barrel → `npm run build` (`tsc -b` catches barrel type drift).
5. `schema.sql` + `MIGRACION-ONBOARDING-2026-09-03.sql`; apply the migration to the shadow DB.
6. Migrator (all five additions, §8.1-§8.5); run it.

Gates:
- `npm test` green, including the six new cases.
- `npm run build` clean (there is **no CI** on the dashboard repo — run it by hand).
- `SELECT count(*) FROM onboarding;` under the **anon** key returns **> 0**. Non-negotiable (§7.2).
- `SELECT count(*) FROM onboarding WHERE alumno_id IS NULL;` reconciles against the number of
  Airtable rows with an empty `Alumnos` link. A high count means D-A5 was not applied.

**PR #2 — UI** (§9, §10, §11, §12, §13), targeting PR #1's branch

Gates:
- `npm run build` clean.
- A student **with** a submission: all six answers + the submission date, in both ES and EN.
- A student **without**: the `sinOnboarding` empty state. No console error.
- Open three students in a row with the Network tab open: **exactly one** request to the onboarding
  table. More than one means the global query key was lost (D-A1).
- Info tab at ≥1024 px and at ≤800 px: the card spans full width and the grid collapses cleanly.
- A Pagos row with a linked student navigates to `/admin/alumnos/:id`; a row without a link stays
  inert.
- With `VITE_DATA_SOURCE=supabase`, the same student renders the same six answers.

## 16. Architectural risks and open items

| # | Item | Severity | Status |
| --- | --- | --- | --- |
| R1 | Silent RLS failure — any one of the three SQL statements missing returns zero rows with `error === null` | **High** | Mitigated by design (§7.2, §7.3) + the mandatory anon-key row-count gate. Cannot be caught by any test in this repo |
| R2 | `FIELD_MAP["Alumnos"]` collision silently nulls every `alumno_id` | **High** | Closed by D-A5. Verify with the `alumno_id IS NULL` count |
| R3 | `INSTAGRAM_CONSENT` field literal is truncated in `explore.md` | Medium | **Open — apply must re-read it from the Airtable schema.** Blast radius is one constant; a wrong value renders that one row as `—` |
| R4 | Instagram consent choice labels unverified | Low | Closed by design: normalised keys + muted fallback (§11.2). No verification blocks the change |
| R5 | `respuestas_formulario` created but never populated | Low | Accepted, stated (D-A4). Follow-up logged |
| R6 | Upstream typo literals get "corrected" | Medium | Guarded by the §14.2 fixture — the only automated protection |
| R7 | A future edit converts `['onboarding']` to a per-student key | Medium | Guarded by the §15 network check; not detectable by a unit test |
| R8 | Diff lands at ~403 lines, on the 400-line review budget | Medium | Two chained PRs (§15). D-A5 adds ~7 lines beyond the proposal's estimate, so PR #1 is now ≈ 247 |

**Assumptions carried forward from the proposal, unchanged and unvalidated:** latest-submission-only
(D6), read-only, no aggregate view, `inscripciones` deferral. None of them is reversed here.

## 17. Next recommended

`sdd-tasks` (spec is already complete).

## skill_resolution

`paths-injected`
