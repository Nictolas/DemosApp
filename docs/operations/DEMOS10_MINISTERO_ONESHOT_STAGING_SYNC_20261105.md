# DEMOS 10 — Ministero source-only one-shot, staging isolato

**5 novembre 2026. Codice proposto in QA; nessun deploy e nessun cron attivato.**

## Perché

La cache iniziale contiene 87 record ufficiali del Ministero e 36
eventi storici `suppressed` (oltre alle 12 ECI con 12 `suppressed`).
L'API del Ministero è già accessibile e parsata; il metodo
`ministeroSync.syncAll()` importa però la normale applicazione,
esegue numerose scritture separate e tenta un backfill di tabelle che
non fanno parte delle quattro sorgenti autorizzate. Non è quindi
idoneo come esecutore isolato dello staging condiviso.

## Nuovo esecutore a invocazione singola

`cd api && node staging/ministeroStagingSyncOnce.js --once`

* Importa soltanto parser pubblico ufficiale, policy TLS, verifica
  staging e client PostgreSQL. **Mai** server API, autenticazione
  utente, Firebase, push, scheduler o job dell'app completa.
* Non parte con le variabili di staging attuali. Richiede
  `NODE_ENV=staging`, il preesistente GO del canary,
  configurazione del pooler sessione/ruolo già verificata e
  **l'autorizzazione distinta**
  `DEMOS_STAGING_MINISTERO_SOURCE_SYNC_GO=I_APPROVE_STAGING_MINISTERO_SOURCE_SYNC`.
  Questo controllo riutilizza `assertStagingAppCanary`: senza
  `DEMOS_UNIFIED_STAGING_MODE=app_canary` e gli altri gate fail-closed
  non è possibile accedere al database.
* Verifica con query in sola lettura l'identità del runtime
  (`demos_staging_runtime`, DB `postgres`, fingerprint noto,
  `civic_push_delivery_guard.blocked=true`), **prima** del fetch.
  Ripete il controllo in transazione, blocca il record della guardia
  con `FOR SHARE`, acquisisce un advisory lock di transazione
  ed esige che non vi siano eventi azionabili.
* Richiede feed ufficiale completo, 1–100 record, date ISO, ID
  numerici distinti, titoli e categorie ufficiali, firma/URL validi;
  **rifiuta qualsiasi ID già archiviato assente nel nuovo feed**, anche
  quando il totale di record rimane uguale. Non cancella iniziative e
  richiede una procedura separata e autorizzata per i record scomparsi.
  Questa protezione interrompe il job se il feed crescerà oltre
  100 record: serve estendere il parser con paginazione sicura.
* Una sola transazione per `INSERT ... ON CONFLICT(id) DO UPDATE`
  sulla cache Ministero; nessuna cancellazione, nessuna tabella
  `ministeri`, nessuna raw response JSON memorizzata.
  Le iniziative in raccolta con data fine scaduta sono classificate
  `conclusa`, coerentemente con il baseline del 5 novembre.
* Per gli ID ufficiali attualmente idonei e ancora senza outbox,
  inserisce solo nuove righe `status='suppressed'`, con
  `ON CONFLICT(category,official_id) DO NOTHING`.
  Le 48 righe storiche restano soppresse: **mai** `pending` o FCM.
  Un fallimento di identità, guardia, completezza, SQL o conteggi
  provoca `ROLLBACK` ed errore generico, senza log credenziali.
* Il successo stampa solo contatori aggregati.
  Non crea servizi, staging paralleli, database, credenziali,
  rotazioni password, record dispositivi o HTTP endpoint.

## Test e limiti

Test Node isolati **8/8 PASS** per normalizzazione, autorizzazione,
identità, concorrenza, feed parziale, transazioni, rollback, guardia,
soppressione e assenza di chiamate push. Prove **reali** su PostgreSQL
**16/17** con ruolo CI privo di DELETE: entrambe PASS, inclusi upsert
ripetuti, identità degli ID, assenza di eventi azionabili e blocco
su feed incompleto e guardia disattivata.
`Unified Staging Offline Safety` **7/7 job PASS** e Snyk SUCCESS
alla PR #606 https://github.com/Nictolas/DemosApp/pull/606.
Integrata **solo** nel ramo staging al commit
`76236c958d750847e65c19ed77e353a197ef9b7c`.
I test non equivalgono a un'esecuzione sul database Supabase reale.

**NON ATTIVARE ORA.** I workflow GitHub `schedule` operano sul ramo
default `main`, non sul ramo QA/staging; aggiungere questo codice
alla staging branch non attiva sincronizzazioni automatiche.
Prima del GO operativo sono necessari un percorso autorizzato
sul servizio Render già esistente, un segreto di minima autorizzazione,
rollback provato e test E2E Android/FCM. Il servizio Render mantiene
`autoDeploy=no` e bootstrap `preflight_only`.

Rimangono aperti #589, autorizzazione staging e **Android E2E 0/6**.
**Rilascio: NO-GO.**
