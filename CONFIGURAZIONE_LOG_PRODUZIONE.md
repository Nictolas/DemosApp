# DEMOS — configurazione logging in produzione

> Aggiornato 21/10/2026. **Documentazione dell'architettura prevista, non certificazione di configurazione live.** Per le operazioni in sicurezza: [piano logging e GDPR](docs/operations/LOGGING_COST_GDPR_ACTIONS_2026-10-21.md) e [procedura archivio Axiom → B2](docs/operations/axiom-b2-log-archive.md).

## Ambiente applicativo su Render

| Variabile | Valore previsto | Scopo |
|---|---|---|
| `NODE_ENV` | `production` | Disattiva alcuni messaggi di debug |
| `GDPR_LOGGING_FILTER` | `true` | Filtra richieste operative a bassa rilevanza |
| `LOG_LEVEL` | `INFO` | Livello dei log tecnici; audit/security espliciti restano attivi |
| `AXIOM_ENABLED` | `true` **solo se configurato** | Usa Axiom come destinazione dei log |
| `AXIOM_ARCHIVE_ENABLED` | `false` fino al collaudo | Disabilita il job di archiviazione Axiom → Backblaze |

**Verificare i valori sul servizio Render effettivo.** Gli `env.example` sono soltanto esempi, non dimostrano i valori in produzione. Mai includere token, URL con segreti o chiavi nei log o nel repository.

Il filtro applicativo non è una certificazione GDPR: le categorie, i dati personali inclusi, le finalità e i periodi di conservazione devono essere valutati singolarmente.

## Architettura dei log

- **Axiom EU:** ricerca, alerting e analisi dei log recenti, nei dataset `centralized_logs` e `real-time`.
- **Backblaze B2 EU Central:** archivio storico compresso in `.jsonl.gz`, con separazione `technical`, `audit`, `security`.
- **Stato dichiarato dai documenti (06/10/2026):** account e bucket Backblaze creati; credenziali dedicate e job produttivo ancora da verificare/attivare. Nome bucket previsto: `demos-log-archive-eu`, regione/endpoint da controllare in dashboard. Object Lock risultava disabilitato nella configurazione descritta.
- La presenza del bucket **non prova** che vi siano copie dei log, né che la pipeline di archiviazione funzioni. Non descrivere B2 come archivio operativo finché non siano stati verificati un upload, un checkpoint, la verifica di integrità e un download/ripristino.

## Percorso di attivazione (nessun intervento distruttivo)
1. Verificare quota Axiom, uso reale dei dataset, token/permessi e conservazione attuale.
2. Verificare che il bucket B2 EU e la chiave ad accesso limitato siano disponibili. Valutare Object Lock secondo le esigenze di integrità e cancellazione.
3. Eseguire i test `npm run test:logging-privacy` e `npm run test:axiom-archive`; GitHub Action `Logging and archive regression` li esegue sulla PR.
4. Effettuare un trasferimento di prova controllato di log sintetici o non personali, verificando hash, manifest, checkpoint e recupero dell'oggetto compresso.
5. Definire e documentare con responsabile privacy/DPO durate diverse per categoria e lifecycle/cancellazioni B2; evitare retention uniforme.
6. Solo dopo questi controlli, valutare l'attivazione di `AXIOM_ARCHIVE_ENABLED=true` su Render e gli avvisi in caso di fallimento/backlog.

**Non** modificare la retention, cancellare log o attivare il job soltanto sulla base di questo documento.
