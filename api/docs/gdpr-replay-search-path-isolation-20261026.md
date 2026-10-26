# DEMOS — Schema affidabile durante replay GDPR (26/10/2026)

**PR in bozza, stacked su #327 → #326 → #302. Soltanto codice e test sintetici, nessuna attività sulla produzione.**

## Rischio verificabile

La funzione offline `reconcileRestoredPrivacyState` verifica la presenza di `public.privacy_erasure_ledger` e `public.privacy_erasure_delivery_outbox` tramite `to_regclass`, ma diverse query successive (inclusi `LOCK TABLE`, letture e `INSERT`) usano nomi non qualificati. La risoluzione dei nomi è determinata dal `search_path` della connessione, che può essere alterato dal chiamante o includere tabelle temporanee omonime. In PostgreSQL, se `pg_temp` non è specificato esplicitamente, le relazioni temporanee possono essere cercate prima di `public`.

Un replay sullo schema sbagliato è particolarmente rischioso: un controllo sui nomi esplicitamente qualificati `public` non rende sicure, da solo, le query successive non qualificate.

## Modifica minima

Dopo `BEGIN`, prima dell'advisory lock e dei controlli del ledger, eseguire:

```sql
SET LOCAL search_path = pg_catalog, public, pg_temp;
```

`SET LOCAL` si applica **solo alla transazione**, torna al valore precedente con `COMMIT`/`ROLLBACK`, non crea o modifica tabelle e non altera la configurazione permanente. Mette lo schema `public` davanti alle relazioni temporanee per le query applicative, pur dando priorità ai builtin di PostgreSQL. È una difesa contro la risoluzione accidentale/malevola dei nomi SQL, non un controllo sugli accessi o una sostituzione dei privilegi DB.

## Drill PostgreSQL 17 disposable

Lo script CI di recovery crea, **solo nel database sintetico**, due tabelle temporanee con gli stessi nomi di ledger e outbox, poi imposta nella sessione `search_path=pg_temp,public`. Esegue il replay reale dello storico firmato. La correzione deve importare nello schema `public` e **non toccare le tabelle temporanee omonime**, che restano vuote. Le fixture vengono rimosse prima degli altri controlli. Devono continuare a passare replay di revoche, idempotenza, rollback, concorrenti e physical dump/restore.

## Limiti / decisioni

Questo intervento riguarda **il replay**. L'esportatore offline e la verifica B2 read-only usano anch'essi SQL non qualificato: vanno esaminati e protetti separatamente, con test specifici e senza assumere che il presente fix li copra. Non dimostra isolamento di Render/Supabase, completezza/freschezza del checkpoint esterno, Object Lock B2 reale, approvazioni DPIA/titolare/DPO, né condizioni di retention e costi.

**Nessun merge, deploy, migrazione, accesso a dati reali, credenziale, attivazione di servizi o modifica della produzione.**
