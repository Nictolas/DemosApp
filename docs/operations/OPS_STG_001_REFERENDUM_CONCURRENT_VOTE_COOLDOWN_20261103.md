# DEMOS — OPS-STG-001: race condition fra primo voto referendum e cooldown (03/11/2026)

## Problema individuato

Nel backend `api/routes/referendum-vote.js` ogni voto è salvato in transazione e il record esistente viene letto con `SELECT ... FOR UPDATE` prima della verifica del cooldown di **24 ore**. Tuttavia, al **primo voto** il record non esiste: due richieste contemporanee dello stesso utente per lo stesso referendum possono entrambe leggere *nessun voto*, verificare *nessun cooldown*, e solo in seguito risolvere la chiave univoca con `INSERT ... ON CONFLICT DO UPDATE`. Senza serializzazione preliminare, una seconda modifica potrebbe eludere il blocco di 24 ore.

La chiave univoca delle posizioni evita i duplicati, ma da sola **non impedisce la seconda modifica prematura**.

## Correzione implementata, ancora NON distribuita

La PR #565, branch `ops/demos-unified-staging-20261102`, modifica `api/routes/referendum-vote.js`. Dopo `BEGIN`, **prima di interrogare scheda, posizione e cooldown**, esegue:

```sql
SELECT pg_advisory_xact_lock(hashtext($1::text), hashtext($2::text))
```

Parametri: `String(req.userId)` e `ballotId`, provenienti dalla richiesta autenticata e dalla route. Il blocco è **per coppia (utente, referendum)**, non globale; utenti diversi possono votare in parallelo. È un blocco transazionale: `COMMIT` e `ROLLBACK` lo rilasciano automaticamente. Collisioni hash potrebbero serializzare in più, ma non consentono di evitare il blocco. Non aggiunge tabelle né richiede permessi UPDATE sul ballot.

La richiesta successiva dello **stesso utente/referendum** aspetta la transazione precedente e poi verifica voto e cooldown già commitati. Se la scelta è diversa e il blocco temporale è attivo, la route resta fail-closed con il precedente errore `PREFERENCE_COOLDOWN`.

Rimangono invariati `requireVerifiedCivicIdentity`, `requirePoliticalConsent`, scelta YES/NO/ABSTAIN, verifica atomica della chiusura del referendum nell'INSERT, e la registrazione di voto e cooldown **nella stessa transazione**.

## Prove automatiche

- `api/tests/referendumRealVote.smoke.test.js`: nuovo test statico di regressione per l'ordine `BEGIN → advisory lock → lettura posizione → cooldown → inserimento voto → record cooldown → COMMIT` e controllo chiusura del referendum.
- `api/tests/test_ops_stg_001_p1_p2_p3_migrations_postgres.py`: nuovo test reale su **due connessioni diverse** a PostgreSQL 16 temporaneo `civic_ci`. Dimostra che un altro utente non viene bloccato; lo stesso utente/referendum riceve timeout SQL `55P03` mentre la prima transazione è aperta; dopo `COMMIT` il secondo client ottiene il blocco e vede il voto e il cooldown registrati dalla prima connessione. Pulizia finale: 0 fixture residue.
- `.github/workflows/unified-staging-offline-safety.yml` include adesso `api/routes/referendum-vote.js` sia nei trigger, sia nella verifica di sintassi.

**Evidenza verificata:** commit `bece8d27d5d262f1f1db37624730a8787d33cf93`, workflow **Unified Staging Offline Safety**, run `41625735014`, **3/3 job SUCCESS**: `bootstrap-offline-contract` con **49/49 + 29/29 = 78/78 test Node PASS**, `p0-schema-postgres16` PASS e `p1-p3-schema-postgres16` con **4/4 test Python su PostgreSQL 16 PASS**. Le righe `ERROR` nel log PostgreSQL relative ai casi volutamente proibiti non indicano fallimento della CI: il job termina SUCCESS. I workflow `Recognition CIE`, `Legacy Menu` e `Civic new initiative notifications` risultano già SUCCESS sul commit; `Snyk` success. `Versioned opinion catalog` e `Security Agent` erano ancora in corso al primo riscontro: non segnare tutti i workflow come superati senza nuova lettura.

## Gate residui, nessun GO prematuro

- Render `demos-staging` invariato: `autoDeploy=no`, bootstrap fail-closed, `/health/ready=503`, **nessun test applicativo**.
- Supabase Demos-Staging: **50 tabelle `public`**, `civic_push_delivery_guard.blocked=true`, **`demos_staging_preflight` ancora assente**. ACL P3 voto sintetico e P4 cooldown sintetico **preparate, NON applicate**.
- Produzione invariata; nessun nuovo ambiente permanente né costo aggiuntivo.

I **4 gate principali** rimangono: (1) credenziali isolate e provisioning autorizzato preflight; (2) ACL/fixture sintetiche approvate e modelli d'identità utente; (3) collegamento Render → Supabase Staging più E2E di auth, opinioni, referendum, notifiche, privacy con push/email/cron OFF; (4) regressioni, rollback e solo dopo dismissione controllata dei nove staging legacy.

**Importanza dell'intervento: 8/10**. Si è eliminato un potenziale bypass del cooldown dei voti tramite richieste concorrenti, verificato su database reale temporaneo; non è stato chiuso alcun gate di infrastruttura.
