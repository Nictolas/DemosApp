# OPS-STG-001 — backup e inventario dipendenze, 02/11/2026

## Backup Render completato (senza cambio infrastruttura)

- Origine: database PostgreSQL Render Free `demos-civic-staging-db` (scadenza prevista 08/11/2026).
- Ispezione preliminare **solo in lettura**: circa 15.316.659 byte di dimensione database. Stime `pg_stat_user_tables`: 87 iniziative ministeriali, 111 processi civici, 128 record di fonte, 143 identificativi, 3 utenti, 3 dispositivi. Sono stime, non conteggi ufficiali; non attribuire automaticamente natura sintetica agli utenti/dispositivi.
- Copia locale compressa in formato `pg_dump -Fc` completata sul disco D: nella cartella `DEMOS-Preserved/Render-Archive`. Dimensione **252.568 byte**, SHA-256 `D2A3EC5E8D338BF906984013B96C05F7F399A793EF7FB6CF5A2075B575705FC1`. Verifica `pg_restore --list` riuscita, hash verificato in una seconda lettura.
- Directory locale con ACL NTFS limitate all'utente corrente, Administrators e SYSTEM; **non condividere, caricare in repository, Drive o log questo file** perché può contenere credenziali/dispositivi di test.
- La connessione esterna del database Render è tornata **deny-all** (`ipAllowList=[]`) dopo ispezione e backup; TLS cifrato con `sslmode=require`, che non autentica il server via certificato CA.
- **Ripristino verificato il 02/11/2026:** il backup è stato ripristinato con successo in un PostgreSQL 17 locale temporaneo (pg_restore --exit-on-error, esito 0). Resta da collaudare il cutover completo del servizio condiviso; il vecchio Render PostgreSQL non deve ancora essere cancellato.
- Render PG non cancellato; non attivato alcun piano a pagamento.

## Differenza database e utilizzo osservato dal codice

- Supabase `Demos` (produzione): **115** tabelle `public`.
- Supabase `Demos-Staging`: **25** tabelle `public`, tra cui 6 aggiunte con migrazione additiva. Sono **93** i nomi di tabelle di produzione assenti nello staging (non significa che siano tutte necessarie).
- Audit statico indicativo di **352 file backend tracciati sotto `api/`** letti nel working tree corrente, mediante ricerche testuali delle parole SQL `FROM/JOIN/INTO/UPDATE`: **54** nomi presenti in produzione e citati dal codice non sono in staging, di cui **40** citati in almeno due file. L'audit può includere query legacy, commenti e falsi positivi: non autorizza migrazioni automatiche.
- Tabelle assenti frequentemente citate: `opinioni_domande` (18 file), `voti_camera` (14), `parlamento` (12), `political_mandates` (12), `votazioni_parlamento` (11), `notifiche_voti_parlamento` (9), `political_candidacies` (8), `voti_referendum_abrogativi` (6), `user_profile` (6), `comunicazioni` (6), `unita_elettorale` (6).
- Non importare righe personali o copiare automaticamente tutte le tabelle: selezionare gli oggetti richiesti dalle **route attualmente pubblicate** e dai test E2E scelti, ricreando DDL e vincoli in modo additivo e con RLS/grants ristretti.

## Gate restanti, senza deviazioni infrastrutturali

1. Inventario read-only delle variabili di ambiente dei servizi Render, senza mostrare valori sensibili: verificare quali dipendono dal vecchio PostgreSQL. Le metriche di connessione sono quasi sempre a zero, ma da sole **non provano l'assenza di dipendenze**.
2. Validare che il futuro backend `demos-staging` non possieda/usi credenziali di produzione. Non cambiare ancora il suo bootstrap fail-closed: `/health/ready=503`, test app non autorizzati.
3. Identificare le tabelle indispensabili per gli scenari E2E di auth, profilo, Opinioni, notifiche e processi civici, e portarle sul progetto Supabase `Demos-Staging` senza dati reali.
4. QA runtime su dati sintetici e provider disabilitati/dry-run; isolamento di utenti, richieste, sessioni, invii FCM/email e scritture fuori staging.
5. Solo dopo parità funzionale e piano di rollback, dimettere i nove web service superflui e verificare il Key Value. Il vecchio PG può scadere senza upgrade **solo dopo** aver escluso dipendenze critiche.

**Regola permanente:** un unico staging cloud condiviso; non creare nuove istanze permanenti per ogni chat/PR. Nessuna cancellazione o merge di produzione implicita.

## Revisione delle dipendenze API — inventario statico mirato

Un secondo inventario offline ha confrontato 115 nomi di tabelle della produzione e 25 dello staging con i riferimenti SQL `FROM`, `JOIN`, `INTO`, `UPDATE` e `DELETE FROM` nei file JavaScript, TypeScript e Python sotto `api/routes`, `api/services`, `api/jobs`, `api/controllers` e `api/middleware` (esclusi i test). Tra le 93 tabelle assenti nello staging, **57** hanno almeno un riferimento nei file analizzati. È un indicatore testuale, non una prova che tutte siano eseguite in produzione o indispensabili; il conteggio differisce dall'audit precedente che aveva un perimetro di ricerca diverso.

