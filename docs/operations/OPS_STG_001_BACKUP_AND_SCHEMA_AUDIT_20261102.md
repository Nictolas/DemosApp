# OPS-STG-001 — backup e inventario dipendenze, 02/11/2026

## Backup Render completato (senza cambio infrastruttura)

- Origine: database PostgreSQL Render Free `demos-civic-staging-db` (scadenza prevista 08/11/2026).
- Ispezione preliminare **solo in lettura**: circa 15.316.659 byte di dimensione database. Stime `pg_stat_user_tables`: 87 iniziative ministeriali, 111 processi civici, 128 record di fonte, 143 identificativi, 3 utenti, 3 dispositivi. Sono stime, non conteggi ufficiali; non attribuire automaticamente natura sintetica agli utenti/dispositivi.
- Copia locale compressa in formato `pg_dump -Fc` completata sul disco D: nella cartella `DEMOS-Preserved/Render-Archive`. Dimensione **252.568 byte**, SHA-256 `D2A3EC5E8D338BF906984013B96C05F7F399A793EF7FB6CF5A2075B575705FC1`. Verifica `pg_restore --list` riuscita, hash verificato in una seconda lettura.
- Directory locale con ACL NTFS limitate all'utente corrente, Administrators e SYSTEM; **non condividere, caricare in repository, Drive o log questo file** perché può contenere credenziali/dispositivi di test.
- La connessione esterna del database Render è tornata **deny-all** (`ipAllowList=[]`) dopo ispezione e backup; TLS cifrato con `sslmode=require`, che non autentica il server via certificato CA.
- **Limite:** non è stata fatta una prova di ripristino. Il backup preserva i dati ma non dimostra automaticamente che tutta la piattaforma si possa ricostruire.
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
