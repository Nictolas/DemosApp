# DEMOS — Procedura di ripresa dopo STOP delle notifiche civiche (bozza)

> **NON ESEGUIRE in produzione senza autorizzazione.** La PR #539 non è distribuita.
> Tutti gli esempi descrivono solo attività future. Non contengono credenziali.
> Ambito: iniziative popolari, referendum abrogativi, ECI. Non riguarda altri push DEMOS.

## Invarianti

- `civic_push_delivery_guard.blocked` resta **TRUE** fino al gate di rilascio;
  nessuno script di preparazione modifica il campo a FALSE.
- Nessuna notifica è inviata da preview, STOP o recovery preparation.
- Eventi già `sent` non vengono ritentati; `failed` e `dispatching`
  richiedono analisi individuale **senza reinvio automatico**.
- Eventi `suppressed` restano suppressed per sempre; mai convertirli
  automaticamente in `pending` durante una riattivazione.
- Quando la guardia è bloccata, sia il collector Ministero sia il sync ECI
  registrano i nuovi eventi come `suppressed` (senza backlog).
- Non alterare preferenze, tokens, status utenti o contenuti personali per
  rendere possibile la ripresa.

## Preflight — ambiente isolato

1. Validare schema, baseline e policy RLS nella **staging verificata**;
   attualmente lo staging DEMOS non è pronto, quindi questo gate è NO-GO.
2. Confermare lo stesso DB tra sincronizzatori e backend, flag server-side,
   permessi FCM, account test e iscrizioni topic di prova. Niente utenti reali.
3. Eseguire suite isolata PR #539: Node mock, PostgreSQL16 effimero e frontend.
4. Eseguire il rollback solo se necessario, dopo approvazione:
   `node api/scripts/civicPushEmergencyStop.js` è **sola preview**.
   La modalità APPLY richiede entrambe le variabili
   `CIVIC_PUSH_ROLLBACK_APPLY=true` e
   `CIVIC_PUSH_ROLLBACK_CONFIRM=I_APPROVE_CIVIC_EMERGENCY_STOP`.
   Non impostarle finché la richiesta non è autorizzata.

## Recovery preparation — **mai** sblocca il push

1. Fare una preview con
   `node api/scripts/prepareCivicPushRecovery.js`.
   Leggere solo conteggi aggregati e stato della guardia.
2. Se `pendingToSuppress > 0`, non procedere: ripetere il processo STOP,
   verificare le fonti e rileggere la preview.
3. Se `uncertainEventsForManualReview > 0`, non procedere: ispezionare
   manualmente gli ID in una console autorizzata, senza esportarli nei log.
   Non marcarli `pending` e non ritrasmetterli automaticamente.
4. Con `pending=0`, `failed=0`, `dispatching=0`, guardia ancora
   `blocked=TRUE` e `reason_code=EMERGENCY_STOP`, l'operatore autorizzato
   può eseguire la preparazione con entrambe le conferme:
   `CIVIC_RECOVERY_PREPARE_APPLY=true` e
   `CIVIC_RECOVERY_PREPARE_CONFIRM=I_APPROVE_BLOCKED_RECOVERY_HOLD`.
5. Il risultato è `reason_code=RECOVERY_HOLD` e `blocked=TRUE`.
   Non significa che la funzione sia attiva o che il canary sia riuscito.
   Con questa guardia anche le nuove iniziative continuano a essere suppressed.

## Prima dell'eventuale accensione

- Concludere gli altri **sei gate** operativi: configurazione fonti/FCM,
  staging, test Android/PWA reali, audit privacy/DPO, canary isolato,
  autorizzazione esplicita al rilascio.
- Verificare il riallineamento FCM con guardia bloccata, inclusi opt-out e
  account eliminati. Usare il tool bootstrap (dry-run di default) soltanto in
  ambiente autorizzato e con le istanze backend coordinate.
- L'eventuale cambio finale `blocked=FALSE` è **FUORI** dagli script di
  recupero e richiede un intervento separato autorizzato con test e audit
  positivi. Non esiste uno sblocco automatico.
- Monitorare soltanto conteggi aggregati, senza token, dati personali o
  payload FCM nei log. Se compaiono duplicati, revoche incerte o errori,
  tornare al processo STOP.

## Gate identità database e staging (N-007 / N-038)

- L'installazione autorizzata della migrazione crea una riga privata
  `civic_runtime_identity` con UUID casuale, non accessibile ai client
  (RLS attivo e nessun privilegio `PUBLIC`). La migrazione è idempotente:
  una riesecuzione non cambia l'identificativo.
- **Prima di abilitare `CIVIC_NEW_INITIATIVE_EVENTS_ENABLED` o
  `CIVIC_NEW_INITIATIVE_PUSH_ENABLED`**, verificare che Render e l'Action
  ECI siano effettivamente collegati allo stesso database. Un operatore
  autorizzato legge l'UUID solo in una console sicura, lo configura
  separatamente come `CIVIC_RUNTIME_DATABASE_ID` nei due ambienti e
  prova la verifica di corrispondenza. Non inserirlo in issue, log,
  URL, risposte HTTP o fogli di lavoro.
