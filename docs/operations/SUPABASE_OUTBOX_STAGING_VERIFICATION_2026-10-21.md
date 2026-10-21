# Demos-Staging — Verifica outbox Supabase (21 ottobre 2026)

**Esito: progetto Supabase separato creato e collaudo SQL reale riuscito.**
**Non è un'autorizzazione al rollout di produzione.** Questo documento contiene
solo gli identificativi pubblici dei progetti, risultati aggregati e istruzioni;
nessuna password, token, dato personale o stringa di connessione privata.

## Separazione e costi

| Elemento | Dettaglio |
| --- | --- |
| Progetto di staging | `Demos-Staging` |
| Project ref staging | `fkeayjzvtuvzesljhjbc` |
| Organizzazione | `DemosReplit` (piano Free) |
| Regione | `eu-central-1` |
| Database di staging | PostgreSQL 17.11 |
| Stato verificato | `ACTIVE_HEALTHY` |
| Preventivo connettore Supabase prima della creazione | **0 USD/mese**, con limiti del piano Free |
| Progetto di produzione DEMOS | `wxnblcqoyjqxktwkcqok` — **non modificato** |
| Vecchio progetto `DemosReplit` | `INACTIVE` — non utilizzato nel test |

**Attenzione ai costi:** il preventivo di creazione è 0 USD/mese. I limiti di
progetti gratuiti e delle risorse vanno ricontrollati se la configurazione
dell'organizzazione cambia. I progetti Free possono sospendersi per inattività;
lo staging è per collaudi, non un servizio che deve restare sempre acceso.

## Migrazione applicata soltanto sullo staging

- Prima migrazione: `create_private_audit_delivery_outbox_staging`, versione `20261021154902`.
- Seconda migrazione: `grant_private_audit_outbox_worker_staging`, versione `20261021160408`.
- Oggetti: schema `demos_private`, tabella `audit_delivery_outbox`,
  chiave primaria, indice `audit_delivery_outbox_due`, indice
  `audit_delivery_outbox_expired_lease`.
- RLS attiva; una sola policy per `demos_outbox_worker`, senza policy aperte agli utenti.
- Schema e tabella senza permessi per `anon` e `authenticated`.
- L'identità Postgres proprietaria ha il permesso di inserimento. La
  `service_role` non ha un grant SELECT su questa tabella; non usare la
  chiave `service_role` per accedere alla coda attraverso la Data API.
- Ruolo `demos_outbox_worker` creato **NOLOGIN**, senza `BYPASSRLS`,
  superuser o permessi di creazione su `public`. I grant **espliciti**
  aggiunti riguardano `USAGE` sullo schema privato e
  `SELECT/INSERT/UPDATE/DELETE` sulla tabella, con policy RLS dedicata.
  Nessun **LOGIN applicativo** e nessuna password sono stati creati.
  PostgreSQL/Supabase assegna comunque all'account amministrativo
  `postgres` un'appartenenza amministrativa automatica al ruolo creato:
  `ADMIN OPTION=true`, `INHERIT OPTION=false`, `SET OPTION=false`.
  Non equivale a un login operativo del worker.
- **Nota sulla sicurezza Supabase:** il ruolo eredita comunque dal ruolo
  implicito `PUBLIC` il permesso `USAGE` dello schema `public` (non
  `CREATE`), come verificato nello staging. Prima di introdurre un
  `LOGIN` effettivo bisogna inventariare anche gli altri privilegi
  ereditati da `PUBLIC`; i grant espliciti sulla outbox non costituiscono
  da soli una prova di isolamento totale. Riferimento:
  https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c

**La migrazione non è stata applicata a DEMOS in produzione.** Una query
separata di sola lettura ha confermato l'assenza di `demos_private` nel
progetto di produzione.

## Controlli eseguiti nello staging reale

