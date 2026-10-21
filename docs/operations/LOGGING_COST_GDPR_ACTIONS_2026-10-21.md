# DEMOS — appunti operativi: log, GDPR, retention e costi
**Data:** 21 ottobre 2026 · **Stato:** ricognizione tecnica e piano di intervento. **Non è una retention policy approvata.**

## Decisioni e criteri
1. Conservare **Axiom** per interrogare i log recenti; usare **Backblaze B2 EU Central** per archivi storici **solo dopo verifica e attivazione controllata**.
2. Non moltiplicare account gratuiti: minimizzare la quantità di eventi raccolti, separare le finalità, misurare i volumi e utilizzare archivi compressi. Non ridurre i log di sicurezza indispensabili soltanto per risparmiare.
3. Il GDPR **non** stabilisce una conservazione indiscriminata di sei mesi, tre anni o sette anni per tutti i log. Applicare art. 5(1)(c),(e) (minimizzazione e limitazione della conservazione), art. 24, 25 e 32 (misure proporzionate e accountability), art. 9 per le opinioni politiche.
4. Il provvedimento del Garante del 27/11/2008, come modificato, prescrive **almeno sei mesi per i log degli accessi logici degli amministratori di sistema nei casi applicabili**, non per ogni richiesta degli utenti.
5. L'art. 2220 c.c. riguarda **scritture contabili** da conservare in generale per **dieci anni**, non audit log per sette anni. Non usarlo per giustificare la conservazione generalizzata di profili, voti o log.

## Architettura rilevata dal repository (non prova della configurazione live)
- Axiom, dataset `centralized_logs` e `real-time`: ricerca e analisi dei log recenti. I writer e i reader sono già presenti.
- Backblaze B2: bucket privato EU Central `demos-log-archive-eu` indicato come creato il 06/10/2026; endpoint e crittografia server-side documentati, **Object Lock disabilitato**. Verificare lo stato reale.
- Codice dell'archivio: `api/services/axiomArchiveService.js`, `api/jobs/axiomArchiveJob.js`, test `api/tests/axiomArchiveService.test.js`. Compressione gzip/JSONL, hash, manifest, checkpoint, verifica HEAD, categorie `technical`, `audit`, `security`.
- Il job è disattivo salvo `AXIOM_ARCHIVE_ENABLED=true`. **Non affermare che l'archiviazione in produzione sia attiva** finché la configurazione e un ripristino non saranno verificati.
- `api/services/centralizedLogger.js`: con Axiom abilitato non salva i log nel database; le eccezioni nell'invio HTTP erano ignorate. Prima mitigazione: rendere visibili gli errori di ingest con avvisi sintetici e limitati nel tempo. Questo **non è ancora uno spool durevole**.
- `GDPR_LOGGING_FILTER` e `NODE_ENV=production` sono previsti per evitare molti log ordinari. Controllare i valori **effettivi** in produzione, non presumere che `env.example` siano la realtà.
- La classe `dataRetentionService.js` contiene giustificazioni e durate non approvate (p.es. 7 anni per audit, 5 anni per voti; richiamo errato a 2220). `api/config/audit-config.js` cita invece 365 giorni di audit. **Non eseguire pulizie o sostituzioni di durate senza inventario, confronto codice e revisione privacy.**

## Retention — matrice da sottoporre a valutazione DPIA/DPO
I valori che seguono sono **ipotesi**, non prescrizioni generali; la policy va approvata per finalità e tipologia di dato e tradotta in controlli effettivi.
| Classe | Ipotesi da valutare | Finalità / note |
|---|---|---|
| Debug/trace e log tecnici non identificanti | 7–30 giorni | Risoluzione problemi; preferire anonimizzazione e campionamento |
| Errori applicativi | 30–90 giorni | Diagnostica; **redigere** messaggi e stack con potenziali dati sensibili |
| Sicurezza | 90–180 giorni (o più solo se giustificato) | Rilevamento e indagini, tenendo conto dell'analisi dei rischi |
| Accessi amministratori di sistema | almeno 6 mesi **quando applicabile** | Requisiti specifici del provvedimento Garante; integrità e verificabilità |
| Audit di accessi/modifiche a dati personali | Da definire con valutazione documentata | Principio di necessità, legittimità e conservazione proporzionata |
| Eventi con opinioni/voti associabili a utenti | Evitare di generarli se non indispensabili | Dati potenzialmente art. 9: non replicare nei log payload e preferenze |

**Le scadenze di conservazione vanno applicate anche in B2**, con cancellazioni/lifecycle documentati, gestione di richieste di cancellazione quando dovuta, eventuali blocchi di conservazione per contenziosi e verifica del ripristino. Non configurare una retention indiscriminata a sette anni.

