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
| Coda PostgreSQL, lease, retry, dead-letter, collisioni e capacità | Suite PostgreSQL 17 reale su GitHub CI; dataset sintetico | PASS |
| Staging Supabase | `Demos-Staging` (`fkeayjzvtuvzesljhjbc`), due migrazioni e RLS; eseguito anche INSERT/claim/lease/retry/dead-letter/DELETE **con ruolo NOLOGIN effettivo** in una transazione con `ROLLBACK`, senza creare password o dati residui | PASS SQL (non LOGIN/HTTP) |
| Data API pubblica dello staging | GET anon su tabella/schema privato → HTTP 404/406 | PASS negativo |
| Isolamento dei progetti | `AUDIT_OUTBOX_DEPLOYMENT_SCOPE` e `AUDIT_OUTBOX_DATABASE_URL` separata; mismatch fallisce prima della creazione del pool | PASS test |
| Reinvio Axiom 503 → 202 con ID stabile | Axiom HTTP simulato su PostgreSQL CI; **non** consegna reale | PASS simulazione |
| Archiviazione Axiom → B2 e recupero duplicati | CI con oggetti sintetici e controlli SHA256 e gzip; **27 completamenti operativi del job Render** nella finestra osservata, ma senza readback B2 | PASS simulazione + verifica operativa parziale; restore NON verificato |
| Avvisi amministrativi | Retry dopo errore DB; avvisi concorrenti; DB riuscito + FCM fallito non genera duplicati; solo test sintetici | PASS simulazione |

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
