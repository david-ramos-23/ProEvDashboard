# Handoff — 2026-06-26 (session 2)

## Context

Continued from the previous session (see `.claude/handoffs/handoff-2026-06-26.md`).
Branch: `feat/video-review-edicion-scope-y-estado-video` on **ProEvDashboard** (`dashboard/` sub-repo).
The PR #5 was merged to `master` by the user mid-session. All new commits after that were cherry-picked to master directly.

---

## What was done & verified this session

### 1. Three UI bug fixes (commit `c72801b` on master via PR #5 merge)

| Bug | Fix | File |
|---|---|---|
| Email panel doesn't expand full-width when no email selected | `selectEmail()` now toggles on re-click; `listPanel` width + divider + detailPanel conditionally hidden | `src/pages/admin/Inbox.tsx` |
| Mobile login: background video hidden | Removed `.videoBg { display: none; }` from `@media (max-width: 767px)` | `src/pages/Login.module.css` |
| Cola emails toolbar: column selector left, no search | Added `colaSearch` state + `filteredCola` memo; DataTable gets `searchValue`/`onSearchChange`/`title` | `src/pages/admin/Inbox.tsx` |

### 2. AI Assistant accuracy overhaul (commits `a8deb08`, `94622df`, `cd16446` — all on master)

**Root causes identified:**
- No edition scoping in any tool
- `maxRecords = limit||10` (default 10, hard cap 50) — LLM had to infer totals from tiny samples
- Dead sort code in `search_alumnos` (built `params` object then ignored it)
- System prompt said nothing about how to count

**Fixes applied to `api/ai-chat.ts`:**
- New `obtener_estadisticas` tool: full pagination via `Promise.all` across 4 tables (alumnos scoped by edition, cola/inbox/revisiones global), returns pre-computed named fields (`alumnos_aprobados`, `cola_emails_pendientes_aprobacion`, `revisiones_pendientes`, etc.)
- `search_alumnos`: added `edicion` param (FIND formula matching dashboard pattern), fixed dead sort, description warns about limit
- `list_cola_emails`: description warns it's a sample, not a total
- System prompt: names both editions, declares the active one, instructs model to ALWAYS call `obtener_estadisticas` for counts
- Body parse: reads `edicion` from request
- `vercel.json`: added `"functions": { "api/ai-chat.ts": { "maxDuration": 30 } }` (parallel fetches needed >10s)

**Frontend (`src/components/AIAssistant/AIAssistant.tsx`):**
- Imports `useEdicion` from `@/context/EdicionContext`
- Sends `edicion: selectedNombre` in POST body

**Ground truth (pulled live from Airtable `app4ZpoxaWOyV4RnR`):**

| Metric | Value |
|---|---|
| Alumnos total | 152 (Vol I 108, Vol II 41) |
| Alumnos aprobados (global) | 6 (all in Vol I) |
| Revisiones pendientes | 8 |
| Cola emails pendientes aprobación | 189 |
| Inbox requiere atención | 4 |

**AFTER verification (prod, `cd16446`):**
- "¿Cuántos alumnos en total?" → **41** (Vol II scoped, correctly explained) ✅
- "¿Cuántos en Vol I?" → **108** ✅
- "¿Cuántos emails pendientes aprobación?" → **189** ✅
- "¿Cuántas revisiones pendientes?" → **8** ✅
- "¿Cuántos aprobados?" → **0 en Vol II** (correct, with breakdown) ✅

---

## Pending / next steps

### High priority
1. **Codex review on PR #5** — a `@codex review` was posted on the PR. Check for new P1/P2 findings and resolve them. The PR was merged so any fixes go directly to master.
2. **Feature branch cleanup** — `feat/video-review-edicion-scope-y-estado-video` still exists with extra commits beyond what's on master (`7938218`). Either delete it or ensure it's fully merged.

### Nice to have
3. **AI assistant: global total** — When the user asks "cuántos alumnos en total" with an edition in context, the assistant correctly scopes to that edition. If they want the global 152, they'd need to ask "cuántos alumnos en total en todas las ediciones". The system prompt could be clearer about this.
4. **Supabase cutover gaps** — `inbox` Supabase table needs `origen TEXT` and `alumno_nombre TEXT` columns before switching from Airtable. See `dashboard/src/data/adapters/supabase/InboxAdapter.ts` and `MIGRACION-SCHEMA-GAPS.md`.
5. **Pagos table sparse** — Only 7 records (manual, Stripe not integrated). AI assistant warns about this. Not a bug, just operational context.

---

## Key file paths

```
dashboard/api/ai-chat.ts                                    ← AI backend (main changes this session)
dashboard/src/components/AIAssistant/AIAssistant.tsx        ← sends edicion in POST body
dashboard/src/pages/admin/Inbox.tsx                         ← email panel + Cola search
dashboard/src/pages/Login.module.css                        ← mobile video fix
dashboard/vercel.json                                       ← maxDuration: 30 for ai-chat
dashboard/src/context/EdicionContext.tsx                    ← useEdicion() hook
dashboard/src/lib/resolveEdicion.ts                         ← narrowest-window edition resolver
dashboard/api/auth/send-magic-link.ts                       ← devLink only local (!VERCEL_ENV)
dashboard/src/auth/AuthService.ts                           ← devFallback on DEV + .vercel.app
```

## Technical gotchas

- **Vercel preview auth wall**: Preview URLs (`*.vercel.app`) require Vercel login for external HTTP — sandbox can't test them. Always test against prod (`proev-dashboard.dravaautomations.com`) after merging to master.
- **Sandbox timeout**: `ctx_execute` sandbox has a 30s max. Don't `await new Promise(r=>setTimeout(r,25000))` inside it. Run tests without sleep delays, or fire them in parallel.
- **AI chat Vercel timeout**: Default Vercel timeout was 10s. `obtener_estadisticas` does 4 parallel Airtable fetches. `maxDuration: 30` added to `vercel.json` — required for the tool to not timeout.
- **Airtable field names with accents**: `Estado de Revisión` (ó), `Requiere Atencion` (no accent). Use exact names when querying.
- **Edition scoping in different surfaces**: Alumnos/Dashboard use FIND formula on the `Edicion` link field. Pagos use `resolveEdicionByDate` (date-window, narrowest-wins). Revisiones use `fetchAlumnoIdsByEdicion`. The AI assistant now uses the same FIND formula as the dashboard.
- **`obtener_estadisticas` response format**: Returns pre-computed named fields, not just `por_estado` maps. The model was confused by raw maps — explicit fields like `alumnos_aprobados: 6` fixed the interpretation errors.
- **master vs feature branch**: User merged PR #5 mid-session. Subsequent commits were cherry-picked to master directly. Feature branch `feat/video-review-edicion-scope-y-estado-video` has some extra commits — clean up if needed.

## Suggested skills for next agent

- `/gsd-debug` if Codex finds new P1 bugs
- `/code-reviewer` before next merge to master