## Costi, verifiche e soglie
- Axiom Personal: al controllo del 21/10/2026 il listino indica 500 GB/mese per data loading, 25 GB di storage, 30 giorni massimi di retention, 10 GB-hours di query compute. Controllare sempre i limiti dell'organizzazione concreta. Axiom Cloud parte da 25 USD/mese più utilizzo.
- B2: 6,95 USD/TB/mese di storage e primi 10 GB gratuiti, al netto di eventuali trasferimenti e operazioni oltre quote.
- **Non abbiamo ancora verificato:** piano Axiom reale, ingest giornaliero e mensile, spazio occupato, fallimenti 4xx/5xx, percentuale INFO/DEBUG, numero di eventi per utente, fatturazione e stato B2 reale. Nessuna proiezione utenti/costi è affidabile senza queste misure.
- Metriche per il dimensionamento: eventi/giorno per classe, byte medi/evento, compressione archivio, volume mantenuto in 30 giorni e in B2, tasso fallimenti ingest, ritardo tra evento e checkpoint, allarmi e integrità dell'ultimo ripristino.

## Interventi ordinati e criteri di conclusione
- **P0 — Tracciabilità ingest:** segnalare errori Axiom con messaggi **senza token, URL sensibili, payload o identificatori** e con rate limit. Test unitari per errore e throttling. Successivamente decidere se introdurre coda persistente/retry e allerta operativa separata: i log critici non devono andare perduti silenziosamente.
- **P0 — Integrità archivio:** verificare credenziali e bucket, produzione e flag. Primo run controllato soltanto dopo prova su dati sintetici e test. Verificare un oggetto compresso, hash, checkpoint e recupero; monitorare ogni ora backlog e fallimenti. **Niente abilitazione cieca in produzione**.
- **P1 — Retention e governance:** revisionare con responsabile privacy/DPO durata e scopo per ogni categoria, inclusi accessi admin; correggere `dataRetentionService.js`, `audit-config.js`, vecchi documenti e informativa, dopo avere allineato le decisioni. Eliminazioni solo dopo verifica archivi e approvazione.
- **P1 — Sicurezza:** valutare Object Lock/lifecycle con requisiti di cancellazione e integrità, ACL least privilege, regione UE, DPA/trasferimenti, audit accessi e minimizzazione IP/identificatori.
- **P2 — Costi:** eliminare eventi duplicati e log GET inutili, escludere segreti/dati politici dai messaggi, impostare budget e avvisi di avvicinamento ai limiti, misurare volumi per settimana prima di scegliere un piano a pagamento.
- **P2 — Qualità:** confrontare dati Axiom con fonti applicative per individuare buchi, testare backup/restore periodici, verificare che i log critici siano recuperabili e che le cancellazioni siano selettive.

## Fonti e punti nel progetto
- GDPR testo: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Garante 2008 amministratori di sistema: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/1577499
- Art. 2220 c.c.: https://www.normattiva.it/ (cercare Codice civile, art. 2220).
- Axiom piani: https://axiom.co/pricing ; limiti https://axiom.co/docs/reference/limits
- Backblaze B2: https://www.backblaze.com/cloud-storage/pricing
- Archiviazione già progettata: `docs/operations/axiom-b2-log-archive.md`.
- Configurazione precedente: `CONFIGURAZIONE_LOG_PRODUZIONE.md`. Parti narrative storiche **non** certificano che il job sia attivo.

## Aggiornamento verifica — 21/10/2026
- PR di lavoro: https://github.com/Nictolas/DemosApp/pull/217 (bozza, **non distribuita**).
- `LOG_LEVEL` viene normalizzato senza distinzione maiuscole/minuscole; audit/security espliciti non vengono omessi da filtri di verbosità. Gli eventi Axiom hanno `log_type` esplicito e il classificatore dell'archivio riconosce anche alcune forme legacy.
- Gli invii falliti ad Axiom generano un segnale minimo e rate-limited; resta **da implementare** una coda durevole per garantire continuità se il provider non è disponibile.
- Aggiornamento mirato `follow-redirects` da 1.16.0 a **1.16.1**, versione con correzioni per GHSA-q3jh-wrc6-jgq8 / GHSA-8r9p-f939-6h3c. Pinned con override e lockfile.
- Nuova GitHub Action `Logging and archive regression`, eseguita su PR: installazione da lockfile, sintassi, test `test:logging-privacy` (**9 superati**), `test:axiom-archive` (**12 superati**), `npm audit --omit=dev --audit-level=high` (**0 vulnerabilità per dipendenze di produzione API**, alla data della verifica).
- CI generale `Security Agent Validation` conclusa con **success**; controllo Snyk del commit di test **success**.
- I test usano mock per Axiom/B2: confermano logica e protocolli locali, **non** equivalgono a una prova di export/restore contro provider reali.
- Aggiornato anche `CONFIGURAZIONE_LOG_PRODUZIONE.md` per evitare che la creazione del bucket B2 venga descritta erroneamente come archiviazione in esercizio.
- **Blocco residuo prima dell'attivazione:** credenziali/flag in produzione e prova controllata contro il vero Axiom e il vero bucket Backblaze, senza cancellazioni; retention da approvare con privacy/DPO. Conservare i log esistenti.


