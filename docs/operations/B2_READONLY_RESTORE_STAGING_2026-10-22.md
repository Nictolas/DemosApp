# DEMOS — Collaudo di recupero B2 isolato (22 ottobre 2026)

**Stato aggiornato al 23 ottobre 2026:** **B2 RESTORE REALE IN SOLA LETTURA SU STAGING PASS** (CP-EA-057, deploy `dep-dbdmch7avr4c73aj6afg`, marker `B2_READONLY_RESTORE_VERIFIED`, `GET /healthz` HTTP 200). Il primo deploy del 22 ottobre era in standby: le sezioni storiche sottostanti lo descrivono come stato precedente. L'archiviatore produttivo su `main` resta separato e il rilascio complessivo della PR #218 rimane **NO-GO**.

## Ambiente dedicato e verificato

- Workspace Render: `Nicolas` (`tea-d2gs3eadbo4c73ag95rg`).
- Servizio: `demos-b2-readonly-restore-staging` (`srv-dbct3vmq1p3s73d7rhg0`).
- URL pubblico (solo `GET /healthz`): https://demos-b2-readonly-restore-staging.onrender.com
- Deploy iniziale: `dep-dbct40eq1p3s73d7rj2g`, commit `6341383154a9834a21f70f4ed0f4d39f1731a5d1`, **live**.
- Piano `Free` di Render, regione Frankfurt, ramo `fix/audit-outbox-20261021`, `autoDeploy=no`.
- Build: `cd api && npm ci --ignore-scripts`.
- Start: `cd api && npm run archive:axiom:readonly-health`.
- Log del **primo** startup (22/10) `B2_READONLY_RESTORE_STANDBY_NO_SECRET` (storico). **Startup dopo il deploy del 23/10:** `B2_READONLY_RESTORE_VERIFIED` — **PASS** nel servizio isolato.
- **Al primo deploy** non era configurato alcun segreto B2. **Dal 23/10** la nuova credenziale temporanea è configurata esclusivamente nelle variabili segrete di Render; nessun `DATABASE_URL`, `AUDIT_OUTBOX_DATABASE_URL`, token Axiom o Firebase nel servizio. Job Axiom produttivo invariato.

## Credenziale da configurare tramite i pannelli autorizzati

Nel pannello Backblaze **B2 Cloud Storage → Application Keys → Add a New Application Key**:

1. Nome suggerito: `demos-b2-restore-readonly-20261022`.
2. Accesso **solo** al bucket `demos-log-archive-eu`.
3. Permessi **Read Only** (nessuna scrittura o cancellazione); se necessario per la compatibilità S3, abilitare `List all bucket names` solo se il provider lo richiede. Il nostro client fa solo `HEAD Object` e `GET Object`, non `List Buckets`.
4. Prefix opzionale consigliato: `demos/axiom-archive/v1/` (checkpoint, manifest e file sono tutti sotto tale prefisso).
5. Durata breve / scadenza temporanea, ad esempio **24 ore**, se supportata.
6. Conservare in un gestore di segreti i valori **Key ID** e **Application Key**. La Application Key si può vedere solo quando viene generata: non inviarla in chat, documenti o ticket.

Aggiungere **esclusivamente** queste due variabili segrete nel servizio Render dedicato, sezione `Environment`:

- `B2_S3_ACCESS_KEY_ID` = **Key ID**.
- `B2_S3_SECRET_ACCESS_KEY` = **Application Key**.

Le variabili non segrete sono già configurate:
`B2_RESTORE_READONLY_MODE=true`,
`AXIOM_ARCHIVE_ENABLED=false`,
`B2_BUCKET_NAME=demos-log-archive-eu`,
`B2_S3_REGION=eu-central-003`,
`B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com`.
Non aggiungere credenziali del database, API Axiom o worker/archiviatore.

