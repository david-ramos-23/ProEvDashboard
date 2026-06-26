# Runsheet de cutover Airtable → Supabase (ventana big-bang)

> Secuencia determinista para la ventana. Acompaña a `MIGRACION-CUTOVER-RUNBOOK.md` y al
> pre-flight `MIGRACION-CUTOVER-PREFLIGHT-2026-06-15.md`. **Refina el orden del runbook** para
> cerrar la tensión bucle/triggers: se apaga el sync A→S y se desactivan los originales **antes**
> de habilitar el procesamiento desde Supabase y el reverse-sync.
>
> Leyenda de actor: **[D]** = David (dashboard externo) · **[CC]** = yo, vía n8n MCP / scripts.

## Go / no-go antes de abrir la ventana
- [ ] Re-correr `validate_parity.py` → PASS 0 discrepancias (frescura inmediata).
- [ ] Confirmar estado base (pre-flight): 24 originales activos, 24 twins + Tally inactivos, 9 DB-webhooks `D`, 5 nodos dual-write `disabled`.
- [ ] **Decisión pendiente — 🔒 seguridad anon-RLS** (`supabase-anon-rls-pii-exposure`): si esto es go-live productivo real, resolver primero (proxy serverless o RLS por usuario). Para staging/sombra se puede proceder.
- [ ] Creds: **no se rotan** (decisión 2026-06-15). Rotar antes del go-live productivo real.

---

## Secuencia de la ventana (orden estricto)

### Fase 0 — Congelar y refrescar
1. **[D]** Anunciar ventana de mantenimiento; pausar escrituras del dashboard (no enviar formularios/inbound).
2. **[CC]** `migrate_airtable_data.py --load` final → Supabase 100% fresco (cierra el gap de ~2h del cron). Verificar `Failed: 0`.
3. **[CC]** `validate_parity.py` → PASS.

### Fase 1 — Cortar el sync A→S
4. **[D]** Desactivar el GitHub Action `airtable-supabase-sync.yml` (Actions → Disable workflow). Confirmar que no hay runs en curso.
   - *Por qué primero:* sin esto, habilitar los DB-webhooks o el reverse-sync provocaría bucles/duplicados.

### Fase 2 — Apagar originales Airtable (excepto tracking)
5. **[CC]** Desactivar los **22 originales** (todos los `[Airtable]/[Schedule]/[Webhook]/[Gmail]/[Stripe]` con twin) **EXCEPTO los 2 de tracking**:
   - Se quedan ACTIVOS: pixel `a9F0DmOsWFohjKlM` + click `eEc8XBMo2ej1xSlv` (sirven URLs congeladas de emails ya enviados).
   - Desactivar: `R3mQiCRZ8tu66yaQ`, `vAXmsu9exm9LEbID`, `yP0Ehu1fk86ZAJoS`, `RHglZuskaIiC42lg`, `qaDQHyiZ8WKPfFUJ`, `NjXLz3D0Fd87KjzC`, `1ECKTnP1Nvo6x-5BydqFY`, `KvsgidqUkHMMjPxA`, `RrcIiAsEnAWBbQTi`, `yXqwbWnocDa1bG48`, `6IyUv44O8X8JZv9J`, `iFHwczOWaQxD8hdG`, `0C0AuwYqsJNh8yZ4`, `86TaFQgNjXIFP2rA`, `tAsjIcEV9celCA7y`, `L0d0Nj24XosJI0HB`, `8uotHUeyyM01LfFx`, `JzY10GKy2yaNJmEI`, `kWDjtwTRmQfUC0B5`, `MqNEU6FH4sOkvzwq`, `jVbu6iqRWsgfYvTI`, `5qjxfOD03sHUeRbr` (Stripe).
   - *Por qué ahora:* con los originales apagados, ni el reverse-sync ni escrituras posteriores en Airtable disparan sus `airtableTrigger`.

### Fase 3 — Habilitar dual-write en tracking (emails ya enviados)
6. **[CC]** `n8n_update_partial_workflow` op `enableNode` en los 5 nodos sombra (sync A→S YA apagado en fase 1, así que el dedup es irrelevante):
   - `a9F0DmOsWFohjKlM`: `SB Lookup Alumno`, `SB Log Apertura`, `SB Update Inbox`.
   - `eEc8XBMo2ej1xSlv`: `SB Lookup Alumno`, `SB Log Click`.
7. **[CC]** `n8n_validate_workflow` de ambos → sin errores nuevos.