- **Profilo e autorizzazioni:** `user_profile` compare nelle route `auth/profile`, `users/profile`, `users/search` e `user/gdpr-rights`. Anche `political_mandates` è richiamata da route di utenti e voto; verificare prima i percorsi obbligatori di login, profilo e consenso.
- **Notifiche e privacy:** `notifiche_demos`, `notifiche_avvistamenti`, `notifiche_comunali`, `notifiche_voti_comuni`, `notifiche_voti_parlamento`, `comunicazioni` e `reazioni` compaiono nelle route notifica o nei servizi collegati. Le cinque tabelle protette delle nuove push civiche risultano invece presenti e hanno RLS/grants verificati.
- **Iniziative e referendum:** `iniziative_popolari`, `referendum_abrogativi`, `voti_iniziative_popolari`, `voti_referendum_abrogativi` risultano referenziate da route dedicate. Occorre distinguere i percorsi ancora necessari per la UI dalle vecchie tabelle di voto.
- **Altri moduli:** candidature, Parlamento, elezioni e grafici possono richiedere tabelle aggiuntive. Non includerle per default in un test circoscritto alle notifiche civiche.

**Decisione operativa:** prima di eventuali DDL, associare ogni scenario E2E autorizzato alle sue route effettivamente montate e alle dipendenze transitive, confrontare lo schema delle sole tabelle richieste e preparare migrazioni additive con RLS e privilegi minimi. Nessuna copia di record di produzione, nessun aggiornamento dello staging bootstrap o attivazione di Firebase è autorizzato dall'inventario. L'attuale preflight di base e quello per le tabelle civiche non sostituiscono l'E2E completo.

Il backup Render locale è stato ricontrollato leggendo dimensione e SHA-256: **252.568 byte** e impronta coerente con l'evidenza sopra. Ripristino locale riuscito e verificato; non eliminare il vecchio PostgreSQL finché cutover, dipendenze e autorizzazione non saranno completati.


## Verifica di ripristino reale — 02/11/2026 (backup gate PASS)

- Archivio PostgreSQL 17 custom-format verificato: 276 voci TOC; impronta SHA-256 invariata, file da 252.568 byte.
- Eseguito `pg_restore --no-owner --no-acl --exit-on-error` su istanza PostgreSQL **17.10 locale e temporanea**, con database nuovo vuoto e listener **solo 127.0.0.1**. Il backup era stato generato dal server PostgreSQL 17.11; restore concluso con **exit code 0**.
- Query di controllo sul database ripristinato: **33 tabelle**, **124 indici**, **26 chiavi esterne** nello schema public. Verificata anche la leggibilità degli aggregati: 3 account, 3 dispositivi, 87 iniziative ministeriali, 111 processi civici, 128 record sorgente. Non sono stati esportati o pubblicati dati personali.
- Chiusura locale con `pg_ctl stop -m fast -w` riuscita; **directory temporanea con i dati ripristinati eliminata** e assenza di modifiche all'archivio originale confermata da nuovo hash. Nessun database in cloud creato o modificato; nessun servizio Render, staging condiviso o produzione toccato.
- **Interpretazione:** la recuperabilità tecnica di questo singolo dump è ora dimostrata (PASS), a differenza del precedente controllo del solo TOC. **Non** dimostra ancora parità ambientale, isolamento dei segreti, assenza di dipendenze dal vecchio provider, backup automatici, E2E o readiness del futuro `demos-staging`. L'eliminazione del vecchio servizio resta vietata prima di cutover completo e autorizzato.

## Verifica strutturale notifiche — 03/11/2026 (solo metadata)

Il preflight `api/scripts/unifiedStagingPreflight.js` è stato esteso con 18 controlli di schema tipizzato, 5 verifiche RLS/privilegi delle tabelle civiche, default `false` dei tre opt-in e lettura aggregata della guardia globale bloccata. Funziona **solo** dopo GO esplicito, in transazione SQL `READ ONLY`, senza invio di notifiche. In caso di mismatch rifiuta la readiness e non esibisce dettagli dei driver nei log. Sono stati aggiunti test negativi per colonne mancanti/tipi errati/default opt-in abilitati, RLS disabilitata, privilegi client e guardia non bloccata.

Confronto diretto sui **metadata di Supabase Demos-Staging**, senza copiare dati personali: **18/18 colonne tipizzate presenti e corrette**, **5/5 tabelle civiche con RLS attiva e senza privilegi diretti anon/authenticated**. `users.status` **ora è presente** (nelle verifiche precedenti del 1 novembre risultava mancante); non proporre nuovamente la migrazione di questa colonna senza una nuova verifica. Sono presenti due account staging con stato `pending` e zero dispositivi/preferenze; la barriera `civic_push_delivery_guard` resta bloccata. Il backend Render `demos-staging` è ancora configurato con bootstrap HTTP e autoDeploy OFF.

**Limite:** la prova schema/ACL non certifica l'accesso da Render con connessione session-affine, né i permessi effettivi del ruolo applicativo, la configurazione dei segreti, la revoca FCM, Android/PWA o il canary. Rimangono i gruppi P0 E2E e il GO distinto. Non abilitare flag Firebase e non connettere o distribuire il bootstrap in questa fase.
