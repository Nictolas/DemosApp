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