**Dopo il salvataggio dei segreti**, avviare un solo deploy manuale del servizio isolato. Il codice prima verifica checkpoint e manifest di `centralized_logs` e `real-time`, poi legge i soli oggetti del batch più recente. Ogni GET è limitato sotto 8 MiB, l'espansione gzip a 32 MiB e la verifica a 60.000 eventi per oggetto; confronta hash SHA-256, fingerprint, categorie, conteggi e dataset. Il wrapper SDK nega ogni comando diverso da `HEAD`/`GET` e qualsiasi bucket o prefisso differente.

## Riconciliazione anti-duplicati del 22/10/2026 — prima di qualunque nuova chiave

È stato consultato **prima** dell'intervento il Google Sheet canonico
`DEMOS – Tecnologia – Stato Implementazione e Scostamenti`
(`IMP-047`), insieme a Engineering `CP-EA-032`, GitHub PR #218,
Render e log. Il bucket `demos-log-archive-eu` e l'archiviazione
Axiom → B2 in produzione **esistono già**: non ricrearli.

Render `demos-b2-readonly-restore-staging` è **Live** e il suo ultimo
log di startup noto è `B2_READONLY_RESTORE_STANDBY_NO_SECRET`,
con un solo deploy iniziale. **Questo attesta unicamente l'assenza
delle credenziali nel servizio di prova al suo ultimo avvio**;
non permette di concludere che sul conto Backblaze non esista
una Application Key dedicata Read Only.

Il connettore Backblaze non è disponibile. Al tentativo di controllare
il computer autorizzato, Desktop MCP ha risposto che il tunnel client
non è connesso. Perciò **l'inventario delle Application Keys è
SCONOSCIUTO e richiede una consultazione diretta della console,
senza leggere/trasferire segreti**.

Checklist pre-azione:
1. Aprire Backblaze B2 Cloud Storage → Application Keys e controllare
   esclusivamente i metadata delle chiavi *già esistenti*: nome,
   scope bucket `demos-log-archive-eu`, accesso `Read Only`,
   prefisso `demos/axiom-archive/v1/` (se presente), scadenza.
2. Se una chiave adeguata **esiste e il segreto è già custodito** in
   un secret manager autorizzato, riutilizzare quella chiave
   soltanto sul servizio di sola lettura. La console Backblaze
   non mostra di nuovo il valore dell'Application Key dopo la
   creazione. Non copiare segreti del job di scrittura in produzione.
3. Creare una chiave aggiuntiva *solo dopo aver accertato* che non
   è disponibile una chiave minima recuperabile.
4. Dopo la configurazione, testare `HEAD/GET` reali e la
   catena checkpoint → manifest → contenuto almeno di **un oggetto dati**
   tra i due dataset. Unicamente checkpoint e manifest vuoti
   **non** sono sufficienti per un PASS di ripristino: lo script
   rifiuta ora `B2_READONLY_RESTORE_NO_DATA_OBJECT_VERIFIED`.

Evidenze codice: `api/scripts/verify-b2-restore-readonly.js`,
nuovo test `verifyB2RestoreReadonly.test.js`, commit
`33643b7f284a712242862218bcf62ac8f25deda5`.
Google Sheet aggiornati e riletti nel medesimo intervento:
`IMP-047` e `CP-EA-033`.
Nessuna modifica a produzione, bucket, segreti o Render.

## Criteri di risultato

- `B2_READONLY_RESTORE_STANDBY_NO_SECRET`, `GET /healthz` → 503: attesa delle credenziali, **non verificato**.
- `B2_READONLY_RESTORE_VERIFIED`, `GET /healthz` → 200: verifica autenticata di entrambi gli ultimi batch **PASS**, con sola lettura.
- `B2_READONLY_RESTORE_REJECTED`: **NO-GO**, non esporre errori del provider o segreti.

La presenza del log `Axiom archive completed` sul backend principale **non certifica** il restore B2.

## Evidenze

