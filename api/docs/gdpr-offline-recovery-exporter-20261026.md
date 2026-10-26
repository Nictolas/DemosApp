
# DEMOS — Esportatore GDPR offline durante recovery (solo DRAFT)

**26 ottobre 2026. Non collegato a Express, worker ordinario, cron, deploy né CLI. Nessuna credenziale o dato reale è stato usato nei test.**

## Scopo

Dopo un restore di PostgreSQL in isolamento, un evento GDPR recuperato da un manifesto firmato e riconciliato nel ledger/outbox potrebbe essere ancora in attesa della ricevuta B2. Il worker normale è volutamente bloccato dalla manutenzione (#325). Questa classe offline separata prepara un'esportazione esplicita, a batch limitato, che non richiede di riaprire gli ingressi pubblici.

Codice: api/services/privacyOfflineRecoveryExporter.js; classe PrivacyOfflineRecoveryExporter e metodo runOnce(pool, options). Nessuna route HTTP, scheduler, bootstrap o comando automatico li richiama. **Disabilitato di default**.

## Preflight prima di SQL/B2

- Variabili locali **esattamente** DEMOS_PRIVACY_RECOVERY_MAINTENANCE=true, GDPR_ERASURE_OUTBOX_ENABLED=true, GDPR_ERASURE_RECOVERY_OFFLINE_EXPORT_ENABLED=true. Il flag del worker ordinario GDPR_ERASURE_OUTBOX_WORKER_ENABLED deve essere assente o esattamente false. Qualsiasi altro valore blocca.
- maintenanceConfirmed e quarantineConfirmed devono essere true come dichiarazioni dell'operatore; da sole non attestano il freeze infrastrutturale.
- Manifesto di ripristino firmato (HMAC), recoveryId atteso, digest SHA-256, timestamp di backup/cattura approvati **indipendentemente** e forniti da fonte esterna affidabile. Per recovery reale non derivare il digest dall'input da verificare.
- Pool PostgreSQL con client dedicato, exporter B2 configurato e batch da 1–20.
- Ledger e outbox preinstallati; il registro locale deve includere tutte e soltanto le chiavi del manifesto, senza outbox orfane o ledger senza outbox.
- Per ogni evento in coda, chiave, soggetto, tipo, timestamp e dettagli devono coincidere col manifesto firmato **prima di PUT**.
- B2 deve restituire eventKey, VersionId, SHA-256 corrispondente al JSON canonico dell'evento e retentionUntil futura. Non vengono effettuate cancellazioni o modifiche schema.
- Il flag manutenzione viene controllato prima/dopo B2 e prima del commit; il fallimento provoca rollback. Una PUT B2 già avvenuta può essere verificata e riutilizzata da una successiva esecuzione approvata.

L'advisory lock transazionale (170026, 296) è condiviso col replay del ledger. **Non** ferma altri writer/worker non coordinati. La funzione restituisce soltanto conteggi con readyForTraffic:false, mai il permesso di riaprire il servizio.

## Limiti e autorizzazioni

1. Le variabili locali e i booleani passati al metodo **non dimostrano** che Render, altre istanze, Supabase Data API, connessioni dirette e worker siano isolati. Senza prova indipendente del freeze, **non eseguire sul database reale**.
2. Una firma valida non dimostra che il manifesto sia il più recente. Una revoca persa prima di ogni persistenza esterna resta potenzialmente irrecuperabile: checkpoint durabile, continuo e fresco fino alla barriera di arresto degli ingressi resta un prerequisito.
3. Nessuna verifica B2 reale: servono test di staging dedicato su Object Lock COMPLIANCE, retention, VersionId, cifratura, diritti minimi e crash/retry, con valutazione del titolare e DPO.
4. L'esportazione non è la readiness: dopo serve il readback completo tramite verifyOutboxRecoveryReadiness, prova indipendente di completezza e decisione formale di riapertura.
5. L'utente ha comunicato un assenso DPO alla prosecuzione. Non sono allegati né verificati un verbale con ambito, la DPIA definitiva, l'autorizzazione del titolare, policy di conservazione e costi. Il componente non implica queste approvazioni.

## Test

La suite sintetica api/tests/privacyOfflineRecoveryExporter.test.js verifica blocco pre-I/O su flag errati, attestazioni assenti, firma manomessa e manifesto stantio; rollback per storico locale incompleto/alterato, ricevute errate e perdita della quarantena durante B2 o dopo l'UPDATE; successo ristretto a eventi firmati e restituzione di readyForTraffic:false. È inclusa nel workflow di recovery GDPR; i database di CI sono separati e sintetici.

**Stato DRAFT. Nessun merge, deploy, migrazione, segreto, accesso a dati reali, costo o modifica produzione.**

## Drill aggiuntivo PostgreSQL 17 isolato

Lo script di CI api/scripts/verify-gdpr-transactional-outbox-pg17-ci.js riproduce il percorso con un database PostgreSQL 17 temporaneo e B2 simulato: nuovo evento pendente, manifesto/checkpoint sintetico, rifiuto di pin errato prima dell'export, caricamento remoto simulato seguito dalla revoca dell'autorizzazione locale, verifica del rollback della ricevuta nel database, worker ordinario che resta bloccato, e retry offline che riusa la medesima versione immutabile senza spegnere il flag di manutenzione HTTP. È una **prova applicativa in CI**, non un test di isolamento reale o Object Lock B2.

## Correzione della verifica pre-PUT — 26/10

La prima versione confrontava soltanto le **chiavi** dell'intero ledger con il manifesto e il **contenuto** degli eventi ancora pending. Questo lasciava passare un evento già consegnato ma alterato nel database, purché conservasse la stessa chiave. Il controllo ora confronta **tutti i campi di ogni evento**, inclusi quelli già consegnati, con il manifesto indipendente **prima della prima PUT B2**; usa pagine di 250 record per limitare la memoria. Se una pagina successiva contiene un evento modificato, nessuna PUT deve partire.

La transazione offline usa isolamento REPEATABLE READ e acquisisce **prima di qualunque lettura del ledger** un lock PostgreSQL SHARE ROW EXCLUSIVE NOWAIT su ledger e outbox. Se un altro processo sta scrivendo una delle due tabelle, l'esportazione si ferma immediatamente con rollback senza B2 PUT. Il lock è mantenuto durante la verifica e l'export fino al commit/rollback, quindi **blocca anche altri writer su queste due tabelle**; ciò è intenzionale solo in una finestra di recovery isolata, non è appropriato come normale worker in produzione. Non congela le altre tabelle né gli ingressi Render/Supabase: resta obbligatoria la prova infrastrutturale indipendente.

Nuovi test unitari: evento già consegnato alterato, evento alterato nella seconda pagina di 251 eventi, ordine e modalità di acquisizione del lock. Drill PostgreSQL 17: un writer concorrente trattiene un ROW EXCLUSIVE lock e l'esportatore deve ricevere SQLSTATE 55P03 prima di contattare B2 fittizio. Queste verifiche sono sintetiche e non equivalgono a una prova di recovery reale.
