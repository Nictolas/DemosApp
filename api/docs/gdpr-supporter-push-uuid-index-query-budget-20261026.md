# DEMOS — Lookup push GDPR indicizzabile e budget SQL sintetico

**26 ottobre 2026 — proposta DRAFT stacked su #339 → #338 → #336 → #335 → #334 → #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302.**

## Perché

La PR #339 rilegge consenso e proprietà del token **immediatamente prima di ciascun invio Firebase**, saltando la notifica in caso di revoca/token rimosso/errore DB. È una verifica intenzionalmente recente e in sola lettura, non una transazione distribuita con Firebase.

Tre predicati di `currentSupporterPushService.js` usavano però:

```sql
u.id::text = ANY($1::text[])
```

Su `public.users.id`, che nei test del progetto è di tipo **UUID PRIMARY KEY**, l'espressione `id::text` può impedire il normale `Index Cond` dell'indice sulla chiave primaria e provocare lavoro non necessario sulla tabella per ogni token. La criticità cresce con il numero di utenti e di token; non è stata misurata su dati reali.

## Modifica minima

I due percorsi di `loadCurrentSupporterTokens` (con tabella dispositivi e fallback legacy) e il controllo `isCurrentSupporterTokenEligible` usano ora:

```sql
u.id = ANY($1::uuid[])
```

Gli ID derivano da `public.users.id::text` del lookup canonico dei sostenitori: sono UUID già letti dal database, passati a PostgreSQL in modo parametrizzato. Un valore non convertibile in UUID fallisce in modo sicuro anziché produrre un'associazione di account ambigua. Non cambia il controllo di consenso, proprietà del token, deduplica, fallback, ordinamento o la frequenza della verifica pre-invio.

**Non sono introdotti indici, migrazioni, DDL o variazioni infrastrutturali.**

## Verifiche isolate

1. I test di regressione dei servizi confermano `u.id = ANY($1::uuid[])` e l'assenza del cast del campo indicizzato.
2. `api/scripts/verify-supporter-notification-consent-ci.js` verifica **l'esatto predicato `u.id = ANY($1::uuid[])` nel SQL del servizio** e poi esegue `EXPLAIN (FORMAT JSON)` del **predicato UUID isolato** su `public.users(id uuid PRIMARY KEY)` in PostgreSQL 17 disposable. La separazione è intenzionale: il planner può riordinare i join della SELECT completa e applicare l'indice in modo differente. Un `SAVEPOINT` limita `SET LOCAL enable_seqscan=off`: la prova richiede un nodo con **`Index Cond` su `users_pkey`** per il confronto isolato. Il savepoint ripristina l'impostazione dopo l'EXPLAIN. Questo dimostra che il piano indicizzato è **disponibile**, non che il planner lo sceglierebbe sempre nella query completa né che una latenza o un costo commerciale siano stati misurati.
3. `api/tests/currentSupporterPushQueryBudget.test.js` conta le query su database/stub Firebase per 1, 10 e 100 token. Budget strutturale senza fallback: **2 query iniziali** (selezione sostenitori e lista token), poi **1 query di autorizzazione per token**. Nel fallback device-table il controllo pre-invio può usare **2 SELECT per token**. I test impediscono aumenti accidentali del numero di interrogazioni e omissioni delle verifiche.
4. Nessun test contatta Supabase reale, Render, Firebase, B2 né legge dati personali. I drill PostgreSQL rifiutano DB, host e credenziali che non siano quelli sintetici di CI.

## Interpretazione e prossimi passi

- **Ottimizzazione ottenuta:** il confronto sull'ID può utilizzare l'indice della chiave primaria; una differenza di prestazioni effettiva dipende da dimensioni, distribuzioni, cache e query plan dello staging.
- **Costo ancora presente:** 1 query di autorizzazione per token prima del push (o 2 nel fallback). Per 100 token, budget tipico teorico **102 query SQL** inclusi i due lookup iniziali, senza includere eventuali chiamate accessorie delle API o i messaggi Firebase. Non equivale automaticamente a un addebito o a una quota Supabase per SELECT.
- L'accesso ai dispositivi è correlato a `d.user_id` e `d.fcm_token`; indicizzazione, densità e piani reali di `public.user_devices` richiedono ispezione autorizzata dello schema/staging. **Non creare nuovi indici in produzione** in questa PR.
- Un batch unico per tutti i token ridurrebbe i round-trip, ma allungherebbe il tempo tra autorizzazione e invio: senza un ulteriore controllo subito prima della chiamata remota indebolirebbe la mitigazione GDPR. Non va introdotto per il solo scopo di risparmiare query.
- Una revoca **fra l'ultima SELECT e l'accettazione Firebase** resta possibile. Nessuna promessa di atomicità distribuita o di richiamo di messaggi già consegnati.
- Per l'issue #296 restano non dimostrate l'intera cronologia GDPR esterna completa/fresca/durabile fino al freeze, la quarantena Render/Supabase/Data API/worker, B2 Object Lock COMPLIANCE/versioning reale e le autorizzazioni DPIA/titolare/DPO/retention/costi.

**Nessun merge, deploy, migrazione, configurazione credenziali, accesso a dati reali o a infrastrutture di produzione.**