- Workflow GitHub `Logging and archive regression`: nuovo servizio verificato da test di startup, standby senza segreti, rifiuto configurazioni pericolose, e verifica sintetica; test del wrapper B2 sono separati.
- Riferimenti sorgente: `api/scripts/b2-restore-readonly-health-server.js`, `api/scripts/verify-b2-restore-readonly.js`, `api/services/axiomArchiveService.js`.
- Dopo il test reale, annotare solo timestamp, `PASS/FAIL`, conteggi aggregati e dataset. Non memorizzare contenuti dei log archiviati, chiavi oggetto, link firmati, password o token.

La PR #218 rimane **draft** e `main` invariato. Il criterio di rilascio GDPR/FCM/Axiom resta indipendente da questa sola verifica.

## Inventario autenticato di Backblaze del 23/10/2026

È stata verificata **direttamente** nel browser Chrome autorizzato la
pagina autenticata `B2 Cloud Storage → Application Keys`, senza
accedere ai valori segreti. La console elenca una Application Key
`demos-log-archive` collegata a `demos-log-archive-eu`, con
`namePrefix=demos/axiom-archive/v1/` e nessuna scadenza esplicita
indicata. Dai metadati `capabilities` risultano `readFiles` e
`listFiles`, ma **anche `writeFiles` e `deleteFiles`**.
Pertanto **non** deve essere riciclata sul servizio di restore
read-only, nemmeno se fosse possibile recuperare il suo segreto:
viola il principio del minimo privilegio. La Master Application Key
non è stata ruotata né usata.

Nella lista accessibile non è emersa una credenziale dedicata
`Read Only` per il ripristino. È stato aperto il comando
`Add a New Application Key`, ma la pagina/modal successiva
non ha esposto i propri campi ai controlli di accessibilità remoti
in modo verificabile. **Nessuna nuova chiave è stata creata**.
Non assumere che il modulo sia stato compilato o che l'utente abbia
autorizzato l'uso di segreti della produzione.

**Prossima operazione manuale minima se il browser remoto non torna
accessibile:** riportare in primo piano la pagina Backblaze
`Application Keys` e aprire il modulo `Add a New Application Key`,
così da consentire di verificare i campi. In alternativa creare
una sola nuova credenziale temporanea **Read Only**, esclusivamente
bucket `demos-log-archive-eu`, prefisso
`demos/axiom-archive/v1/`, scadenza breve (es. 24 h).
Il valore segreto, visibile una sola volta, non deve essere incollato
in chat o in Google Sheet/GitHub. Destinazione prevista:
**soltanto** servizio Render
`demos-b2-readonly-restore-staging`, variabili
`B2_S3_ACCESS_KEY_ID` e `B2_S3_SECRET_ACCESS_KEY`.
Verificare il test univoco `HEAD/GET` sul servizio isolato,
senza alterare l'archiviatore di produzione.

Lo stato rimane **B2 restore reale: NON VERIFICATO**. Nessun token,
bucket, file, servizio Render o configurazione di produzione è stato
modificato.

## 23/10/2026 — Prima chiave di restore creata e revocata perché esposta

L'utente ha creato una credenziale B2 temporanea denominata
`demos-b2-restore-readonly-20261023` per il ripristino di staging,
ma ha pubblicato per errore uno screenshot **contenente l'applicationKey
in chiaro**. La credenziale è pertanto da considerarsi **esposta**.

**Contenimento eseguito il 23/10/2026:** attraverso la console Backblaze
autenticata, identificata la riga esatta della sola credenziale di
restore creata oggi, invocato il suo comando `Delete Key` e confermata
la revoca. La rilettura dell'elenco ha confermato che la chiave esposta
**non compare più**, mentre la chiave produttiva
`demos-log-archive` **è tuttora presente**. Nessun token/valore segreto
è stato copiato, riutilizzato, loggato o caricato su Render.

**Stato dei servizi:** `demos-b2-readonly-restore-staging` continua
senza il collaudo autenticato di ripristino; nessun deploy e nessun
cambiamento al servizio di archivio produttivo. Una seconda credenziale
sostitutiva **non è stata creata in questo intervento**, perché
l'interfaccia utente remota non ha permesso di verificare in modo
continuo tutti i parametri del nuovo modulo.

