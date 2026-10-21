# DEMOS — Proposta di conservazione della coda audit (21 ottobre 2026)

**Documento per approvazione privacy e sicurezza: NON è una retention in vigore.**
Non applicare cancellazioni, politiche automatiche né modifiche al database
di produzione sulla base di queste durate. Serve validazione del titolare e,
se nominato, del DPO/consulente privacy, con finalità e necessità documentate.

## Finalità e ciclo di vita

L'outbox non è un archivio storico autonomo: serve a conservare **temporaneamente**
gli eventi audit e, in una fase successiva, sicurezza non ancora confermati
da Axiom. Dopo ACK di Axiom, il record della coda viene eliminato; la
conservazione nel dataset Axiom e nell'archivio Backblaze B2 è una **policy
separata**, da definire in base a finalità, categorie e accessi.

Il payload è limitato a 2 KiB, con `log_type` e `axiom_delivery_id` stabile.
Non salvare request body, dettagli liberi, token, password, email o messaggi
di errore non controllati. `user_id` e `ip_address` potrebbero essere dati
personali: confermare se entrambi sono indispensabili e documentare eventuale
anonimizzazione o hashing prima di abilitare `AUDIT_OUTBOX_ENABLED`.

## Proposta delle soglie per la revisione

| Stato | Intervento operativo | Proposta da valutare, non attiva |
| --- | --- | --- |
| `pending` | Retry automatici; avviso se l'evento più vecchio attende 15 minuti | Riesame degli eventi persistenti dopo 24 ore; obiettivo di risoluzione entro 7 giorni, senza auto-cancellazione |
| `sending` | Lease 90 secondi; scaduto, l'evento torna recuperabile da un altro worker | Indagare quando il lease rimane scaduto ripetutamente; nessuna cancellazione |
| `dead_letter` | Dopo 8 tentativi senza ACK; allarme admin, conservazione non interrotta | Presa in carico dell'incidente entro 72 ore; valutare limite fino a 30 giorni **soltanto** se motivato e approvato, con esportazione/verifica dell'esito prima di qualsiasi eliminazione |
| Consegnato ad Axiom | DELETE della riga in outbox solo dopo conferma HTTP; possibili duplicati at-least-once | Applicare separatamente retention Axiom/B2, non ereditare quella dell'outbox |

**7 e 30 giorni non sono requisiti imposti indistintamente dal GDPR.**
Sono ipotesi operative da discutere; il principio di limitazione della
conservazione richiede una durata commisurata alla finalità e documentata.
Conservare gli eventi più a lungo per incidenti aperti richiede una
motivazione, accessi ristretti e un termine di riesame.

## Protezioni economiche e di accesso

- Capacità predefinita: 5.000 righe, con massimo configurabile 10.000.
  Include `dead_letter`; nessuna eliminazione opportunistica alla saturazione.
- Limite di 2 KiB per singolo evento JSON, esclusi overhead di riga e indici
  PostgreSQL: **5.000 × 2 KiB = circa 9,8 MiB di solo payload al massimo
  teorico**, non una previsione delle dimensioni totali del database,
  delle WAL, dei backup o delle spese.
- Schema privato `demos_private`, RLS abilitata, accesso negato ai ruoli
  `anon`/`authenticated`, solo credenziale Postgres dedicata al backend.
- Avvisi senza PII quando `dead_letter > 0`, occupazione ≥80% o attesa ≥15m.
  La notifica amministrativa usa `OperationalAlertService` (DB in-app +
  FCM se configurato), **non Axiom né l'email disabilitata**.
- Notifica amministrativa attiva soltanto con
  `AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED=true` e con i due flag dell'outbox;
  le notifiche richiedono admin destinatari e un DB funzionante.
- Avvisi di stato ripetuti al massimo ogni ora dopo successo, tentativo
  rinnovabile dopo 5 minuti se consegna fallita. Niente dump del payload.

## Decisioni necessarie prima del rollout

1. Approvare categorie, campi personali ammessi, fonte dei dati, ruoli e
   finalità; confermare se `ip_address` e `user_id` debbano entrare
   nell'outbox o essere ulteriormente minimizzati.
2. Fissare retention effettive per `pending` e `dead_letter`, con eventuali
   eccezioni motivate, registro degli incidenti e approvazione di cancellazione.
3. Verificare su uno staging Supabase indipendente permessi, RLS, Data API,
   soglie, indici, riavvio e doppio worker; il PostgreSQL temporaneo CI non
   replica automaticamente la configurazione reale Supabase.
4. Provare allarmi verso destinatari admin di test e verificare il recupero
   quando FCM non è disponibile. In caso di indisponibilità dell'intero DB o
   del backend Render, il solo servizio interno non può garantire l'avviso:
   valutare un controllo esterno delle disponibilità.
5. Verificare deduplicazione e integrità dei record `axiom_delivery_id`
   nell'archivio downstream prima di dare per completa la garanzia at-least-once.
6. Stabilire runbook per `OUTBOX_CAPACITY_EXCEEDED`: indagare causa,
   riabilitare consegna, riesaminare i dead-letter con autorizzazione
   esplicita; **non** svuotare la tabella per sbloccare temporaneamente il servizio.

**Stato tecnico:** nessuna retention automatica o cancellazione dei
`dead_letter` è stata implementata; questa scelta è intenzionale finché
non esiste una policy formalmente approvata.
