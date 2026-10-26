# DEMOS — Inventario provider GDPR e decisione GO/NO-GO (26 ottobre 2026)

**Stato: NO-GO.** Questo inventario è stato raccolto esclusivamente tramite metadati in sola lettura dei connettori Render e Supabase, e verifica SQL aggregata dei cataloghi PostgreSQL; **non** costituisce attestazione di quarantena, autorizzazione a effettuare recovery, prova che una Data API sia disabilitata o prova di assenza di connessioni esterne. Issue #296 OPEN. Tutte le PR collegate restano DRAFT.

## Topologia osservata, non isolamento verificato

| Superficie | Evidenza osservata in sola lettura | Conseguenza / prova mancante |
| --- | --- | --- |
| Render | 11 servizi DEMOS: 10 web service e 1 static site; risultano tutti `not_suspended`. I 10 web service esaminati hanno `maintenanceMode.enabled=false`; lo static site non riporta lo stesso campo. | Non esiste prova di blocco degli ingress e delle istanze. Il campo manutenzione HTTP non isola PostgreSQL. |
| Backend Render di produzione | `demos-backend`, branch `main`, `rootDir=api`, comando `node index.js`, `autoDeploy=yes`, una istanza. | Prima di recovery serve sospensione/isolamento verificato, prevenzione dei redeploy automatici e drenaggio di eventuali operazioni in corso. |
| Staging Render | `demos-functional-staging`, `demos-security-staging`, sonde HTTP, backup B2, outbox, security gates e altre sonde; attivi in Render. | Il connettore consultato non ha attestato a quali database o credenziali siano realmente collegati. Considerare **sconosciuto** ogni eventuale accesso al DB di produzione finché non verificato separatamente. |
| PostgreSQL Render | `demos-civic-staging-db`, PostgreSQL 17 disponibile, separato dai progetti Supabase elencati. | La presenza del database non prova che i servizi staging usino esclusivamente questo database. |
| Supabase `Demos` | Progetto di produzione `ACTIVE_HEALTHY` in `eu-central-1`, PostgreSQL 17. | Stato della **Data API** non disponibile dai metadati letti. Anche una Data API disattivata non bloccherebbe i client PostgreSQL diretti. |
| Supabase `Demos-Staging` | Progetto `ACTIVE_HEALTHY`; nessuna tabella rilevata nello schema `public`. | Non assumere che staging sia un clone operativo o che la sua connessione sia indipendente dal DB di produzione. |
| Supabase, cataloghi DB produzione | 112 tabelle `public`, RLS attivo su tutte 112. Nessun privilegio tabellare diretto SELECT/INSERT/UPDATE/DELETE rilevato per `anon` o `authenticated`. | Sono controlli utili, **non** una prova che non esista una API pubblica, un servizio privilegiato, un endpoint su altri schemi o una connessione diretta. |
| Supabase, funzioni `public` | 76 funzioni; 72 hanno `EXECUTE` per `anon` e `authenticated`, 46 delle funzioni eseguibili da `anon` sono classificate `VOLATILE`; nessuna è `SECURITY DEFINER`. | L'eseguibilità non dimostra esposizione REST/RPC né possibilità di modifica dati: controllare esposizione Data API, privilegi effettivi e le singole funzioni. |
| Edge / scheduler Supabase | Nel precedente controllo entrambi i progetti non avevano Edge Functions né le estensioni `pg_cron`/`pg_net` installate. | Non esclude trigger ordinari, Realtime, Auth, Storage, funzioni SQL o client esterni. Riconfermare alla data del recovery. |

Nei servizi web Render è stata osservata una lista di ingresso HTTP che comprende `0.0.0.0/0`. **Questo riguarda l'ingresso web: non è una misura né una prova di accessibilità del database.** Nessuna credenziale, token, riga personale o contenuto di log è stato recuperato in questo audit.

## Quarantena reale richiesta prima di restore o replay