**Prossima azione sicura:** creare una nuova chiave B2 dall'account
Backblaze, con nome univoco diverso dal precedente, bucket
`demos-log-archive-eu`, permesso `Read Only`,
`namePrefix=demos/axiom-archive/v1/`, durata breve
(`86400` secondi). Non condividere mai lo schermo o screenshot in cui
è visibile `applicationKey`. Copiare `keyID` e `applicationKey`
**direttamente** nei campi di ambiente `B2_S3_ACCESS_KEY_ID` e
`B2_S3_SECRET_ACCESS_KEY` del servizio isolato Render
`demos-b2-readonly-restore-staging`, non nel repository, nei fogli
Google o in chat. Solo dopo che entrambe sono configurate verificare
la presenza tramite segnali non segreti e autorizzare un unico
`HEAD/GET` read-only senza mutare la produzione. Se la chiave nuova
non si può configurare correttamente, fermarsi, non riutilizzare quella
compromessa.

**Gate B2 restore LIVE: NON VERIFICATO / NO-GO**.

## 23/10/2026 — Restore B2 reale da servizio isolato: PASS (CP-EA-057)

**Evidenza reale del 23/10/2026 alle 13:51 UTC / 15:51 ora italiana**.
Dopo che l'utente ha inserito *direttamente* nelle variabili segrete di
Render una nuova credenziale temporanea di ripristino (mai trasmessa in
chat), è stato avviato **un solo deploy manuale** del servizio isolato
`demos-b2-readonly-restore-staging` (`srv-dbct3vmq1p3s73d7rhg0`),
`autoDeploy=no`, `clearCache=false`:
`dep-dbdmch7avr4c73aj6afg`, commit PR
`ad76454b5b28bea7115652f87336b421b1fd3385`.
Il deploy è passato a **`live`** alle **13:51:46 UTC**.

**Riscontro provider non segreto:** i log applicativi dello startup
alle **13:51:41 UTC** riportano esattamente
`B2_READONLY_RESTORE_VERIFIED`; prova indipendente
`GET https://demos-b2-readonly-restore-staging.onrender.com/healthz`
restituisce **HTTP 200 / `ok`**.

Lo script realmente deployato
`api/scripts/b2-restore-readonly-health-server.js` dichiara READY solo
dopo che `verifyB2RestoreReadOnly` ha restituito
`status=B2_READONLY_RESTORE_VERIFIED`, con **due riepiloghi** coerenti,
nell'ordine `centralized_logs`, `real-time`.
Il verificatore accetta solo `HeadObjectCommand` e
`GetObjectCommand` verso il bucket
`demos-log-archive-eu` e prefisso `demos/axiom-archive/v1/`,
limita i byte scaricati per oggetto e convalida
checkpoint/manifest/integrità dei dati; inoltre richiede
almeno **un oggetto dati archiviato** effettivamente verificato
fra i due dataset. Pertanto il risultato è una **vera prova di recupero
read-only** e non un semplice controllo di rete o di manifest vuoti.
Il marker non rende disponibili, nei log pubblici, i conteggi per
dataset: **non inventare cifre** relative a eventi od oggetti.

**Isolamento e sicurezza:** nessun nuovo bucket, nessuna modifica alla
chiave di archiviazione di produzione, nessuna scrittura/cancellazione B2,
nessuna copia delle nuove credenziali in chat, GitHub o Sheets; l'endpoint
HTTP esposto è solo `/healthz`. La prima credenziale inavvertitamente
esposta nello screenshot era già stata revocata (CP-EA-056) e non è
stata riutilizzata in questo test. La durata della nuova chiave era
prevista di 86400 secondi: verificarne la scadenza effettiva direttamente
nella console Backblaze, senza assumere un rinnovo automatico.

**Gate aggiornato:** `B2 READ-ONLY RESTORE STAGING: PASS`.
Questo non approva retention/privacy, non attesta test FCM o percorso
completo `Supabase outbox → worker → Axiom`, e non consente il rilascio
produttivo: **PR #218 draft e produzione NO-GO**.