## Ricognizione aggiuntiva — audit transport e database, 21/10/2026
- Identificato un secondo writer `api/services/auditService.js`. Prima della correzione avviava il POST Axiom in fire-and-forget, non attendeva alcun acknowledgement, e riportava comunque un "audit log inviato" includendo l'ID utente in console. Il POST poteva fallire silenziosamente.
- Nella PR #217 ora `AuditService.logAction()` attende l'esito HTTP (timeout limitato a 5 secondi); se fallisce restituisce `null` e produce una segnalazione minimale e rate-limited. Non dichiara più una consegna inesistente, non include più l'ID dell'utente nei messaggi di successo.
- Nuovo writer `api/utils/axiomAuditEvent.js`: marca `log_type=audit`, conserva i campi di audit previsti, non genera identificatori pseudo-sessione dal semplice ID utente, rifiuta i messaggi di errore testuali non conformi al formato di un codice breve e non esporta `details` con potenziali preferenze politiche.
- Controlli **con finti provider, senza dati personali**: test HTTP per POST riuscito, HTTP 403 e credenziali assenti; test di minimizzazione del payload, tag e filtri. GitHub Action `Logging and archive regression` #8: **success**, 15/15 test logging e 12/12 test archivio, audit npm produzione API 0 vulnerabilità. GitHub Action generale `Security Agent Validation` #144: **success**.
- Verifica **sola lettura** su Supabase produzione `wxnblcqoyjqxktwkcqok`: nello schema `public` non risultano tabelle `audit_logs`, `audit_logs_compressed` o `centralized_logs`; esistono soltanto tabelle di configurazione/stato come `log_retention_config`, `logging_config`, `logging_jobs`, `logging_stats`. Nessun record personale è stato letto, nessuna tabella modificata.
- **RISCHIO RESIDUO P0:** Se Axiom rifiuta o perde la richiesta, il singolo evento audit può andare perso. Aspettare l'acknowledgement e mostrare l'errore **non sono** una garanzia di consegna. NON fare affidamento su un inesistente fallback PostgreSQL.

### Specifica preliminare di consegna affidabile (non ancora implementata)
1. Progettare una **outbox server-side** per i soli eventi audit e security essenziali (non tutti i log tecnici), in schema PostgreSQL non esposto al Data API; payload strettamente minimizzato, dimensione massima, timestamp, categoria, stato, tentativi, prossimo retry e deduplicazione. Garantire la base giuridica e la cancellazione dopo consegna e scadenza.
2. Commit locale dell'evento prima di restituire un esito positivo di registrazione; invio asincrono tramite worker con retry esponenziale e jitter, limite tentativi, circuit breaker, e `FOR UPDATE SKIP LOCKED` / lock scadibili per più istanze; nessun log personale nel testo dell'errore.
3. In caso di fallimento definitivo, mantenere l'evento in dead-letter accessibile solo ad amministratori autorizzati e generare un **alert indipendente da Axiom**.
4. Metriche senza PII: lunghezza coda, evento più vecchio, numero consegnati/scartati, periodo di ritardo, failure rate. Allarmi per crescita fuori soglia; limiti di archiviazione e costi Supabase. Praticare restore/riconciliazione contro Axiom.
5. Implementazione e test con mock/staging **prima** di creare nuove tabelle nel database di produzione; controllare RLS/privilegi e assenza di accesso `anon`/`authenticated`. Non cancellare o migrare archivi esistenti.

### Blocco accesso provider
- Il connettore Render riconosce il workspace `Nicolas`, ma **richiede che l'utente lo selezioni esplicitamente** prima di accedere a servizi e variabili. Nessun servizio Render né configurazione live Axiom/Backblaze sono stati interrogati con questo accesso.
- Non esiste in questa sessione un connettore collegato che consenta di verificare direttamente l'account Axiom o il bucket Backblaze. La presenza del codice e dei dati del bucket nella documentazione non prova che i log siano archiviati.