1. **Autorizzazione incidente:** titolare responsabile, operatore e DPO definiscono finestra, backup di riferimento, recovery ID, impatto del downtime, canale di coordinamento e criterio di annullamento. Conservare attestazioni senza dati personali e segreti.
2. **Registro esterno indipendente:** richiedere una prova di completezza/freschezza degli eventi GDPR successivi al backup che non dipenda soltanto dal database da ripristinare; manifest firmato, digest/timestamp approvati su canale separato, ricevute versionate B2 e Object Lock ancora valido. Se non dimostrabile: **NO-GO**.
3. **Render e front-end:** individuare tutte le istanze, cron/worker, siti statici, preview, processi staging, code e ingress; identificare quali usano davvero credenziali di produzione. Fermare/isolarsi secondo playbook approvato e verificare la cessazione delle nuove attività; sospendere i redeploy automatici quando applicabile. Non considerare `DEMOS_PRIVACY_RECOVERY_MAINTENANCE=true` o Render maintenance HTTP una quarantena sufficiente.
4. **Supabase Data API:** un operatore autorizzato verifica in Dashboard *Integrations → Data API* se l'API è abilitata. Durante il recovery, se esiste accesso diretto REST/GraphQL, usare il controllo ufficiale **Enable Data API** secondo il piano approvato e verificare la mancata accessibilità con una prova non sensibile autorizzata. L'informazione non è stata letta da questo audit. Documentazione: https://supabase.com/docs/guides/api/securing-your-api
5. **Altri ingress Supabase:** isolare o mettere in pausa come approvato accessi PostgreSQL diretti e pooler, Data API, Realtime, Storage/Auth dove possono toccare stato ripristinato, client CI/CD, amministrazione, ruoli di servizio, webhook, processi esterni, app mobile e terzi. Le restrizioni di rete DB non bloccano necessariamente Data API o servizi gestiti: richiedere prove *specifiche per il canale*. Non invocare operazioni pericolose dal solo controllo automatizzato.
6. **Verifica indipendente di silenzio:** durante il fermo usare evidenze provider e osservazioni aggregate/anonimizzate per dimostrare assenza di nuovi ingress, scritture e operazioni in volo. Qualunque fonte sconosciuta = **NO-GO**. La presenza di un singolo worker, client SQL o servizio staging non identificato impedisce il ripristino.
7. **Restore isolato e transazionale:** preferire destinazione disgiunta; accertare che l'opzione backup/PITR sia realmente disponibile nel piano Supabase e non assumere un'inesistente produzione Neon. Eseguire firma/cutoff/replay già testati soltanto con flusso offline approvato. Validare effetti su cancellazioni, revoche e re-grant senza resurrezione dei dati storici.
8. **Readiness esterna e attestation:** lettura di **tutte** le versioni immutabili B2 richieste, verifica outbox/ledger in entrambe le direzioni, checksum, retention, replay idempotente, stato dell'isolamento e approvazione finale titolare/DPO. I contatori aggregati sono evidenza parziale, non autorizzazione.
9. **Riapertura controllata:** soltanto con autorizzazioni documentate; riabilitare ingress e job in ordine deliberato, osservare errori/duplicazioni e mantenere un piano di rollback che ripristini la quarantena in caso di regressione.

## Stato della decisione, al 26 ottobre 2026

**NO-GO / non verificato:** Data API abilitata/disabilitata; isolamento effettivo degli endpoint Supabase; connessioni dirette PostgreSQL e pooler; legame credenziali tra staging e produzione; arresto verificato di tutti i worker e richieste in corso; completezza/freschezza indipendente del ledger esterno dopo un possibile guasto; approvazioni DPIA/titolare/DPO. Il progetto produzione e le istanze Render sono osservati attivi. Nessun restore o test di mancata accessibilità è stato eseguito sulla produzione.

**Non eseguire automaticamente sospensioni, modifiche RLS/GRANT, disabilitazioni Data API, rotazioni credenziali, revoche SQL o deploy:** richiedono un playbook operatore approvato. La CI con dati sintetici non può convertire questi elementi mancanti in una dichiarazione di isolamento.

## Offline evidence preflight: completezza, non attestazione (26 ottobre 2026)

