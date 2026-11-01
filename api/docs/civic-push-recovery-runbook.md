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

## Limiti dichiarati

Un messaggio già accettato da FCM non può essere richiamato. Il TTL di un'ora
riduce, ma non elimina, il rischio di consegne tardive. La suite di CI non
prova la consegna reale a un dispositivo.