| Controllo | Risultato |
| --- | --- |
| RLS attiva | Superato |
| `anon` senza USAGE sullo schema e SELECT sulla tabella | Superato |
| `authenticated` senza USAGE sullo schema e INSERT sulla tabella | Superato |
| Indici e vincoli PostgreSQL creati | Superato |
| Ruolo minimo `demos_outbox_worker` NOLOGIN con permessi limitati | Superato (grants/attributi SQL) |
| Richiesta HTTP GET con chiave anon su `/rest/v1/audit_delivery_outbox` | HTTP 404 — tabella non pubblicata |
| Richiesta HTTP GET con `Accept-Profile: demos_private` | HTTP 406 — schema non esposto |
| INSERT di evento audit sintetico con UUID | Superato |
| Claim SQL con `FOR UPDATE SKIP LOCKED` e lease | Superato |
| Simulazione HTTP fallito: ritorno in `pending` | Superato |
| Secondo claim: `attempt_count=2` e ID invariato | Superato |
| Tentativo di DELETE con vecchio lease: zero righe cancellate | Superato |
| DELETE con lease corrente: una riga cancellata | Superato |
| Evento security sintetico al tentativo 8: `dead_letter` | Superato |
| `dead_letter` escluso dall'insieme dovuto al retry | Superato |
| Rimozione dei **soli due eventi sintetici** | Superato |
| Righe nella tabella alla fine | **0** |

I claim e le transizioni sono stati eseguiti direttamente tramite query SQL
nel nuovo progetto, usando lo stesso schema di query del codice applicativo.
**Non** sono state eseguite chiamate HTTP a un dataset Axiom reale, notifiche
FCM o un'app DEMOS deployata sullo staging. L'invio "fallito" e la conferma
sono simulazioni esplicite, non richieste HTTP a provider.

La concorrenza effettiva tra due connessioni è stata testata separatamente
nella pipeline GitHub Actions usando PostgreSQL 17 temporaneo. Va ancora
eseguita con le credenziali del ruolo backend e la configurazione completa
Supabase di staging.

La prova API HTTP è stata una verifica **GET** negativa, non un tentativo
POST o un test con credenziali amministrative.

### Nuovo collaudo con ruolo effettivo sul PostgreSQL Supabase reale

**21 ottobre 2026:** senza creare un login o una password, il connettore
SQL è riuscito a impostare temporaneamente il ruolo **effettivo**
`demos_outbox_worker` entro un'unica transazione, concedendo il permesso
`SET ROLE` temporaneo a `postgres` e terminando con `ROLLBACK`.
Il test ha verificato nel **vero** PostgreSQL 17.11 di Demos-Staging:

- `current_user = demos_outbox_worker`, RLS attiva, privilegi di
  inserimento presenti e nessun permesso di creazione nello schema privato;
- INSERT di un evento audit **esclusivamente sintetico**;
- acquisizione `FOR UPDATE SKIP LOCKED`, passaggio in `sending`,
  token di lease e aumento del contatore;
- ritorno in `pending`, passaggio in `dead_letter`, verifica di
  presenza e DELETE sotto il ruolo limitato;
- `ROLLBACK` conclusivo, senza lasciare righe né modificare
  permanentemente i grant.

L'ispezione successiva di `pg_auth_members` mostra che `postgres`
possiede la consueta appartenenza amministrativa del ruolo creato
(`ADMIN=true`, `INHERIT=false`, `SET=false`, grantor
`supabase_admin`). Il permesso aggiuntivo di `SET ROLE` del test
**non è rimasto attivo**. Nessuna policy è stata aggiunta e l'advisor
Supabase Security ha restituito zero segnalazioni.

**Ambito della prova:** sono operazioni SQL reali sotto un ruolo
`NOLOGIN` mediante impersonazione temporanea; **non** dimostrano ancora
l'autenticazione di un account LOGIN applicativo via Session Pooler, né
un backend DEMOS isolato realmente connesso a Demos-Staging. La prova
HTTP Axiom/FCM e il recupero read-only B2 restano da completare.

## Advisor Supabase

- **Security advisor:** nessun avviso dopo aver creato una policy RLS
  esclusivamente per il ruolo `demos_outbox_worker` (NOLOGIN). Prima della
  seconda migrazione appariva il solo avviso informativo
  `rls_enabled_no_policy`, ora non più presente.
