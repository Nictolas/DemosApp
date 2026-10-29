# DEMOS — GH-296 / Cut-off recovery: writer privilegiati e ingressi multipli

**29 ottobre 2026 — SOLTANTO prove sintetiche e pianificazione.**
**GH-296 = NO-GO / `recoveryReady:false`.**
Il documento NON approva un PITR/restore, non descrive cambiamenti già effettuati sui provider e non autorizza concessioni/revoche di privilegi, kill di sessioni vere, rollback, deploy, nuove infrastrutture o verifiche invasive.

## Il problema che cambia il piano operativo

Una RLS attiva, anche con `FORCE ROW LEVEL SECURITY`, non limita PostgreSQL `SUPERUSER` e `BYPASSRLS`. Disabilitare `LOGIN` per il ruolo applicativo non termina le sue connessioni esistenti. Terminare le connessioni applicative non interrompe le connessioni indipendenti di amministratori, ETL, provider, pooler o API.

Questa è una **barriera diversa** dal controllo di identità SQL di una CLI isolata. La CLI staging osserva un solo client nuovo. Anche un esito `READONLY_EXPECTED_STAGING_ROLE_NOT_RUNTIME` non garantisce che gli altri ingressi siano chiusi.

### Evidenze già acquisite

- **Catalogo Supabase Demos-Staging, solo SELECT (Fase Q):** `public.privacy_erasure_ledger` ha RLS+FORCE, tre policy e nessun grant DML diretto a `anon`/`authenticated`/`service_role`. `demos_staging_runtime` ha SELECT+INSERT, `demos_staging_b2_worker` soltanto SELECT; entrambi `NOBYPASSRLS`. I ruoli provider `postgres`, `supabase_admin`, `supabase_etl_admin`, `supabase_read_only_user` hanno `BYPASSRLS` (non tutti hanno grant di scrittura sul ledger). La loro esistenza **non** dimostra un accesso attivo, ma richiede un'attestazione di isolamento separata. Vedi `api/docs/gdpr-staging-ledger-live-catalog-audit-20261029.md`.
- **PG17 sintetico precedente:** `api/tests/gdprDualPlaneQuarantinePg17Synthetic.test.js` dimostra che un blocco HTTP non blocca l'accesso diretto SQL; `NOLOGIN` non uccide sessioni aperte e bloccare SQL non blocca HTTPS.
- **Nuova regressione di PG17 locale:** `api/tests/gdprPrivilegedWriterBypassPg17Synthetic.test.js` usa un database usa-e-getta `gdpr_outbox_worker_ci` su `127.0.0.1` e account/dati INVENTATI. Imposta RLS+FORCE e una policy applicativa restrittiva; un secondo ruolo indipendente non-superuser con `BYPASSRLS` può inserire una riga altrimenti vietata. `ALTER ROLE app NOLOGIN` non interrompe sessioni aperte, e perfino dopo `pg_terminate_backend` dell'app il writer privilegiato continua a scrivere. **La prova dimostra un controesempio tecnico, NON il comportamento o la configurazione del Supabase reale.**
- **Epoch esterno sintetico:** `api/tests/fixtures/gdprIndependentAdmissionEpochSynthetic.js` simula un'autorità esterna a PostgreSQL; i suoi flag booleani `writersFenced`, `ingressBlocked`, `providersQuarantined`, `journalComplete` e `replayVerified` sono **finti**, non attestazioni di provider da rilasciare come GO.

## Matrice di evidenza che deve essere indipendente dal database da ripristinare

| Piano / vettore | Perché non basta il codice dell'app | Requisito di prova prima di riaprire |
|---|---|---|
| Render backend e job cron/worker, inclusi deploy precedenti | Un vecchio processo o processo separato può usare credenziali ancora attive | Elenco dei processi e revisioni effettivi, quarantena/freeze confermati fuori dal database, nessun job producer rimasto |
| PostgreSQL diretto | Sessioni esistenti sopravvivono a `NOLOGIN`; owner/BYPASSRLS può ignorare RLS | Negazione indipendente di nuove ammissioni **e** verifica della conclusione/terminazione delle sessioni vecchie, compresi role admin/ETL e credential preesistenti |
| Supavisor pooler (session e transaction) | Sessioni e credenziali del pooler non corrispondono automaticamente a quelle dirette | Prova separata di revoca/chiusura su entrambe le porte/modalità e verifica che non esistano writer già ammessi |
| PostgREST / Data API / GraphQL / RPC | Negare il backend Render non nega richieste HTTPS dirette, RPC SECURITY DEFINER o token pregressi | Quarantena HTTPS provider e negative test autorizzati su chiavi/JWT/sessioni vecchi; non dedurre sicurezza dalle sole ACL del ledger |
| Auth / Storage / Realtime | Altri ingressi potrebbero aggiornare stato o emettere eventi mentre il restore è in corso | Isolamento su servizi e flussi, credenziali privilegiate e token pregressi; negative test o evidenze provider per ciascun piano |
| Backblaze B2 e journal erasure esterno | Una ricevuta fittizia non garantisce Object Lock, versioning, freschezza e replay | Verifica del bucket/versioni/retention/checkpoint firmati da fonte esterna e replay su restore isolato, prima di qualunque ingresso |
| Gate esterno di ammissione | Un gate locale salvato nel database può tornare ad `open` da snapshot PITR | Decisione out-of-band collegata a nuova generazione DB/epoch, firma e scadenza verificabili; assenza/ambiguità => **NO-GO** |

### Requisiti per registrare prove reali

Ogni evidenza deve avere almeno: *provider e superficie identificati*, *ambiente*, *DB generation/restore identity*, *ora di osservazione*, *autorità indipendente da snapshot*, *strumento/operatore autorizzato*, *risultato e checksum/riferimento verificabile* e *controllo negativo di credenziali/sessioni pregresse* dove applicabile. Non sostituire queste attestazioni con booleani manuali, semplici log di Render o query `pg_stat_activity` di una sola sessione.

**Non raccomandare comandi `ALTER ROLE ... NOLOGIN`, `REVOKE` o `pg_terminate_backend` sul servizio reale finché non sono disponibili:** piano di cut-off e rollback operativo, inventario di tutti i writer/utenti/provider, ambiente di prova isolato, autorizzazione del titolare e documentazione DPO/DPIA. I ruoli del provider sono condivisi con superfici che un cut-off superficiale potrebbe compromettere.

## Decisione attuale

- Cosa può essere dichiarato **verificato**: solo catalogo dei privilegi di staging osservato dalla Management API e regressioni di PostgreSQL 17 **synthetic-only**.
- Cosa NON è verificato: sessioni SQL del backend Render, bypass del pooler, portata delle credenziali admin, esposizione dei percorsi HTTPS, attuabilità del cut-off del provider, integrità del checkpoint B2 e replay, via di ammissione post-restore.
- **GH-296 resta aperta, NO-GO; nessun restore, deploy o modifica provider.**
