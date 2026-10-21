# DEMOS — Stato rilascio coda audit, 21 ottobre 2026

**Stima gestionale: ~70% completato / ~30% mancante.** È un giudizio
qualitativo, non una percentuale ricavata dai test. La maggior parte del
codice e dei controlli automatici è pronta; i controlli end-to-end con
provider reali, la valutazione privacy e il rilascio controllato non lo sono.

**STATO: NO-GO. La PR #218 resta draft e non va unita a `main` senza
soddisfare tutte le condizioni obbligatorie sotto. Nessun flag di outbox
deve essere attivato sul backend di produzione.**

## Verifiche già svolte

| Area | Evidenza | Stato |
| --- | --- | --- |
| Coda PostgreSQL, lease, retry, dead-letter, collisioni e capacità | Suite PostgreSQL 17 reale su GitHub CI; **14/14 test**, inclusi percorso integrato fino al restore B2 sintetico e rifiuto di privilegi estranei concessi temporaneamente al login | PASS simulazione integrata; provider esterni reali ancora NO-GO |
| Staging Supabase | `Demos-Staging` (`fkeayjzvtuvzesljhjbc`), due migrazioni e RLS; eseguito anche INSERT/claim/lease/retry/dead-letter/DELETE **con ruolo NOLOGIN effettivo** in una transazione con `ROLLBACK`, senza creare password o dati residui | PASS SQL (non LOGIN/HTTP) |
| Data API pubblica dello staging | GET anon su tabella/schema privato → HTTP 404/406 | PASS negativo |
| Isolamento dei progetti | `AUDIT_OUTBOX_DEPLOYMENT_SCOPE` e `AUDIT_OUTBOX_DATABASE_URL` separata; mismatch fallisce prima della creazione del pool | PASS test |
| Reinvio Axiom 503 → 202 con ID stabile | Axiom HTTP simulato su PostgreSQL CI; **non** consegna reale | PASS simulazione |
| Archiviazione Axiom → B2 e recupero duplicati | CI con oggetti sintetici, hash SHA256/gzip e limiti del restore B2 (**HEAD max 8 MiB, streaming bounded, decompressione max 32 MiB, max 60.000 eventi**); lettura checkpoint rafforzata con verifica hash e dataset prima del riavvio; **27 completamenti** Render osservati, senza lettura B2 reale | PASS CI (42/42 test archiviazione, 76/76 logging e PostgreSQL reale); restore reale NON verificato |
| Avvisi amministrativi | Retry dopo errore DB; avvisi concorrenti; DB riuscito + FCM fallito non genera duplicati; solo test sintetici | PASS simulazione |

