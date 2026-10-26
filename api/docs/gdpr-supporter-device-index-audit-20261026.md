# DEMOS — Audit dell'indice user_devices e del controllo GDPR pre-invio

**26 ottobre 2026 — proposta PR DRAFT.** Basata sulla PR #340, senza interventi su produzione, database veri o provider.

## Verifica del repository

La migrazione versionata `api/database/create-user-devices-table.sql` dichiara già:

```sql
CREATE TABLE IF NOT EXISTS user_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_active
  ON user_devices(user_id, is_active);
```

Il confronto nella prova pre-invio `isCurrentSupporterTokenEligible` usa già `d.user_id = u.id AND d.is_active = TRUE AND btrim(d.fcm_token) = $2` e soltanto `public.user_devices`. **Esiste quindi una definizione di indice adatta al lookup per utente attivo**; non è necessario introdurre un altro indice nel codice, né una migrazione.

## Prova PostgreSQL 17 senza dati reali

Ho esteso il drill locale `api/scripts/verify-supporter-notification-consent-ci.js` (guardrail `GITHUB_ACTIONS=true`, password di fixture e DB localhost `political_consent_race_ci`):
- Crea **solo nella transazione synthetic destinata a ROLLBACK** l'indice `idx_user_devices_user_active_ci(user_id,is_active)` su `public.user_devices`, che riproduce i campi dell'indice dichiarato in migrazione. Il suffisso `_ci` lo distingue dagli indici reali.
- La SELECT del servizio è controllata per la presenza dei predicati `public.user_devices`, `d.user_id = u.id`, `d.is_active=TRUE`. In un savepoint, con `SET LOCAL enable_seqscan=off`, `EXPLAIN (FORMAT JSON)` del predicato di accesso al dispositivo richiede un nodo che usi l'indice `idx_user_devices_user_active_ci` con condizione su `user_id`. Il savepoint annulla l'impostazione del planner.
- Aggiunge un token dispositivo sintetico `inactive-device` con `is_active=false`. La SELECT iniziale e la verifica immediatamente pre-invio devono entrambe escluderlo, anche in presenza di tabelle `pg_temp` omonime con dati contraddittori.
- Non modifica, configura o interroga Firebase, Supabase e Backblaze B2 reali; non usa credenziali e non crea indici persistenti. Conserva le prove di consenso revocato, dati shadow e fallback legacy.

Questa prova dimostra la **disponibilità teorica di un piano indicizzato**, non che il planner sceglierà quel piano nella SELECT completa, né la latenza effettiva a grande scala, la cache o le quote del provider. Forzare `enable_seqscan=off` per un EXPLAIN di prova non è un suggerimento di impostazione di produzione.

## Limitazioni e possibili rischi da controllare separatamente

- **Non sappiamo se la migrazione sia stata realmente applicata al database di produzione/staging.** Il repository documenta l'indice, non ne dimostra la presenza su un'istanza reale. Verifiche di catalogo e `EXPLAIN (ANALYZE, BUFFERS)` su staging richiedono ambiente autorizzato e un consenso esplicito sui costi.
- L'unicità di `fcm_token` non garantisce da sola che il suo indice possa accelerare il confronto `btrim(d.fcm_token) = $2`. L'indice composto consente invece di restringere il sottoinsieme `user_id/is_active`; **non abbiamo misurato** il peso residuo dell'operazione di `btrim`.
- Il servizio usa ancora l'unione fra dispositivi attivi e `users.fcm_tokens` legacy. Un token presente in quest'ultimo array può rimanere candidato anche quando un record `user_devices` omonimo è stato disattivato, se le due sorgenti non sono state aggiornate insieme. Serve una verifica dedicata del contratto di autorevolezza tra dispositivi e storage legacy, senza presumere che il solo indice risolva il problema.
- La revoca fra l'ultima SELECT del consenso e l'accettazione Firebase rimane una race non atomica. Non si mantiene una transazione DB aperta durante la rete.
- **Issue #296:** restano aperte completezza/durabilità/freschezza indipendente del registro GDPR fino al freeze, quarantena Render/Supabase/Data API/worker, test reali B2 Object Lock COMPLIANCE/VersionId/retention su staging, decisioni DPIA/titolare/DPO/retention/costi.

**Nessun merge, deploy, migrazione, accesso produzione/dati reali, credenziale, servizio attivato o modifica infrastrutturale.**