## CORREZIONE DELLO STATO LIVE — VERIFICA RENDER 21/10/2026
> Questa sezione **sostituisce** ogni precedente affermazione del documento secondo cui il job Axiom → B2 fosse non attivo o ancora da abilitare.

Con consenso esplicito del proprietario è stato selezionato il workspace Render **Nicolas** (`tea-d2gs3eadbo4c73ag95rg`). Il servizio di produzione è `demos-backend`, ID `srv-d2gt3dodl3ps73fmereg`, regione Frankfurt, piano Render Free, istanza singola, ramo `main` con auto-deploy. Al 21/10/2026 il deploy live è il commit `d80c1b90ca412e78af60621485f8ec825ad53210`, pubblicato il 20/10/2026.

**Risultato:** il job **è già attivo**. All'avvio del deploy del 20/10 Render ha emesso `Axiom archive job enabled (17 * * * * UTC)`. Nei log applicativi dal 20/10 alle 12:00 UTC al 21/10 alle 12:00 UTC compaiono **25 completamenti** (inclusa una prima esecuzione post-deploy) per `centralized_logs` e `real-time`, ogni ora al minuto 17. In quella finestra i batch dichiarano di avere trattato complessivamente **529 record technical, 7 audit, 0 security**, senza backlog riportato (`caughtUp=true`). La sovrapposizione intenzionale delle finestre rende questi valori **conteggi di elaborazione, non dati unici** e non consente di calcolare il volume in byte. Ricerca esatta `Axiom archive failed` nei log dell'ultima settimana: **nessuna corrispondenza**, non una garanzia assoluta di assenza di errori.

Il codice `putVerifiedObject()` esegue PUT B2, HEAD con hash SHA-256 e verifica della lunghezza **prima di avanzare il checkpoint**; i completamenti indicano che questa procedura è stata eseguita senza errori emersi. Rimane **non verificato** il recupero indipendente (`GetObject` da bucket B2, controllo manifest e decompressione completa) e il lifecycle/retention configurato direttamente su Backblaze. Non è stato modificato alcun dato, segreto, job o flag di Render: **non abilitare un secondo job né azzerare i checkpoint**.

**Problema privacy live:** nei log Render sono state individuate **quattro** righe generate da `api/services/auditService.js` che includono un identificatore utente nel messaggio di falso successo `Audit log inviato ad Axiom`. Non riportare gli ID personali negli appunti. La PR #217 già sostituisce il messaggio e attende l'acknowledgement HTTP prima di dichiarare un successo. La patch è verificata in CI ma **non distribuita** sul servizio.

**Rischi residui:** il job è legato a una singola istanza web Render Free, quindi può ritardare se il processo si sospende; servono monitoraggio sul checkpoint/ritardo, verifica restore, policy di retention approvata e outbox durevole per i soli eventi critici prima di dichiarare la filiera affidabile. L'attuale connettore Render consente leggere metadati, deploy, metriche e log, ma **non espone** un'azione per leggere i valori delle variabili d'ambiente o interagire direttamente con gli oggetti Backblaze. Non inferire credenziali o lifecycle dalle evidenze Render.

Dashboard del servizio: https://dashboard.render.com/web/srv-d2gt3dodl3ps73fmereg

### Strumento read-only di verifica B2 — PR #217

- Aggiunto `AxiomArchiveService.verifyLatestArchiveBatch(dataset)` per controllare in **sola lettura** l'ultimo checkpoint B2, il manifest collegato e tutti i `.jsonl.gz` dell'ultimo batch, confrontando hash SHA-256, impronte dei singoli eventi e totale per categoria.
- Comando locale/in ambiente autorizzato: `cd api && npm run archive:axiom:verify-latest -- centralized_logs`; ripetere con `real-time`. **Non** modifica il checkpoint, non interroga Axiom, non carica o cancella oggetti.
- L'output contiene soltanto nome dataset, orario del checkpoint, numero oggetti/eventi verificati e conteggi per categoria; non include corpi di eventi, user ID, segreti o URL completi.
- Test di successo con B2 in memoria, manifest manomesso e checkpoint assente. **CI Logging and archive regression #11: success**, 15/15 test logging + **15/15** test archivio, `npm audit --omit=dev --audit-level=high`: 0 vulnerabilità API produzione, verificato da GitHub Actions. La prova di recupero con credenziali del vero bucket **resta da eseguire**.
- [Procedura operativa](../operations/axiom-b2-log-archive.md).