Il modulo puro `api/services/privacyRecoveryQuarantineEvidenceGate.js` consente di controllare in modo riproducibile la *completezza formale* di una futura raccolta di attestazioni operatore. Non contatta servizi, non interroga SQL, non muta dati e **non certifica la verità delle attestazioni**.

Richiede 15 controlli separati su Render ingress/worker/attività in corso/staging, Supabase Data API e prova di blocco, PostgreSQL+pooler e prova di blocco, altri endpoint Supabase, client esterni/CI, backup cutoff, freschezza indipendente del ledger, B2 immutable readback e autorizzazioni titolare/DPO. Ogni prova deve riferirsi all'ID recovery giusto, allo scope produzione, alla sorgente indicata, a un riferimento opaco senza segreti e avere età massima di 15 minuti (tolleranza orologio futuro 60 secondi). Informazioni mancanti/contraddittorie/scadute restituiscono `NO_GO` con codici senza PII. Anche quando tutte le caselle sintetiche risultano compilate correttamente, l'output è solo `MANUAL_INDEPENDENT_REVIEW_REQUIRED` — **mai GO o autorizzazione a riaprire**.

Un JSON auto-compilato può essere falso: la verifica della reale quarantena e la firma/approvazione esterna sono attività umane e infrastrutturali. **Il preflight non è collegato automaticamente al replay PostgreSQL** e non deve essere spacciato come barriera di produzione. L'issue #296 resta OPEN.

## Evidenza integrativa di catalogo e connessioni (26 ottobre 2026)

Una successiva lettura esclusivamente aggregata di `pg_stat_activity` su Supabase produzione ha rilevato, nell'istante del controllo, **5 client PostgreSQL**, **1 attivo**, **3 indirizzi distinti** e nessuna sessione `idle in transaction`. Non sono stati letti indirizzi IP, SQL delle sessioni o nomi applicativi. **È soltanto un campione istantaneo:** non identifica quali servizi siano collegati, né prova assenza di scritture in altri momenti.

Il catalogo delle **72 funzioni `public` con EXECUTE per `anon`** include funzioni nominali per ricerca log (`find_logs_by_ip`, `find_audit_logs_by_ip`, ecc.), alcune funzioni di sincronizzazione e funzioni di estensioni. **Nessuna è SECURITY DEFINER.** Le sole firme/volatilità non provano esposizione RPC, capacità di accedere alle tabelle o vulnerabilità: esaminare autorizzazioni ed esposizione reale prima di trarre conclusioni o modificare GRANT.

## Vincoli cronologici del preflight offline (26 ottobre 2026, Draft)

Il preflight non può più considerare formalmente completo un pacchetto di prove nel quale il checkpoint di **freschezza indipendente del ledger** è precedente o simultaneo all'ultima osservazione dell'isolamento degli ingress e worker Render, Data API/PostgreSQL/pooler/endpoint gestiti Supabase, client e CI esterni, mappatura credenziali staging o all'approvazione del cutoff del backup. Il readback B2 deve essere successivo al checkpoint del ledger; le approvazioni titolare/DPO devono seguire il readback B2. Prove con ordine errato producono `NO_GO` e un codice `OUT_OF_ORDER`, senza esporre ID, indirizzi o dettagli. I 15 controlli richiedono inoltre **riferimenti opachi distinti**, per evitare il riutilizzo della stessa evidenza come attestazione di più canali indipendenti; ripetizioni producono `REUSED_REFERENCE`.

Questi controlli verificano **soltanto la coerenza delle date dichiarate dall'operatore**. Non certificano che i provider siano effettivamente isolati, che non ci siano state nuove scritture dopo il cutoff, che il ledger sia completo o che le prove siano autentiche. Anche con ordine corretto, il risultato resta `MANUAL_INDEPENDENT_REVIEW_REQUIRED`; nessuna riapertura/restore automatico. Un'osservazione della dashboard non basta per provare l'arresto di processi remoti.

## Firme per singola attestazione e trust pin esterni (26 ottobre 2026 — DRAFT)