### Fase 4 — Activar twins (orden: pilotos → resto → Stripe ÚLTIMO)
8. **[CC]** Grupo 1 (pilotos read-only): `sJ3HEoC6C9qFEhFR`, `Z2PZdRgimnJvA1hn`.
9. **[CC]** Grupo 2 (sub-workflow hoja): `mEDU1PCOKqQt2NIE`.
10. **[CC]** Grupo 3 (resto de twins): `eV7qKsqMr6fDdN7P`, `QTTxz42B9Ml8yVkC`, `9JLmrgFRBCvOtdLs`, `cDszir6TGOldTLfS`, `xZpHLPtTCqPZj72b`, `9xkOkOFjcxTiI2tK`, `MxkkVlHoQ4GRXXDL`, `eq1kDPCepRoNFCiE`, `DMW24WqkScM7GpHi`, `n8iB6hVEVw6xlIsc`, `GZMY1flgIfw7mN4C`, `KrFiR9Q1fE9VO0mm`, `q0S3dYF0mO4S656q`, `T9zLpcIboZvTlhe1`, `Hhc5F2Y8UKpYihrb`, `ZpTKSzQJeMDowOM1`, `9nRDVRzKctOw7lGH`, `3WDtM629rGgWsvkB`, `jl67tZr0ibxrVoVV`, `YZPmyXrQlJyXyeqP`.
11. **[CC]** Intake Tally `l4i90Cyy7F8YEPth` (activar tras repuntar Tally, paso 14).
12. **[CC]** Grupo 4 (money path, **EL ÚLTIMO**): `XikVC07KC9xNURhK` (Stripe).

### Fase 5 — Disparadores y repointing
13. **[D]** En Supabase: `ALTER TABLE ... ENABLE TRIGGER sbwh_*` para los 9 DB-webhooks (`MIGRACION-DB-WEBHOOKS.sql`). Sync A→S ya apagado → sin bucle.
14. **[D]** Tally: form de inscripción → Integrations/Webhook → `https://hooks.dravaautomations.com/webhook/sb-tally-inscripcion`.
15. **[D]** Stripe Dashboard: repuntar el endpoint del webhook al del twin `XikVC07KC9xNURhK` (o mantener path/webhookId idénticos).
16. **[CC]/[D]** Repuntar generadores de URLs pixel/click/token a **UUID** Supabase (no recId) en dashboard / workflows que emiten esas URLs.
17. **[D]** Vercel: `VITE_DATA_SOURCE=supabase` en **Production** + redeploy (~1 min). ⚠️ Conmuta lectura **y** escritura del dashboard.

### Fase 6 — Red de seguridad (reverse-sync S→A)
18. **[CC]** `sync_supabase_to_airtable.py --dry-run` → sanity (debería seguir 0 errores).
19. **[CC]** `sync_supabase_to_airtable.py --load` **monitorizado, por-chunk** (primer write real a Airtable; vigilar 422 de campos computed/lookup). Originales ya apagados → no dispara triggers. Dejar como red de seguridad continua.

### Fase 7 — Smoke tests + monitor
20. **[D/CC]** Probar en vivo: 1 click + 1 apertura de email viejo (→ `historial`/`inbox` Supabase con `airtable_id`); alta Tally; flujo Boton Modulo; **evento de prueba Stripe** (dedup `pagos.id_sesion_stripe`).
21. **[CC]** Vigilar ejecuciones n8n + verificar twins #14/#15/#16/#20 leen `modules`/`alerta_activa`/`dias_*`.

---

## Rollback (si algo falla en la ventana)
1. **[D]** Vercel `VITE_DATA_SOURCE=airtable` + redeploy.
2. **[CC]** Reactivar los 22 originales; desactivar los 22 twins (+ Tally intake).
3. **[CC]** `disableNode` de los 5 nodos dual-write de tracking.
4. **[D]** `ALTER TABLE ... DISABLE TRIGGER sbwh_*` (9).
5. **[D]** Tally + Stripe → endpoints Airtable originales.
6. **[D]** Reactivar el GitHub Action sync A→S.
- El reverse-sync (fase 6) garantiza que Airtable ya tiene lo escrito durante la ventana Supabase.

## Notas
- Activación/desactivación de workflows: vía n8n (UI o API `POST /workflows/{id}/activate|deactivate`). Confirmar la op MCP exacta al inicio de la ventana.
- Pin data no afecta a ejecuciones de producción.
- Webhooks que disparan envíos (p.ej. Gmail reply) están sin auth como el patrón canónico → asegurar (header/secret) antes de exponer si es go-live productivo.
