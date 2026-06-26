# ProEv Supabase -> Airtable REVERSE sync report

> FIRST CUT — review the inverse field map + FK resolution before any live `--load`.

- Mode: **DRY-RUN (no Airtable writes)**
- Tables processed: 9
- Rows read (Supabase): 2733
- Planned PATCH: 2733 | Planned CREATE: 0
- Records written (live): 0

## Per-table plan

| Table | Rows | PATCH | CREATE | FK-skips | Written |
| --- | ---: | ---: | ---: | ---: | ---: |
| ediciones | 2 | 2 | 0 | 0 | 0 |
| modulos | 6 | 6 | 0 | 0 | 0 |
| alumnos | 145 | 145 | 0 | 0 | 0 |
| revisiones_video | 93 | 93 | 0 | 0 | 0 |
| pagos | 7 | 7 | 0 | 0 | 0 |
| envios_emails | 0 | 0 | 0 | 0 | 0 |
| cola_emails | 234 | 234 | 0 | 0 | 0 |
| inbox | 395 | 395 | 0 | 0 | 0 |
| historial | 1851 | 1851 | 0 | 0 | 0 |