`api/services/privacyRecoverySignedEvidenceGate.js` e `api/tests/privacyRecoverySignedEvidenceGate.test.js` introducono un **preflight crittografico separato, offline e opzionale** che richiede firme Ed25519 valide per ciascuna delle 15 attestazioni. La firma include (formato canonico e dominio `DEMOS_GDPR_QUARANTINE_EVIDENCE_V1`) recovery ID, nome del controllo, origine, ambiente, timestamp, flag dichiarato, riferimento opaco, SHA256 del documento probatorio e identità attestor. Sono vietati replay tra controlli, cambio di sessione, manomissione timestamp/digest e campi aggiuntivi non firmati. Ogni categoria di origine deve avere **chiave pubblica distinta**; per ciascuna serve un'impronta SPKI SHA256 approvata indipendentemente. Le chiavi contenute nel medesimo pacchetto di evidenze non costituiscono un canale fidato e **non vengono consultate** dal verificatore. I test generano solamente chiavi temporanee sintetiche.

**Vincoli e responsabilità:** questo codice NON carica le prove dai provider né calcola il digest dell'oggetto originale: un verificatore esterno deve confrontare i byte originali con `evidenceSha256`, controllare indipendentemente provenienza delle chiavi, effettiva quarantena Render/Supabase e completezza del ledger. Un firmatario può mentire o essere compromesso; una firma valida prova soltanto integrità rispetto a una chiave fidata, non verità del contenuto. Anche tutte le firme valide restituiscono soltanto `MANUAL_INDEPENDENT_REVIEW_REQUIRED`, **mai GO**. Il modulo non è integrato nell'endpoint HTTP, in una procedura di restore o nel percorso di produzione. NO-GO invariato, issue #296 OPEN.

## Confronto byte-per-byte delle prove originali (26 ottobre 2026 — DRAFT)

