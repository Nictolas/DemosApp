# DEMOS 10 — Verifica read-only della continuità del pooler (04/11/2026)

Questa modifica è **solo un incremento di PR #565**. Non è un deploy e non autorizza app, notifiche o migrazioni.

## Cosa verifica

Dopo l'audit di identità DB, schemi, privilegi, RLS e blocco invii, il preflight:
1. osserva internamente PID PostgreSQL e `application_name`;
2. imposta un marcatore casuale solo per la sessione tramite `set_config('application_name', ..., false)`;
3. esegue quattro transazioni distinte `BEGIN READ ONLY` / `ROLLBACK`;
4. controlla dentro e fuori ogni transazione che PID e marcatore rimangano invariati;
5. ripristina `application_name` e chiude la connessione.

Se PID o marcatore cambiano, il preflight fallisce in modo sicuro. Il controllo richiede il ruolo minimo dedicato `demos_staging_preflight`. La risposta HTTPS pubblica espone soltanto il booleano `session_pooler_continuity_observed`, senza PID, valori temporanei o segreti.

## Limiti

`session_affinity_verified` **resta sempre false**: l'osservazione del preflight non prova gli advisory lock del ruolo applicativo, il pool finale, gli E2E Android o il funzionamento delle notifiche. `/health/ready` resta 503 e i sette flag di invio/sync/migrazione restano OFF. Il test usa un hostname validato di pooler **session mode** `:5432`; non sostituisce la prova effettiva dell'app con utenti sintetici.

## Evidenza e prossima verifica

Worktree isolata: **66/66 test Node PASS**, `git diff --check` PASS. Test simulati locali, nessun deploy né connessione staging reale con questo nuovo codice. Dopo review e CI, coordinare l'integrazione in #565 e solo allora eseguire un deploy controllato sullo **stesso** Render `demos-staging` con la guardia ancora bloccata. Verificare `/health/preflight`=200 con `session_pooler_continuity_observed=true` e `/health/ready`=503, poi il gate indipendente degli advisory lock applicativi.

**T-55 resta parziale**, 0/6 gate E2E civici, rilascio NO-GO.