- **Performance advisor:** nessuna segnalazione al momento della verifica.

Non creare policy aperte a `anon` o `authenticated` per eliminare avvisi.

## Preflight runtime isolato e sola lettura — nuovo comando

Prima di creare o attivare un backend di collaudo, usare soltanto una
connessione del ruolo PostgreSQL dedicato allo **staging**.
Il server connesso deve avere `DATABASE_URL` puntata **esclusivamente
a Demos-Staging** e `AUDIT_OUTBOX_DATABASE_URL` impostata tramite un
secret manager (non salvare password in Git, issue, documentazione, log o cron).
Deve inoltre impostare `AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`.
Le due URL devono essere distinte per credenziale ma riferite allo **stesso
progetto** `fkeayjzvtuvzesljhjbc`. Il codice verifica entrambi gli
identificativi; rifiuta un backend principale collegato a DEMOS produttivo,
anche quando la URL della outbox punta a staging. Non riusare la normale
`DATABASE_URL` di DEMOS.

L'eventuale `DATABASE_URL` dello staging può usare il pooler Supavisor
in modalità transaction sulla porta **6543**, coerentemente con il
backend esistente; `AUDIT_OUTBOX_DATABASE_URL` deve usare invece
la modalità **session sulla porta 5432** o una connessione diretta 5432.
Il controllo del progetto è indipendente dal metodo usato per il database
principale. Il parser rifiuta 6543 **soltanto per l'outbox**, evitando
un falso blocco del normale backend.

```bash
cd api
npm run audit:outbox:staging-preflight
```

Il comando non invia eventi ad Axiom e non esegue INSERT/UPDATE/DELETE.
Accetta esclusivamente il progetto
`fkeayjzvtuvzesljhjbc`: connessione diretta Postgres (porta 5432)
oppure **Supavisor session pooler** (porta 5432) con il suffisso
`.<project-ref>` nel nome utente. Respinge l'account amministrativo
`postgres`, host non appartenenti al progetto, connessioni di produzione,
database diversi da `postgres` e il pooler transaction-mode su 6543.
Verifica i privilegi effettivi tramite il modulo
`auditOutboxDatabase`; stampa soltanto un esito e l'identificativo
pubblico dello staging, mai credenziali o contenuti di eventi.

La connessione diretta dei progetti Free richiede IPv6; da un host
IPv4-only usare la stringa **esatta** del Session Pooler nel
pannello Supabase → Connect. Il prefisso `aws-[INDEX]` del pooler
non può essere indovinato dalla regione.
Guida ufficiale: https://supabase.com/docs/guides/database/connecting-to-postgres

**Verifiche del 21/10/2026:** il controllo DNS dell'endpoint diretto
`db.fkeayjzvtuvzesljhjbc.supabase.co` dal computer desktop collegato
non ha restituito un indirizzo; non sono state create credenziali login
di staging soltanto per aggirare tale limite. Il nuovo comando è
coperto da test automatici su URI sintetiche, ma **non è stato eseguito
contro Supabase con una password reale**. Questo resta un blocco
esplicito del collaudo end-to-end. Non attivare il worker.

## Preparazione dell'identità runtime (21 ottobre 2026, senza LOGIN)

Con il progetto **Demos-Staging** confermato, è stata applicata la terza
migrazione Supabase `20261021212727`
(`prepare_demos_outbox_runtime_nologin_staging`). Ha creato
`demos_outbox_runtime` con `NOLOGIN`, senza password, senza privilegi
superuser, `BYPASSRLS`, `CREATEDB`, `CREATEROLE` né `REPLICATION`,
e ha concesso esclusivamente l'appartenenza ereditaria al ruolo
`demos_outbox_worker` (con `SET FALSE`). Non è una connessione di rete,
non crea un utente applicativo utilizzabile e non abilita i flag outbox.