Il controllo offline aggiuntivo `api/services/privacyRecoveryOriginalEvidenceGate.js` confronta le impronte SHA-256 dei **byte originali** forniti da un operatore autorizzato con i digest contenuti nelle 15 attestazioni verificate con Ed25519. Verifica prima firme, chiavi indipendentemente autorizzate, coerenza temporale e completezza. Un singolo documento mancante, manomesso, vuoto, fornito come testo/base64 invece di Buffer o riutilizzato per controlli separati produce `NO_GO`. Rifiuta anche campi estranei, getter e file oltre 4 MiB ciascuno / 16 MiB in aggregato (limiti difensivi per l'analisi offline). I risultati includono **solo contatori e codici di errore non sensibili**, non i documenti originali.

**Limite fondamentale:** l'applicazione non scarica né autentica autonomamente documenti da Render o Supabase. Devono essere acquisiti tramite canale provider attendibile e preservati senza conversione, normalizzazione del testo o screenshot manipolati. Il modulo può dimostrare che i byte esaminati corrispondono al digest **firmato**, ma non prova che quei byte siano veramente originari del provider o che attestino un isolamento valido. La catena di fiducia degli attestatori, le restrizioni provider reali, le versioni B2 e l'indipendenza/freschezza del ledger devono essere verificate separatamente. **Il miglior esito resta `MANUAL_INDEPENDENT_REVIEW_REQUIRED`, mai GO**. Nessun accesso ai provider né ripristino operativo.


## Seconda ricognizione provider in sola lettura (26 ottobre 2026)

**Dati osservati:** connettori ufficiali Render `list_services(includePreviews=true)` e Supabase `get_advisors(type=security)`, `list_edge_functions`, `list_extensions`. Nessuna credenziale, query su righe utenti, modifica dei servizi, rotazione o richiesta di restore. La ricognizione è un'istantanea **ante-quarantena**: non si può riutilizzarla come prova di isolamento operativo.

### Render: perimetro dei deploy

| Gruppo | Servizi rilevati | Stato osservato | Implicazione per recovery |
| --- | --- | --- | --- |
| Produzione (API) | `demos-backend` | branch `main`, `rootDir=api`, `autoDeploy=yes`, non sospeso, manutenzione Render web disattivata | Verificare il blocco di ingress, dei job già avviati e dei redeploy automatici durante l'intero recovery |
| Produzione (web) | `demos-frontend` | branch `main`, `rootDir=client`, `autoDeploy=yes`, non sospeso | Isolare anche client e cache che potrebbero continuare a inviare richieste; il sito statico non equivale al DB |
| Staging e sonde | 9 altri servizi (sondaggi OP37, B2 readonly, outbox readonly, P07 dry-run, first four playbooks, action-runner sandbox, security gates, functional staging, security staging) | tutti `autoDeploy=no`, non sospesi; manutenzione web disattivata dove applicabile; `demos-security-gates-staging` segue `main` | `autoDeploy=no` non significa processi arrestati né credenziali isolate. Verificare per **ciascuna istanza** se possiede URL/token/connessioni di produzione, senza esportare segreti |
| Tutto il workspace Render | 11 servizi (10 web service, 1 static site) | tutti attivi/non sospesi nell'istante della verifica | Non è stata attestata alcuna quarantena in corso |

**Assenza di conferma:** nessuno dei comandi di lettura utilizzati espone in modo attestabile una matrice affidabile `servizio → destinazione DATABASE_URL/SUPABASE_URL` senza gestione protetta dei segreti. Il vero collegamento staging/produzione resta `UNKNOWN` e non può essere dedotto dal nome, dal ramo Git, da un banner `readonly` o dalla documentazione della sonda. Render web maintenance non interrompe necessariamente connessioni SQL già aperte. I controlli sopra sono una fotografia, non una validazione del comportamento a servizi fermati.

### Supabase: risultati di sicurezza e scheduler

| Controllo | Produzione `Demos` | `Demos-Staging` | Interpretazione |
| --- | --- | --- | --- |
| Edge Functions via API amministrativa | **0** | **0** | Nessuna Edge Function registrata al momento della richiesta; non esclude client, storage, Auth, Realtime o altri worker |
| Estensioni `pg_cron` / `pg_net` installate | **0 / 0** | **0 / 0** | Nessun job che dipenda da tali estensioni installate rilevato; non esclude trigger o schedulazioni esterne |
| Advisor security: `rls_enabled_no_policy` | `INFO`: **112** tabelle | Nessun avviso | Tutte le tabelle `public` osservate hanno RLS; nessuna policy è indicata dal linter. **Non è automaticamente una vulnerabilità**: con RLS senza policy, l'accesso dei ruoli soggetti a RLS è normalmente negato. La scelta può essere intenzionale per un backend con credenziali privilegiate |
| Advisor security: `extension_in_public` | `WARN`: **3** (`pg_stat_statements`, `pgcrypto`, `unaccent`) | Nessun avviso | Hardening potenziale da valutare separatamente, senza spostamenti/rimozioni di estensioni in produzione |
| Switch *Enable Data API* e accesso RPC pubblico | **NON VERIFICATO** | **NON VERIFICATO** | Gli advisor e i cataloghi SQL **non** attestano lo stato dell'interruttore Dashboard, né il comportamento dei singoli endpoint |
| Isolamento connessioni PostgreSQL dirette e pooler | **NON VERIFICATO** | **NON VERIFICATO** | Un conteggio momentaneo delle sessioni non prova il blocco del collegamento, né l'assenza futura di nuovi client |

Documentazione degli avvisi Supabase: [RLS senza policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [estensioni nello schema public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).

### Checkpoint GO/NO-GO dopo la ricognizione

- **Migliorata la conoscenza del perimetro, non lo stato della quarantena.** Si sono identificati 11 servizi, 2 auto-deploy di produzione, 0 Edge Functions e 0 scheduler `pg_cron/pg_net` installati. Questa scoperta non attesta alcun arresto.
- **Ancora obbligatori per un GO operativo:** conferma separata dello stato e dell'isolamento della Data API, mappatura attestata dei collegamenti staging→DB di produzione, quarantena/rete/pooler/worker, prova di assenza di scritture in volo e di nuove scritture, attestazione indipendente della completezza degli eventi GDPR, ricevute B2 immutabili e approvazione titolare/DPO.
- **Verdetto: NO-GO.** Nessun dato di questa sezione può essere usato come `verified: true` nelle 15 attestazioni di quarantena: le condizioni di isolamento non sono state materialmente esercitate.
