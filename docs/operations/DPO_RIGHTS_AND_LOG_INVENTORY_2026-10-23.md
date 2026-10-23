# DEMOS — verifica richieste GDPR e perimetro logging (23 ottobre 2026)

## Evidenza: contatore errato nel pannello DPO
Verifica di sola lettura su Supabase produzione `wxnblcqoyjqxktwkcqok`, senza estrarre identificatori degli utenti, IP, preferenze politiche o payload:

- `public.user_rights_requests`: **1.713** righe con `request_type=data_export`, `status=completed`, stesso `created_at=2026-04-17T14:13:39.349388Z`.
- `request_data` è un JSON oggetto con **solo** `source=migration_seed`, `note=baseline record` in tutte le 1.713 righe.
- **0** righe operative fuori da `migration_seed` al momento della verifica.
- `processed_at` e `processed_by` nulli per tutte. Il campo `completed` dei seed **non prova evasione reale di richieste**.
- I 1.713 seed riguardano 1.710 user_id distinti; 1.694 user_id hanno ancora corrispondenza con un record `users` corrente. Non trarre conclusioni legali da questo solo confronto.

**Correzione:** `GET /api/dpo/overview` presenta `gdpr_requests_total` come conteggio di righe **non** identificate da `request_data.source=migration_seed`; espone conteggi aggregati pending/processing/completed e `gdpr_requests_migration_excluded`. Nessuna lettura delle preferenze politiche, elenco degli interessati, scrittura/cancellazione dei 1.713 record o variazione dei ruoli. Il frontend distingue esplicitamente i seed da istanze operative e chiarisce che la tabella non rappresenta necessariamente tutti i canali di esercizio dei diritti.

Il codice di `api/routes/user/gdpr-rights.js` per un'**effettiva esportazione utente** registra `request_data.export_date` e `format`, diversamente dal seed. Separare statistiche operative da import non autorizza **cancellare** i seed: occorre controllarne la funzione, le dipendenze e la policy di conservazione.

## Inventario log: fatti vs questioni aperte

| Sorgente | Evidenza codice/runtime | Finalità plausibile | Necessità e retention |
| --- | --- | --- | --- |
| `centralized_logs` Axiom | writer tecnico; archiver Axiom→B2 produttivo con completamenti orari | debug e operatività | inventariare campi prima di approvare RP-09 30g |
| `real-time` Axiom | `api/services/auditService.js`; include eventualmente `user_id`, IP, dettagli; archiviazione B2 | audit applicativo e sicurezza | classificare eventi, giustificazione identificatori e RP-10 180g ancora **proposta** |
| Render app/request logs | backend emette messaggi tecnici e della autenticazione | diagnostica e incident response | verificare eventuali identificatori/segreti, piano e durata effettiva |
| Supabase DB/API/connection logs | esistono varie famiglie di log provider; progetto produzione Free | gestione database e infrastruttura | stabilire se coprono accessi AdS, quali identità e quali durate; non dedurlo dal mero volume |
| Archivio Backblaze B2 | job attivo, `HEAD`/hash prima checkpoint; **restore readonly su staging passato** (CP-EA-057) | recuperabilità dei record | controllare lifecycle realmente configurato, encryption, separazione per categoria e cancellazione |
| Outbox privata PostgreSQL (PR #218) | codice e CI testati, prova staging limitata; **PR ancora draft, non live in prod** | trasporto affidabile dei soli eventi necessari | decidere *se* serve; RP-17 e dead-letter non approvati, niente attivazione |

### Problemi concreti da esaminare senza espandere la raccolta
1. La route `api/routes/auth/profile.js` emette nel log un prefisso del bearer token e un identificatore dell'utente; eliminare quelle stampe in un intervento mirato e testato, senza sopprimere logging diagnostico necessario. Valutare gli altri writer analoghi.
2. `AuditService.cleanupOldLogs(daysToKeep=365)` contiene un valore storico e un fallback database; individuare tutte le chiamate possibili, confrontare con policy e protezioni già esistenti prima di avviare cancellazioni.
3. Con `AXIOM_ARCHIVE_ENABLED` attivo, B2 **copia gli eventi integri**, non riduce automaticamente dati personali; le durate in Axiom e nel bucket devono essere distinte e controllate.
4. Chiarire se il caso-limite «titolare unico amministratore di sistema» previsto dal Garante si applica realmente agli accessi tecnici, incluse credenziali di provider/outsourcing; un solo Admin **applicativo** non lo dimostra.
5. Prima di attivare PR #218: schema categoria→finalità→campi→volumi→accesso→retention→cancellazione/exception→provider; consultazione DPO e decisione del titolare.

## Stato delle decisioni
- RP-09 (log operativi, 30g), RP-10 (security/audit, 180g) e RP-17 (outbox e dead-letter) **non sono approvate** come durate generali.
- Non impostare cancellazioni B2, non alterare Axiom/Render/Supabase e non mergiare PR #218 prima della valutazione.
- I log delle autenticazioni degli amministratori di sistema, **dove il provvedimento è applicabile**, hanno perimetro diverso dai log generali di attività degli utenti. Fonte: https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/1577499 e GDPR art. 5: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/.
- I prossimi passi richiedono **verifica effettiva impostazioni dei provider**, parere DPO documentato e approvazione delle politiche prima delle modifiche irreversibili.

Nessuna modifica ai dati personali è stata eseguita nel corso di questa verifica.