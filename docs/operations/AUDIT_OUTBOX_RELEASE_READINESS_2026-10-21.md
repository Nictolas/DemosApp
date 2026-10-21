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
| Coda PostgreSQL, lease, retry, dead-letter, collisioni e capacità | Suite PostgreSQL 17 reale su GitHub CI; **13/13 test**, incluso percorso integrato: account ristretto, outbox, ACK Axiom ambiguo e retry, deduplicazione, archiviazione B2 simulata e verifica del restore read-only | PASS simulazione integrata; provider esterni reali ancora NO-GO |
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

## Condizioni mancanti per GO

- [ ] **Connessione applicativa di staging reale.** Ottenere da Supabase
  l'hostname esatto del pooler *session* dello staging, creare un login
  Postgres dedicato con grant minimi e credenziali gestite in un secret
  manager. Impostare entrambe le connessioni sul **solo** backend di
  collaudo e confermare `AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`.
  Eseguire `npm run audit:outbox:staging-preflight`; verificare
  `roleAuthorized=true`. Non copiare le password nei log/issue.
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
