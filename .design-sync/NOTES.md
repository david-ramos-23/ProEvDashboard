# design-sync notes — ProEv Dashboard (FOCUS design system)

Repo-specific gotchas for future syncs. Read this before re-running.

## Source shape & entry

- **Shape: `package`, synth-entry.** This repo is a Vite SPA, **not** a published
  component library — no `dist/`, no library `main`/`module`/`exports`, no shipped
  `.d.ts`. The converter runs off a hand-written entry that re-exports the shared
  component library.
- **Entry: `.design-sync/ds-entry.tsx`** (committed). It re-exports the 12 shared
  components and imports `@/styles/global.css`. Run with `--entry .design-sync/ds-entry.tsx`.
- **Import explicit component FILES, never the `@/components/shared` barrel.** The
  esbuild tsconfig-paths plugin tries extension `''` first and `existsSync` matches
  directories, so a barrel-directory import (`@/components/shared`) resolves to the
  directory and esbuild fails ("Could not resolve"). Point at files
  (`@/components/shared/KPICard`). Same caveat for any `@/x` where `src/x` is a dir.

## Styling surface

- **Tokens ship via the entry's `import '@/styles/global.css'`, NOT `tokensGlob`.**
  `copyTokens` only globs inside a `tokensPkg` (a node_modules package); our tokens
  live in the app's own `src/styles/`. The global import pulls `variables.css`
  (`:root` + `[data-theme="dark"]` tokens), the Inter web font (`@import url(...)`),
  and base element styles into `_ds_bundle.css`, which `styles.css` already imports.
  `tokensGlob` is left in config but is a no-op without `tokensPkg`.
- Inter is a **remote** webfont (`[FONT_REMOTE]`, expected) — loads at runtime, nothing ships.
- Dark theme is `[data-theme="dark"]` on the root element; light is the default `:root`.

## tsconfig for the bundler

- **Use `.design-sync/tsconfig.paths.json`** (clean, comment-free), NOT the repo's
  `tsconfig.app.json`. The plugin's naive comment-strip + `JSON.parse` chokes on the
  real tsconfig ("Bad control character in string literal") and silently returns null,
  so `@/` never resolves. The clean copy only carries `baseUrl: ".."` + `paths: {"@/*": ["src/*"]}`.

## Props (.d.ts)

- Synth mode can't extract props from `.tsx` source, so every component's `.d.ts`
  defaults to the stub `[key: string]: unknown`. Real interfaces are hand-written in
  `cfg.dtsPropsFor`. When a component's props change in source, update `dtsPropsFor`.
  `DataTable` is generic (`<T extends {id:string}>`) — its `dtsPropsFor` uses an inline
  column object type and `any` rows (a referenced `Column` type wouldn't exist in the emitted `.d.ts`).

## Known render warns (triaged — not failures)

- **AnimatedValue count-up captured mid-animation.** `KPICard`/`StatCard`/`AnimatedValue`
  use a 900ms ease-out count-up; the screenshot fires before it finishes, so values
  render ~95% of target (e.g. 1,187 vs the coded 1,248). Plausible dashboard numbers,
  graded `good`. Not a bug.

## Re-sync risks (watch-list)

- **Component API drift.** `dtsPropsFor` and `componentSrcMap` are hand-maintained. If a
  shared component gains/renames props or a file moves, the `.d.ts` contract and/or
  discovery go stale silently — re-read the source and update config.
- **Preview data is inlined** in `.design-sync/previews/*.tsx` (alumno rows, estado
  strings). If `ESTADO_COLORS`/`ESTADO_ICONS` keys in `src/utils/constants.ts` change,
  StatusBadge/DataTable previews may show an unstyled (muted) badge for an unknown value.
- **Entry coverage.** New shared components are NOT auto-discovered — add them to
  `ds-entry.tsx`, `componentSrcMap`, and `dtsPropsFor`.
- **tsconfig plugin fragility.** If `@/` stops resolving after a tools bump, re-check the
  clean `.design-sync/tsconfig.paths.json` is still pointed at and parses.