- ECI verifica l'UUID *prima di sostituire la cache* quando la
  raccolta civica è abilitata; il collector Ministero verifica prima
  di accodare, il dispatcher verifica prima di inviare.
  Mancanza/disaccordo della configurazione genera errore fail-closed.
- Un database di staging clonato dalla produzione può ereditare la
  stessa UUID: il controllo non è una prova crittografica dell'identità
  fisica dopo un clone. Verificare separatamente connessioni, provider,
  schema, ambiente e rigenerare l'identità di staging con procedura
  approvata prima di utilizzarlo. **Non eseguire alcun DDL/DML in questa PR.**
- Usare `api/scripts/civicStagingReadOnlyPreflight.sql` *solo sul
  database di staging autorizzato*. Esso legge esclusivamente cataloghi
  PostgreSQL, non dati utente; deve restituire `STRUCTURE_OK` per
  tutte le sette tabelle previste. È testato su PostgreSQL effimero,
  non è stato eseguito sullo staging reale tramite questo ramo.
- Stato attuale (lettura indipendente): in produzione sono presenti
  quattro tabelle di origine; **Demos-Staging non contiene ancora
  le quattro tabelle**, né la migrazione notifiche civiche. Entrambi
  restano NO-GO per la nuova funzione senza approvazione esplicita.

## Isolamento dei test SQL distruttivi (N-038)

- I test di migrazione della PR contengono `DROP TABLE` e `CREATE TABLE`
  **solo su PostgreSQL 16 effimero in GitHub Actions**.
- `api/tests/civic_test_database_safety.py` rifiuta qualsiasi URL che
  non punti esplicitamente a `localhost`, `127.0.0.1` o `::1`,
  porta 5432, database **civic_ci**, utente **postgres**, senza
  parametri URI (`host`, `hostaddr`, `service`, `options`).
  La suite rifiuta anche `CIVIC_TEST_DATABASE_URL` uguale a
  `DATABASE_URL`, oltre a non usare mai `DATABASE_URL` per default.
- Il controllo non autorizza ad avviare un proxy locale verso
  un database reale, e non garantisce la sicurezza di un
  PostgreSQL non controllato sulla macchina: i test vanno eseguiti
  **soltanto nel container usa-e-getta della CI**.
- Il preflight `civicStagingReadOnlyPreflight.sql` verifica che la RLS
  sia attiva per **tutte e sette** le tabelle pubbliche, comprese
  `eci` e `iniziative_ministero`. Una tabella presente ma senza RLS
  produce `RLS_DISABLED`, non `STRUCTURE_OK`.
- Il preflight reale ha già confermato che Demos-Staging è privo delle
  sette tabelle necessarie; **nessuna creazione o copia dati è stata eseguita**.
  La futura preparazione staging richiede autorizzazione distinta e
  dataset esclusivamente sintetici.

## Gate obbligatorio: connessione PostgreSQL con affinità di sessione

Il dispatcher e il riallineamento FCM usano `pg_advisory_lock` / `pg_advisory_unlock`
per impedire invii dopo la revoca o durante l'eliminazione degli account.
Il pooler **Supavisor/PgBouncer in modalità transazionale** non garantisce che
due query dello stesso client arrivino alla stessa sessione PostgreSQL.

- **NON** abilitare i push su una `DATABASE_URL` Supabase con porta
  **6543** (transaction pooling), neppure configurando manualmente il flag.
  `?pgbouncer=true` è anch'esso rifiutato dal codice.
- Utilizzare soltanto una connessione **direct** o Supavisor **session mode**
  (per Supabase porta **5432**) confermata da un operatore autorizzato.
  Non basta cambiare `6543` in `5432` nel testo della variabile:
  verificare nel pannello DB che l'endpoint sia quello corretto.
- Dopo verifica reale del collegamento, e **soltanto** con il consenso
  al rollout/staging, il backend può ricevere
  `CIVIC_SESSION_LOCK_CONNECTION_VERIFIED=true`. Il flag **non bypassa**
  il rifiuto della porta 6543. Senza flag tutti gli invii/modifiche topic
  che richiedono il lock di sessione falliscono chiusi.
- Se l'app deve conservare il pooler transazionale per le altre query,
  progettare e testare un **pool session-only dedicato** alle operazioni
  di sincronizzazione prima di qualsiasi abilitazione. La PR corrente
  non cambia il pool condiviso, i segreti o Render.
- Verificare su staging l'acquisizione/rilascio del lock sulla medesima
  connessione in modo sicuro, e la concorrenza con revoca, cancellazione
  e bootstrap. Non usare account o token reali e non inviare FCM.
- La documentazione ufficiale Supabase distingue il pooler condiviso
  sessione porta 5432 da quello transazionale porta 6543, che non supporta
  i lock legati alla sessione.

## Limiti dichiarati

Un messaggio già accettato da FCM non può essere richiamato. Il TTL di un'ora
riduce, ma non elimina, il rischio di consegne tardive. La suite di CI non
prova la consegna reale a un dispositivo.
