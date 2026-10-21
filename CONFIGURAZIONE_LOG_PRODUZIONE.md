# DEMOS — configurazione logging in produzione

> Aggiornato 21/10/2026. **Documentazione dell'architettura prevista, non certificazione di configurazione live.** Per le operazioni in sicurezza: [piano logging e GDPR](docs/operations/LOGGING_COST_GDPR_ACTIONS_2026-10-21.md) e [procedura archivio Axiom → B2](docs/operations/axiom-b2-log-archive.md).

## Ambiente applicativo su Render

| Variabile | Valore previsto | Scopo |
|---|---|---|
| `NODE_ENV` | `production` | Disattiva alcuni messaggi di debug |
| `GDPR_LOGGING_FILTER` | `true` | Filtra richieste operative a bassa rilevanza |
| `LOG_LEVEL` | `INFO` | Livello dei log tecnici; audit/security espliciti restano attivi |
| `AXIOM_ENABLED` | `true` **solo se configurato** | Usa Axiom come destinazione dei log |
| `AXIOM_ARCHIVE_ENABLED` | **già attiva in produzione, rilevato il 21/10/2026** | Il job è osservato nei log Render; non disattivare senza analisi della continuità degli archivi |

**Verificare i valori sul servizio Render effettivo.** Gli `env.example` sono soltanto esempi, non dimostrano i valori in produzione. Mai includere token, URL con segreti o chiavi nei log o nel repository.

Il filtro applicativo non è una certificazione GDPR: le categorie, i dati personali inclusi, le finalità e i periodi di conservazione devono essere valutati singolarmente.

## Architettura dei log

- **Axiom EU:** ricerca, alerting e analisi dei log recenti, nei dataset `centralized_logs` e `real-time`.
- **Backblaze B2 EU Central:** archivio storico compresso in `.jsonl.gz`, con separazione `technical`, `audit`, `security`.
- **Stato verificato su Render (21/10/2026):** servizio `demos-backend`, workspace `Nicolas`, ramo `main`, deploy live `d80c1b90ca412e78af60621485f8ec825ad53210` del 20 ottobre 2026. I log riportano `Axiom archive job enabled (17 * * * * UTC)` e completamenti ogni ora per i dataset `centralized_logs` e `real-time`. Il bucket citato nella documentazione è `demos-log-archive-eu` (EU Central); **non abbiamo interrogato direttamente B2**. Object Lock era descritto come disabilitato. Il job è **già attivo**: non duplicare, non resettare checkpoint.
- Le esecuzioni `completed` attestano che il codice ha terminato interrogazioni Axiom, upload con verifica HEAD/metadata e aggiornamento checkpoint senza sollevare eccezioni; **non costituiscono un test indipendente di download, decompressione e ripristino dei dati dal bucket B2**. Retention/lifecycle e consumo effettivi B2 richiedono verifica diretta.

## Percorso di verifica del job già attivo (nessun intervento distruttivo)
1. Verificare quota Axiom, uso reale dei dataset, token/permessi e conservazione attuale.
2. Verificare che il bucket B2 EU e la chiave ad accesso limitato siano disponibili. Valutare Object Lock secondo le esigenze di integrità e cancellazione.
3. Eseguire i test `npm run test:logging-privacy` e `npm run test:axiom-archive`; GitHub Action `Logging and archive regression` li esegue sulla PR.
4. Effettuare un trasferimento di prova controllato di log sintetici o non personali, verificando hash, manifest, checkpoint e recupero dell'oggetto compresso.
5. Definire e documentare con responsabile privacy/DPO durate diverse per categoria e lifecycle/cancellazioni B2; evitare retention uniforme.
6. Il job gira **già** in produzione: non riattivarlo, riavviarlo o azzerare checkpoint. Aggiungere monitoraggio del backlog, alert indipendenti e recupero verificato prima di considerare il processo pienamente affidabile.

**Non** modificare la retention, cancellare log o attivare il job soltanto sulla base di questo documento.

## Evidenza quantitativa (log Render, 20–21/10/2026)

- Finestra: 20 ottobre 12:00 UTC → 21 ottobre 12:00 UTC; **25** messaggi di esecuzione completata del job.
- Sui due dataset: **529** record classificati tecnici e **7** record classificati audit elaborati, **0** security; questi sono conteggi dei batch, includono possibili sovrapposizioni/duplicazioni dovute all'overlap e **non** indicano eventi unici né byte archiviati.
- Nei messaggi di completamento il processo risultava `caughtUp=true` per entrambi i dataset; ricerca delle righe `Axiom archive failed` nella settimana esaminata: nessuna corrispondenza, che **non prova** l'assenza di errori non segnalati.
- Individuate **4 righe** del vecchio audit writer che stampano in chiaro un identificatore utente sui log Render: correzione predisposta in PR #217, **non ancora distribuita**.
- [Console Render servizio backend](https://dashboard.render.com/web/srv-d2gt3dodl3ps73fmereg). I messaggi integrali dei log possono contenere dati personali: consultazione e condivisione a personale autorizzato.
