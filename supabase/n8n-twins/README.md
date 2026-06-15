# n8n-twins/ — backups y notas de los twins Supabase

Esta carpeta contiene **backups puntuales (point-in-time)** de algunos workflows twin Supabase y notas
de construcción por-twin. Son **inconsistentes a propósito** — solo se exportaron algunos twins durante
la construcción; NO es un set completo ni se mantiene sincronizado.

## Fuente de verdad
- **Workflows live en n8n** (instancia prod Easypanel) — son los autoritativos.
- **`../MIGRACION-N8N-TWINS-BUILT.md`** — lista completa de los 22 twins (IDs originales → twin) + flags de cutover.

## Contenido
- `sb-twin-*.json` / `twin-*.json` / `twin_*.json` — exports JSON de algunos twins (backup).
- `*.notes.md` / `TWIN-NOTES-*.md` — notas de mapeo/decisiones por-twin (DB-webhook specs, FK fixes, flags).

## Para inspeccionar un twin actual
No te fíes de estos backups (pueden estar stale). Usa `n8n_get_workflow(<twinId>, full)` contra la
instancia live, o mira los IDs en `MIGRACION-N8N-TWINS-BUILT.md`.