**Verifica SQL effettiva (non simulata):** tutti gli attributi privilegiati
sopra sono assenti; il ruolo eredita solo `USAGE` su `demos_private` e
`SELECT/INSERT/UPDATE/DELETE` sulla tabella
`audit_delivery_outbox`; non può creare in `public`. Inventario:
**0 tabelle estranee leggibili**, **0 routine `SECURITY DEFINER`
accessibili**, **0 eventi residui**. Non sono stati creati segreti
o account `LOGIN`; il database DEMOS di produzione è intatto.

**Connessione reale ancora BLOCCATA**, senza interpretazioni ambigue:
Render non dispone di IPv6 outbound per la connessione diretta gratuita,
quindi è necessario il vero hostname **Supavisor Session Pooler, porta
5432**, dal pannello *Supabase → Demos-Staging → Connect → Session pooler*.
L'hostname contiene un indice di cluster che **non può essere dedotto**
dalla regione. È un dato non segreto: va acquisito esattamente dal
pannello. Successivamente occorre abilitare `LOGIN` esclusivamente
per `demos_outbox_runtime`, impostare una password casuale tramite un
canale sicuro di configurazione, inserirla nel servizio Render isolato
e lanciare il preflight senza mai stamparla. Non farlo prima di aver
scelto un ambiente di staging Render sicuro e verificato il budget
di ore Free condiviso col servizio produttivo.

## Bloccanti prima di abilitare la coda su DEMOS

1. Confermare con il titolare/DPO, ove presente, finalità, campi ammessi,
   retention `pending`/`dead_letter` e trattamento incidenti; vedi
   `AUDIT_OUTBOX_RETENTION_PROPOSAL_2026-10-21.md`.
2. Eseguire un test applicativo end-to-end in staging con un backend
   isolato, credenziali Postgres limitate, Axiom/dataset di prova e
   destinatari admin sintetici. Non collegare il backend di produzione a
   `Demos-Staging`.
3. **Verificati** Data API HTTP in lettura (404 pubblico, 406 schema privato),
   RLS e grants del ruolo tecnico NOLOGIN. **Da completare**: accesso
   end-to-end con una vera credenziale backend di staging limitata e
   collaudo delle operazioni sotto quell'identità, senza stampare password
   o token. **Nel frattempo la CI PostgreSQL 17 ha eseguito con successo**
   un test completo usando un login sintetico `demos_outbox_runtime_ci`
   associato al ruolo NOLOGIN. Il codice applicativo crea un pool
   dedicato da `AUDIT_OUTBOX_DATABASE_URL` e rifiuta utenti con superuser
   o BYPASSRLS. Questa prova CI non sostituisce la connessione al progetto
   Supabase di staging.
4. Verificare l'ACK Axiom, l'eventuale consegna duplicata, la notifica
   amministrativa, e il comportamento in caso di ripartenza/fallimento DB.
5. Svolgere un recupero **di sola lettura** di B2 usando credenziali
   autorizzate, senza duplicare il job d'archivio di produzione.
6. Soltanto dopo le verifiche e la policy approvata: valutare una migrazione
   separata e un'attivazione progressiva su DEMOS con rollback.

## Integrazione reale PostgreSQL e trasporto Axiom simulato

È stato aggiunto al test `api/tests/auditOutboxRealPostgres.test.js`
uno scenario end-to-end con PostgreSQL 17 vero, login `demos_outbox_runtime_ci`
dotato dei soli privilegi ereditati dal ruolo `demos_outbox_worker`,
`AuditService.sendPreparedAuditEventToAxiomHTTP()` e un trasporto HTTP
Axiom **sostituito nel test** con un adapter che prima simula un errore
503 e poi risponde 202.

La verifica controlla che la coda mantenga il record dopo il primo
tentativo, ritenti dopo lo sblocco e conservi esattamente lo stesso
`axiom_delivery_id` nei due payload; dopo l'ACK il record viene
eliminato. Non viene chiamata nessuna API Axiom reale. La rete del
database PostgreSQL è quella del container effimero GitHub Actions:
questa prova non sostituisce un'app configurata su Demos-Staging.

**Stato finale:** staging con schema vuoto e identità runtime NOLOGIN senza password; nessun worker collegato;
nessun flag di outbox attivato; produzione intatta.