**Verifica diretta 21/10/2026:** Supabase `Demos-Staging` è
`ACTIVE_HEALTHY`, con **0 righe** nella outbox, RLS attiva,
ruolo `demos_outbox_worker` ancora `NOLOGIN` e senza `BYPASSRLS`;
nessun accesso schema per `anon`/`authenticated` né SELECT per
`service_role`. Advisor sicurezza e performance: **0 rilievi**.
Nessun LOGIN runtime, credenziale provider o servizio di produzione modificato.
Il test completo **con Axiom/B2 simulati** è [passato nella CI PostgreSQL](https://github.com/Nictolas/DemosApp/actions/runs/39670492893).
Questo risultato **non chiude** i test con Axiom, B2 o FCM reali.

## Destinazioni Axiom già presenti e isolamento dei collaudi

La console Axiom dell'organizzazione DEMOS mostra i dataset **interni**
`centralized_logs` (30 giorni), `real-time` (30 giorni) e
`demos-security-staging` (7 giorni, attualmente senza eventi nella
schermata verificata). I due dataset `axiom-play / ...` marcati
**External** sono esempi esterni e non sono destinazioni DEMOS.

**Nuovo controllo fail-closed nel ramo PR:** quando
`AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`, i nuovi eventi outbox possono
essere accodati/inviati soltanto al dataset `demos-security-staging`.
Il controllo viene ripetuto immediatamente prima della richiesta HTTP
ad Axiom, anche per righe già presenti nella coda. In produzione un
dataset con segmento `staging` nel nome viene rifiutato.
Questo impedisce che le variabili predefinite `real-time` e
`centralized_logs` facciano finire collaudi nel dataset operativo.

**Istruzioni per il backend isolato (NON per Render di produzione):**
configurare `AXIOM_REALTIME_DATASET=demos-security-staging` e
`AXIOM_DATASET=demos-security-staging` insieme a
`AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`, soltanto con un token Axiom di
test limitato a quel dataset e all'organizzazione prevista. Non abilitare
`AXIOM_ARCHIVE_ENABLED` sul backend di staging: l'archivio B2 produttivo
deve restare indipendente. Iniettare esclusivamente eventi sintetici,
senza `user_id` o `ip_address` reali; verificare prima che il dataset
esistente, normalmente usato dal Security Agent, possa ospitare il
collaudo senza alterarne alert o analisi. Questa verifica con Axiom reale
**non è stata eseguita**. Un eventuale dataset aggiuntivo richiederà
una decisione separata, non è stato creato.

## Render: workspace autorizzato e preflight dedicato

**Verifica del 21/10/2026.** L'utente ha confermato il workspace Render
`Nicolas` (`tea-d2gs3eadbo4c73ag95rg`). L'inventario Render mostra il
backend **produttivo** `demos-backend`
(`srv-d2gt3dodl3ps73fmereg`, ramo `main`, auto-deploy attivo)
e più servizi **già esistenti** di staging su piano `free`, inclusi
`demos-functional-staging` (`srv-db52l1g473hc739ld250`) e
`demos-security-staging` (`srv-db2ho5jncjis73ep4ot0`), entrambi con
auto-deploy disattivato e su rami diversi dalla PR #218.

**Nessun servizio Render creato, modificato, riavviato o ridistribuito.**
Gli staging precedenti non sono stati riutilizzati arbitrariamente:
il connettore espone le configurazioni generali ma non consente di
attestare in sola lettura la separazione effettiva delle loro
credenziali runtime. **Non assumere che siano collegati al database
Demos-Staging solo perché contengono la parola staging nel nome.**

Un'ulteriore istanza Render Free non è necessariamente priva di rischio
economico/operativo: le **750 ore mensili gratuite sono condivise**
fra i servizi web Free dello stesso workspace, inclusa la produzione,
e il loro esaurimento sospende i servizi Free. È necessario controllare
prima il consumo residuo nella fatturazione Render:
https://render.com/docs/free .
Non creare un nuovo servizio o modificare uno staging esistente finché
non è chiaro il consumo disponibile e non si conoscono le credenziali
effettivamente assegnate al backend scelto.

### Preflight del futuro backend isolato (senza avviare l'app)

Nel ramo PR #218 è disponibile:

```bash
cd api
npm run audit:outbox:render-staging-preflight
```

Il comando **non avvia Express, worker, Axiom o B2** ed esegue solo
query SQL di controllo su Supabase. Prima di qualsiasi query verifica:

- scope esatto `AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`;
- `AUDIT_OUTBOX_PREFLIGHT_ONLY=true` e **solo**
  `AUDIT_OUTBOX_DATABASE_URL` con account `demos_outbox_runtime`;
  `DATABASE_URL` deve essere **assente**, senza credenziali
  amministrative o applicative del database principale;
- per il preflight Render solo Session Pooler verificato
  `aws-1-eu-central-1.pooler.supabase.com:5432`, rifiutando
  connessione diretta IPv6 e Transaction Pooler 6543;
- `AXIOM_REALTIME_DATASET=AXIOM_DATASET=demos-security-staging`;
- `AUDIT_OUTBOX_ENABLED`, `AUDIT_OUTBOX_WORKER_ENABLED`,
  `AUDIT_OUTBOX_SECURITY_ENABLED`,
  `AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED` e
  `AXIOM_ARCHIVE_ENABLED` **non attivi**.

La fase SQL verifica poi il login PostgreSQL non privilegiato, la
membership nel ruolo minimo e i permessi necessari con il preflight
già presente. In caso di problemi esce senza stampare password,
URL o messaggi del driver. Restituisce soltanto identificatore
pubblico di staging, esito e flag di sola lettura.

**Blocco confermato direttamente nello staging Supabase:** la coda è
vuota, RLS attiva, nessun accesso allo schema per `anon`/
`authenticated`; `demos_outbox_worker` è ancora `NOLOGIN` e
**0 ruoli `demos_outbox_%` possono effettuare LOGIN**. Non è
stato inventato un hostname pooler né creata una password.

**Prossime condizioni in ordine:** (1) scegliere un servizio davvero
isolato e verificare le ore Render; (2) ottenere la connessione session
esatta dal pannello Supabase e creare il login a privilegi minimi tramite
un canale sicuro per i secret; (3) eseguire il preflight dal solo
backend isolato, con tutti i flag disattivati; (4) solo dopo abilitare
gli eventi sintetici e verificare Axiom, quindi B2 e FCM. Il preflight
non autorizza automaticamente né il deploy né l'attivazione.

### Privilegi impliciti del login: barriera aggiuntiva (21 ottobre 2026)

Il preflight runtime `auditOutboxDatabase.ensureReady()` controlla ora
**l'identità PostgreSQL effettivamente autenticata**, non soltanto i grant
del ruolo `demos_outbox_worker`. Respinge account che possano creare
database/ruoli, fare replication o creare oggetti nello schema `public`,
nonché login che abbiano privilegi su **qualsiasi tabella o vista
diversa da `demos_private.audit_delivery_outbox` (anche nello stesso
schema privato)**, possano invocare routine `SECURITY DEFINER` non di
sistema (anche interne allo schema privato) o appartengano a ruoli
ulteriori oltre a `demos_outbox_worker`.

La scansione consulta soltanto i **cataloghi** PostgreSQL: non legge
payload di log, dati utenti, né invoca funzioni applicative. Restituisce
al servizio esclusivamente conteggi, booleani e un codice d'errore fisso.
Il controllo considera anche i grant impliciti tramite `PUBLIC`,
che una mera analisi dei permessi espliciti non coprirebbe.

Nello **staging Supabase reale**, la ricognizione preliminare del
ruolo `NOLOGIN` esistente ha contato **zero** tabelle o viste
estranee accessibili e **zero** routine esterne eseguibili. L'esito
non sostituisce la prova sul futuro `LOGIN` applicativo.
Il test su **PostgreSQL 17 usa-e-getta** ha invece verificato
sull'account `LOGIN` reale che un `GRANT SELECT` estraneo e
una routine `SECURITY DEFINER` richiamabile attraverso `PUBLIC`,
**entrambi nello stesso schema `demos_private`**, vengono rifiutati;
la configurazione minimale torna valida dopo la revoca.
[CI PostgreSQL (14/14)](https://github.com/Nictolas/DemosApp/actions/runs/39677416704).
Un'ulteriore lettura dei cataloghi sullo **staging Supabase reale**
ha confermato: **0** oggetti estranei accessibili anche entro lo schema
privato, **0** routine `SECURITY DEFINER` invocabili, **0** login runtime
creati e **0** eventi nella coda.

**Blocco invariato:** non è stato ancora creato alcun account LOGIN
nello staging Supabase o configurata una credenziale su Render.
Prima della prova runtime devono essere verificati i grant effettivi
del LOGIN creato attraverso il canale sicuro del provider.

### Identità Supabase runtime predisposta, connessione ancora NO-GO

Il 21 ottobre 2026 è stata applicata **solo** a `Demos-Staging`
la migrazione `20261021212727`: ora esiste
`demos_outbox_runtime` **NOLOGIN, senza password** e membro
del solo `demos_outbox_worker`. SQL verificato: privilegi
`SELECT/INSERT/UPDATE/DELETE` limitati alla coda, nessun
`SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION`, nessun
`CREATE` su `public`; **0** altre tabelle leggibili,
**0** routine definer richiamabili e **0** eventi in coda.
Il lavoro è reale sul database di prova, **non è un collegamento Render
attivo** e non consente l'accesso a rete senza LOGIN.

**Aggiornamento 22/10/2026 — hostname ottenuto:**
`aws-1-eu-central-1.pooler.supabase.com:5432` per
`Demos-Staging`, verificato dalla stringa Session Pooler dell'utente.
Risoluzione IPv4 (4 record A) e raggiungibilità TCP porta 5432
confermate dal desktop autorizzato; **non** è una prova di accesso
PostgreSQL o di rete dal runtime Render. La stringa Supabase mostra
`postgres.<project-ref>`, ma il worker userà
`demos_outbox_runtime.<project-ref>` con privilegi minimi.

**Blocco residuo: LOGIN disattivato** per `demos_outbox_runtime`,
ancora senza password. La migrazione di attivazione con modifiche
amministrative è stata rifiutata dai permessi Supabase e il successivo
tentativo di abilitare soltanto LOGIN è stato bloccato dai controlli
di sicurezza della piattaforma. **Non aggirare il blocco**.
Verifica SQL successiva: `rolcanlogin=false`, **0** eventi in coda.
Non è stato creato nessun servizio Render né configurato alcun secret.
Per continuare serve un'abilitazione amministrativa autorizzata di
LOGIN, la generazione e gestione sicura di una password dedicata,
la verifica del consumo ore Render Free, quindi un runtime isolato
con `npm run audit:outbox:render-staging-preflight`.

### Controllo del pooler verificato nel codice (22 ottobre 2026)

- L'URL del **solo staging Supabase** è vincolato ora al Session Pooler
  realmente mostrato da Connect:
  `aws-1-eu-central-1.pooler.supabase.com:5432`.
  Il guard rifiuta gli hostname generici o i cluster Supavisor con
  un indice differente. Il controllo è applicato sia al **preflight**
  sia all'apertura del **pool del worker**; pertanto un errore non
  raggiunge il database.
- Per il preflight Render si accetta **solo session pooler IPv4**,
  non la connessione diretta IPv6 del piano Free. Nessun cambio al
  percorso `production` o alla CI con PostgreSQL locale.
- Le fixture dei test sono state aggiornate in modo coordinato al
  pooler verificato, compresi test negativi contro cluster simili
  e per la connessione diretta non supportata da Render.
- Il database staging è `ACTIVE_HEALTHY` con
  `demos_outbox_runtime` ancora **NOLOGIN** e nessun evento
  nella coda. Un tentativo precedente di abilitare il ruolo era stato
  respinto dai permessi del provider e dai controlli di sicurezza:
  **non** ripetere con elevazioni o bypass. La prova autenticata
  deve usare un flusso amministrativo autorizzato.
- **Nessun deploy, nessuna password, nessuna modifica alla produzione.**
  Il controllo della disponibilità di ore Free di Render e la scelta
  dell'istanza isolata precedono qualsiasi attivazione.

### LOGIN Supabase abilitato e verificato (22 ottobre 2026)

Dopo l'esecuzione nel pannello SQL Editor da parte dell'utente del
comando `ALTER ROLE demos_outbox_runtime LOGIN`, lettura in sola
lettura dei cataloghi `Demos-Staging` conferma **`rolcanlogin=true`**,
`rolsuper=false`, `rolbypassrls=false`, appartenenza a
`demos_outbox_worker` e grant `SELECT/INSERT/UPDATE/DELETE`
sulla sola tabella `demos_private.audit_delivery_outbox`.
Sono inoltre confermati **0** accessi ad altri oggetti,
**0** routine `SECURITY DEFINER` accessibili,
`CREATE` in `public` negato, **0** eventi in coda e **0** rilievi
Supabase Security Advisor.

**Il requisito LOGIN è completato, ma NON il test di autenticazione.**
Non è stata predisposta alcuna password dall'assistente, nessun secret
è stato installato su Render e non è stato effettuato un handshake
PostgreSQL autenticato dal runtime Render. Per il prossimo GO serve
una credenziale robusta distinta da quella del ruolo amministrativo,
gestita senza esporla nei log, seguita dalla scelta di un runtime Render
isolato e dal preflight senza scritture.

### Preflight autonomo con un solo segreto — verificato in CI

Il comando `audit:outbox:render-staging-preflight` non richiede più
`DATABASE_URL`, quindi non è necessario copiare credenziali
amministrative o del backend principale su Render. Accetta soltanto
`AUDIT_OUTBOX_DATABASE_URL`, uno scope `staging`, il flag esplicito
`AUDIT_OUTBOX_PREFLIGHT_ONLY=true`, i dataset
`AXIOM_DATASET=AXIOM_REALTIME_DATASET=demos-security-staging` e
i flag che controllano worker, invii e archiviazione spenti.
Verifica hostname/porta/progetto **prima** di creare una connessione,
poi esegue solo letture dei cataloghi PostgreSQL e non avvia Express,
Axiom, Firebase o B2. Il normale backend e il worker mantengono
l'obbligo di verificare entrambe le identità di progetto e
**non possono usare l'eccezione di preflight**.

Controllo CI: il preflight con un solo account è accettato in
simulazione, mentre la connessione applicativa normale senza
`DATABASE_URL` resta rifiutata. Sono rifiutati password/host mancanti,
flag operativi abilitati, scope produzione e host Supavisor estranei.
Questo **non** prova un login autenticato da Render.

Prima del deploy occorre decidere quale servizio Render isolato usare
e verificare le **ore gratuite residue direttamente dal dashboard
Billing → Monthly Included Usage**: il connettore disponibile
non espone il saldo di fatturazione. Non creare un nuovo servizio
web Free senza questo controllo: le 750 ore mensili sono condivise
anche con il backend pubblico.

## Condizioni mancanti per GO

- [ ] **Connessione applicativa di staging reale.** Hostname Session
  Pooler acquisito e verificato su DNS/TCP desktop; il ruolo minimo
  `demos_outbox_runtime` ha **LOGIN attivo**, grant controllati.
  Rimangono password dedicata gestita fuori dai log/chat, configurazione
  `AUDIT_OUTBOX_DATABASE_URL` **come unico segreto database** in un
  runtime Render isolato, `AUDIT_OUTBOX_PREFLIGHT_ONLY=true` e
  `AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`. Non configurare
  `DATABASE_URL` sul runtime di solo preflight. Eseguire
  `npm run audit:outbox:render-staging-preflight` e verificare
  `roleAuthorized=true` senza eventi reali.
- [ ] **Axiom reale.** Con dataset, token e organizzazione di *test*,
  verificare che una singola operazione sintetica attraversi la coda,
  riceva ACK, sia visibile in Axiom con il medesimo
  `axiom_delivery_id`. Ripetere con Axiom temporaneamente indisponibile.
  Conservare soltanto un verbale degli esiti, senza token né PII.
- [ ] **Backblaze B2 reale.** L'archiviatore produttivo è stato
  verificato indirettamente via Render: **27 completamenti, 0 errori
  segnalati e due dataset caughtUp** nella finestra osservata il 21/10.
  Questo non prova il recupero degli oggetti dal bucket. Vedi
  `AXIOM_ARCHIVE_RENDER_OBSERVATION_2026-10-21.md`.
  Con credenziali EU di *sola lettura*,
  verificare un batch già archiviato con
  `npm run archive:axiom:verify-latest -- centralized_logs` e
  `-- real-time`; se esistono oggetti sovrapposti, usare
  `archive:axiom:verify-overlap` con le chiavi tratte da manifest
  autentici. Nessuna scrittura, cancellazione o modifica ai checkpoint.
- [ ] **Notifiche amministrative.** Su backend isolato, verificare
  notifica in-app e FCM di un admin *di test*, simulare FCM indisponibile,
  controllare retry e assenza di duplicati nel database.
- [ ] **GDPR e responsabilità.** Il titolare e il DPO, se nominato, devono
  approvare finalità, dati ammessi, accessi, retention `pending`/
  `dead_letter`, revisione incidenti e cancellazioni eventuali.
  Vedere `AUDIT_OUTBOX_RETENTION_PROPOSAL_2026-10-21.md`.
  **Non assumere un obbligo GDPR uniforme di conservazione pluriennale.**
- [ ] **Piano operativo e rollout.** Verificare che backend/worker Render
  non restino sospesi oltre le soglie della coda e scegliere un
  monitor esterno per indisponibilità simultanea backend+DB. Preparare
  rollback (disattivare worker e accodamento senza cancellare i record
  persistiti), osservare i contatori aggregati e gli allarmi per un
  periodo concordato prima di considerare il rilascio concluso.

## Sicurezza e costi

- Non attivare alcuna retention automatica o cancellazione
  opportunistica dei dead-letter prima dell'approvazione.
- Mantenere `AUDIT_OUTBOX_ENABLED`, `AUDIT_OUTBOX_WORKER_ENABLED`,
  `AUDIT_OUTBOX_SECURITY_ENABLED`,
  `AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED` spenti finché mancano le verifiche.
- Conservare nello staging soltanto eventi sintetici e rimuoverli dopo
  ogni prova, verificando che la tabella torni vuota.
- Piano Supabase Free: il preventivo per `Demos-Staging` è stato
  **0 USD/mese**, non una garanzia illimitata di capacità o uptime.
- Non trasferire credenziali produttive in CI, file o conversazioni.
- Questa checklist non prova la conformità GDPR e non sostituisce
  l'approvazione della politica di conservazione.

## Materiale di riferimento

- GitHub: https://github.com/Nictolas/DemosApp/pull/218
- `AUDIT_OUTBOX_DESIGN_2026-10-21.md`
- `SUPABASE_OUTBOX_STAGING_VERIFICATION_2026-10-21.md`
- `AXIOM_ARCHIVE_RENDER_OBSERVATION_2026-10-21.md`
- `axiom-b2-log-archive.md`

**Criterio di chiusura del lavoro:** tutte le condizioni GO completate con
evidenza, rilascio in produzione effettuato, verifica post-deploy riuscita,
nessun backlog o dead-letter anomalo e percorso di rollback provato.
