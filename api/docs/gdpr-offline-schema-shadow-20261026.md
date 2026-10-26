# DEMOS — isolamento dello schema per exporter GDPR offline e verifica B2

**26 ottobre 2026. PR DRAFT stacked su #328 → #327 → #326 → #302. Nessuna funzione è stata attivata in produzione.**

## Difetto e perimetro

La PR #328 limita la ricerca delle tabelle al `public` durante `reconcileRestoredPrivacyState`, ma altri due componenti offline utilizzavano SQL con nomi non qualificati:
- `PrivacyOfflineRecoveryExporter.runOnce`: `LOCK TABLE`, scansione del ledger, verifica della outbox e aggiornamento delle ricevute B2;
- `verifyOutboxRecoveryReadiness`: scansione e join ledger/outbox prima del controllo read-only delle versioni immutabili B2.

I preflight controllano esplicitamente `public.privacy_erasure_ledger` e `public.privacy_erasure_delivery_outbox`, ma un client PostgreSQL dedicato può essere restituito dal pool con `search_path` diverso; PostgreSQL privilegia persino `pg_temp` per i nomi delle relazioni quando non viene nominato esplicitamente. Così query non qualificate possono riferirsi a tabelle differenti dalle `public` verificate, rischiando di usare uno storico non approvato o di registrare le ricevute sullo schema sbagliato.

## Correzione

In entrambi i componenti, immediatamente dopo l'apertura della transazione e **prima** di qualunque query del ledger/outbox:

```sql
SET LOCAL search_path = pg_catalog, public, pg_temp;
```

`pg_catalog` garantisce priorità agli oggetti PostgreSQL standard; `public` precede `pg_temp` per le relazioni. `SET LOCAL` viene annullato automaticamente con `COMMIT`/`ROLLBACK`; **non** modifica la configurazione persistente né lo schema. L'esportatore continua a richiedere manifesto firmato, autorizzazione offline, quarantena locale e lock; il gate B2 resta `READ ONLY` e continua a fare il readback della versione esatta senza PUT.

## Test sintetici

- Suite unitaria offline: verifica che l'ordine sia `BEGIN → SET LOCAL → advisory → LOCK TABLE → ledger/outbox → B2`.
- Suite unitaria B2: i mock accettano il comando e il test di successo richiede `SET LOCAL` prima della lettura delle tabelle.
- Drill su PostgreSQL 17 disposable con B2 simulato: per ciascun componente viene preso un client dedicato, create due tabelle temporanee omonime, impostato il valore della sessione `search_path=pg_temp,public`, eseguita la verifica o l'esportazione con gli eventi fittizi e controllato che le tabelle temporanee restino vuote. A fine transazione il valore della sessione deve essere ancora `pg_temp, public`; le fixture sono eliminate nello stesso ambiente CI.

Il test non usa credenziali di provider reali, non attiva servizi né accede a database di produzione.

## Limiti / dipendenze

Lo schema corretto non dimostra che tutti i writer/worker esterni siano isolati, che una cronologia GDPR esterna sia **completa e fresca** o che nessun evento sia stato perso prima della durabilità indipendente. Prima di un recovery reale restano indispensabili: freeze verificato di Render/Supabase/Data API e dei writer sulle altre tabelle, checkpoint completo/fresco indipendente fino al freeze, prove B2 Object Lock/retention/versioni su staging separato, DPIA/decisioni del titolare/DPO, conservazione e costi. Nessuna verifica locale o `ready:true` del controllo B2 può autorizzare da sola la riapertura del traffico.

**Nessun merge, deploy, migrazione, modifica produzione, accesso a dati reali, credenziale o servizio attivato.**
