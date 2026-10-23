# DEMOS — verifica osservazionale archiviatore Render (21 ottobre 2026)

**Origine:** log dell'attuale servizio Render `demos-backend`, ramo `main`,
servizio `srv-d2gt3dodl3ps73fmereg`. Consultazione **di sola lettura**,
senza accesso diretto a oggetti, chiavi o checkpoint Backblaze.
Questi risultati riguardano l'archiviatore **già attivo** in produzione,
non la nuova coda della PR #218 (ancora disattivata).

## Finestra esaminata

- Dal 20 ottobre 2026 alle 18:00 UTC al 21 ottobre 2026, ultima esecuzione
  registrata alle **18:17:06 UTC**.
- **27 righe `Axiom archive completed:`**, ciascuna con un riepilogo
  per entrambi i dataset.
- **0 righe `Axiom archive failed:`** nella stessa query dei log.
- In **27/27 riepiloghi** `caughtUp=true` e `remainingMs=0`
  per entrambi i dataset.
- Somma dei contatori `count` riportati dagli esiti:
  **134** per `centralized_logs` (categoria `technical`),
  **0** per `real-time` (nessun nuovo record riportato nei cicli).
  La somma conta risultati dei cicli e **non garantisce 134 record unici**,
  dato che l'archiviatore può usare finestre sovrapposte.
- Ogni riepilogo indica un chunk per dataset; l'ultimo ciclo riporta
  `centralized_logs: count=2` e `real-time: count=0`.
- Il job usa il cron `17 * * * *` (UTC) secondo
  `api/jobs/axiomArchiveJob.js`.

**Interpretazione:** questa è una conferma operativa ottenuta
direttamente dai log Render che l'archiviatore riporta completamenti
regolari, senza fallimenti registrati nella finestra. La presenza di
`real-time: count=0` non dimostra da sola una perdita di eventi, perché
non è stata eseguita una query indipendente al dataset Axiom. Una verifica
di audit reali, con dataset di test e accessi autorizzati, resta necessaria.

## Limiti da non confondere con una prova di restore

Il messaggio `Axiom archive completed` è emesso **dall'applicazione**
dopo `AxiomArchiveService.runOnce()`. Non è una prova indipendente che
gli oggetti possano essere riletti e ricostruiti da Backblaze B2.
Non abbiamo eseguito `HEAD`/`GET`, confrontato hash degli oggetti
reali, né controllato duplicati su file realmente presenti nel bucket.
Non riportare quindi la verifica B2 come superata.

Per completare l'evidenza B2: ottenere una chiave di **sola lettura**
autorizzata per il bucket EU e usare gli script
`archive:axiom:verify-latest` per `centralized_logs` e `real-time`;
usare `archive:axiom:verify-overlap` soltanto su chiavi effettive
selezionate da manifest autentici. Non stampare token, contenuti di log
personali, identificatori o URL di accesso firmati. Non alterare i
checkpoint e non eseguire scritture/cancellazioni in bucket.

## Impatto sul rilascio

- **PASS parziale:** l'archiviatore esistente mostra regolarità operativa.
- **NO-GO confermato:** manca la prova indipendente di lettura e
  ricostruzione B2, insieme al collaudo Axiom della nuova outbox,
  connessione applicativa di staging, test FCM e approvazione GDPR.
- Nessuna modifica a Render, Supabase produzione, bucket o job.
- Evidenza aggiunta alla PR #218:
  https://github.com/Nictolas/DemosApp/pull/218
