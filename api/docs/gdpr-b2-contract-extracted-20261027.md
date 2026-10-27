# DEMOS — primo modulo B2 isolato sulla catena GDPR sicura (27 ottobre 2026)

**Stato: Draft / NO-GO.** Ramo basato esclusivamente su PR #371 (che a sua volta dipende da #366), non sul ramo di recovery da 238 file. Nessun deploy, merge, credenziale, configurazione provider o operazione su dati reali.

## Perimetro importato

- `api/services/privacyLedgerTimestamp.js`: verifica UTC rigorosa e timestamp PostgreSQL a precisione microsecondo.
- `api/services/privacyErasureB2Journal.js`: **contratto operatore, non avviato automaticamente** per archiviazione/versioned-readback di *singoli eventi* GDPR su un bucket B2 separato; richiede abilitazione esplicita `GDPR_LEDGER_B2_ENABLED=true`, credenziali, Object Lock in **COMPLIANCE**, retention configurata, endpoint TLS ufficiale e conferma del contenuto/retention mediante lettura della versione.
- `api/tests/privacyErasureB2Journal.test.js`: test unitari con client S3 fittizio, **nessuna richiesta esterna**. Rispetto ai test della catena precedente, questa prima tranche non importa ancora il worker SQL/outbox e non lo dichiara testato. Aggiunti casi che **rifiutano dettagli JSONB `null`/assenti**, `false` e array prima di qualunque I/O B2, in accordo con i controlli `mergeCaptured` della #371.
- `.github/workflows/gdpr-b2-erasure-journal-ci.yml`: suite sintetica isolata su pull request; usa dipendenze già registrate nel package-lock (`@aws-sdk/client-s3`).

## Limiti espliciti e sequenza successiva

Questo innesto **non modifica `api/services/privacyErasureLedgerService.js`** e non abilita ancora outbox, worker, backup, restore o recovery. L'archiviazione B2 di un evento fatta *dopo* un commit DB senza outbox non costituisce un checkpoint completo contro la perdita totale del database: il contratto B2 offline è soltanto un componente.

Prima di aggiungere l'outbox occorre integrare, sulla stessa base #371, i seguenti invarianti senza sovrascrivere le correzioni recenti:

1. `recordEvent`: modalità `GDPR_ERASURE_OUTBOX_ENABLED` tipizzata e disattivata per impostazione predefinita; se abilitata, **un'unica istruzione SQL** deve inserire evento e coda, con rollback atomico, mai DDL in transazioni utente. Ledger e outbox devono essere installati con bootstrap operatore in ambiente isolato.
2. `mergeCaptured`: conservare il **rifiuto di `details=null`/assenti/non-oggetto** già ottenuto nella #371; non importare dal vecchio stack la logica `row.details == null ? {} : row.details`. Conflitti di `event_key` con contenuti differenti devono arrestare il replay.
3. Worker ed esportatore: attivazione solo su autorizzazione operativa, con nessun segreto nelle evidenze GitHub, journal B2 dedicato cifrato e retention formalmente approvata dal DPO, prova indipendente di completezza/freschezza e isolamento runtime.
4. Test con PostgreSQL 17 sintetico della scrittura ledger/outbox e della cancellazione politica concorrente, test di retry B2 con mock e fallimenti di restore. **Non eseguire** test su database di produzione o staging già popolato senza perimetro e rollback espliciti.

## Cosa questa PR NON dimostra

- Che il bucket B2 del ledger GDPR esista, sia configurato o contenga eventi.
- Che tutti gli eventi siano stati archiviati o che i checkpoint indipendenti siano recenti.
- Che Render utilizzi il ruolo DB dedicato testato separatamente su Supabase Demos-Staging.
- Che il piano recovery #296 possa passare a GO.

**Decisione invariata:** issue #296 **NO-GO**. Portare in review questa tranche di contratto soltanto dopo CI verde; ulteriori moduli devono restare isolati finché non sia possibile verificarli con regressioni sintetiche complete.
