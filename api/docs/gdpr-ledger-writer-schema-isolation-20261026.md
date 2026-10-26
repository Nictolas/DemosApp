# DEMOS — isolamento schema per scritture ledger GDPR e backfill

**26/10/2026 · PR in bozza, stacked su #330 → #329 → #328 → #327 → #326 → #302. Nessuna operazione su produzione.**

## Rischio

Dopo la correzione del worker (#330), `PrivacyErasureLedgerService.recordEvent` utilizzava ancora `INSERT INTO privacy_erasure_ledger` e `INSERT INTO privacy_erasure_delivery_outbox` non qualificati. Un client SQL riutilizzato con `search_path` alterato, o con shadow `pg_temp`, poteva dirigere la registrazione degli eventi di revoca/cancellazione su tabelle differenti dalle `public` verificate dai recovery gate. Questo è particolarmente grave: un worker che legge soltanto `public` non recupererebbe l'evento scritto altrove.

Lo stesso problema riguardava i metodi di bootstrap/manutenzione (`ensureTable`, `ensureDeliveryOutbox`, `backfillDeliveryOutbox`) e le funzioni `captureCurrent` / `mergeCaptured` usate nelle procedure di recovery.

## Correzione

Tutti i riferimenti alle relazioni del **ledger e outbox** in questi metodi sono ora esplicitamente qualificati con `public.`, inclusi `CREATE TABLE`, `CREATE INDEX`, `REFERENCES`, `INSERT`, `SELECT` e le due scritture del CTE atomico. La modifica non richiede una transazione nuova, non imposta `search_path` persistente e mantiene la semantica dell'operazione atomica ledger + outbox. Se le relazioni `public` non esistono in modalità outbox, la richiesta fallisce: nessun DDL viene aggiunto al percorso live. Il DDL legacy e quello di bootstrap rimangono nei soli metodi preesistenti, senza attivazione automatica del nuovo sistema.

**Questa PR non affronta ancora** le funzioni dinamiche di cancellazione dei dati account e revoca politica (`deleteByColumn`, `deleteByAnyColumn`, `removeUserFromArrayColumn`, `enforceAccountDeletion`, `enforcePoliticalRevocation`, né le query in `politicalConsentService`). Esse fanno preflight sulle colonne di `public` ma poi utilizzano in parte nomi non qualificati. Occorre un intervento dedicato e test con tabelle `pg_temp` contenenti dati sintetici, prima di affermare isolamento completo del cleanup.

## Prove sintetiche

- Assert unitari sulle due `INSERT` del CTE: entrambe devono citare `public.`.
- PostgreSQL 17 disposable, senza connessione a B2 reale: sessione dedicata con `search_path=pg_temp,public` e due shadow temporanee omonime prive delle colonne reali. Si provano la scrittura atomica outbox, la scrittura legacy, `captureCurrent`, `mergeCaptured(requirePreinstalled:true)`, il bootstrap/backfill e l'idempotenza del backfill. Le righe devono apparire soltanto nelle tabelle `public`; le shadow restano vuote, il `search_path` della sessione invariato. Tutti gli eventi di test sono rimossi dalle sole tabelle disposable.

## Limiti operativi

La qualifica dello schema non garantisce che ogni writer o trigger del sistema sia protetto; non dimostra durabilità indipendente, completezza o freschezza del ledger. Un ripristino reale richiede ancora freeze verificato di Render, Supabase e Data API, checkpoint esterno indipendente e fresco, prove B2 Object Lock/VersionId su staging, DPIA e approvazioni titolare/DPO, scelte su retention e costi. Nessun test sintetico autorizza a riaprire l'app.

**Nessun merge, deploy, migrazione, intervento su produzione, dati reali, credenziali o servizi attivati.**
