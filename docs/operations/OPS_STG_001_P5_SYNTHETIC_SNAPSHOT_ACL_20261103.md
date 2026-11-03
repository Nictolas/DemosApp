# DEMOS — OPS-STG-001: autorizzazioni P5 per gli snapshot sintetici (3 novembre 2026)

## Intervento: preparato nel codice, NON applicato a Supabase condiviso

È stato aggiunto il file SQL `api/database/staging/ops_stg_001_p5_synthetic_snapshot_acl_20261103.sql` nella PR #565. Si tratta di un progetto di autorizzazioni **solo per prove sintetiche**, da applicare esclusivamente dopo revisione e approvazione specifiche, e non di permessi per l'app in produzione.

### Perimetro e sicurezza

Il ruolo `demos_staging_runtime` ottiene, solo *se l'operatore approva e applica la migrazione su Demos-Staging*, `SELECT`, `INSERT` e `UPDATE` limitato alle colonne `total_responses`, `yes_count`, `no_count`, `abstain_count`, `updated_at`. Non ottiene `DELETE`, modifica degli identificativi, dei bucket, di `is_frozen` o della data di creazione. Nessun accesso `anon` o `authenticated` aggiunto.

La migrazione rifiuta l'esecuzione quando mancano: `SET LOCAL civic.p5_runtime_approval='I_APPROVE_P5_SYNTHETIC_SNAPSHOT_ACL'`, identità univoca del database Demos-Staging, guardia notifiche `blocked=true`, ruolo runtime senza privilegi speciali, esattamente i due UUID di prova in `users`, policy P3 di lettura ballot già approvata, assenza di snapshot/policy/permessi precedenti, RLS attiva. Il file **non crea utenti, schede o dati**.

Le tre policy RLS (`SELECT`, `INSERT`, `UPDATE`) ammettono solo schede associate al processo sintetico `00000000-0000-4000-8000-00000000b001` e al prefisso `staging-fixture-`. Tutti i rami policy mantengono la condizione **`total_responses >= 10`**. L'UPDATE è ammesso solo per righe **non congelate**, con `USING` e `WITH CHECK`; lo schema P5 preesistente impone coerenza della somma e conteggi non negativi.

### Distinzione fondamentale fra test dei permessi ed E2E funzionale

La funzione backend `captureReferendumForecastSnapshots` mantiene **`MIN_PUBLIC_RESPONSES=10`** per non pubblicare aggregati troppo piccoli. Lo staging condiviso contiene **due utenti sintetici** e le ACL P3/P4 vincolano i voti ai loro UUID: con queste fixture il servizio reale **non può raggiungere 10 risposte distinte per scheda**. Non abbassare la soglia per far riuscire l'E2E e non confondere un INSERT SQL con 10 voti realmente registrati.

Sono stati aggiunti test Node senza rete che confermano:
- con 2 risposte il servizio non esegue alcun inserimento di snapshot;
- con 10 risposte sintetiche fornite tramite mock usa l'INSERT/UPSERT appropriato;
- uno snapshot già congelato usa `DO NOTHING`;
- tutte e quattro le condizioni di privacy delle policy (`SELECT`, `INSERT`, `UPDATE USING`, `UPDATE WITH CHECK`) mantengono la soglia a 10.

Il nuovo test con PostgreSQL16 temporaneo verifica su vere tabelle e ruoli:
- fallimento senza approvazione, DB errato e notifiche sbloccate;
- `GRANT UPDATE` solo sui cinque campi di conteggio/timestamp, senza modifiche a `is_frozen` o chiavi;
- transazioni SQL sintetiche di inserimento e UPSERT con aggregati da 10 (non generati da 10 persone);
- rifiuto di record sotto 10 e di referendum non appartenenti al processo fittizio;
- impossibilità di alterare `is_frozen` o aggiornare righe congelate;
- rollback completo senza lasciare snapshot né schede, e rifiuto della seconda applicazione dell'ACL.

**Questo test non dimostra l'E2E reale della cattura su dieci utenti.** Per quest'ultimo occorre un ambiente CI isolato che generi dieci identità completamente fittizie, oppure un diverso piano E2E con autorizzazione e protezioni esplicite, senza trasformare lo staging condiviso in un ambiente con utenti reali.

## Stato operativo

- Supabase `Demos-Staging`: 51 tabelle pubbliche, `civic_ballot_forecast_snapshots` vuota, nessuna policy/GRANT runtime P5, notifiche bloccate; ruolo dedicato read-only `demos_staging_preflight` ancora assente.
- Render `demos-staging`: bootstrap fail-closed con `autoDeploy=no`, nessun deploy applicativo.
- Render `demos-civic-staging-db`: scadenza **8 novembre 2026**; nessuna eliminazione, backup locale non ancora verificato.
- Produzione intatta; nessun nuovo ambiente permanente, credenziale, invio push o costo.

Restano **quattro gate**: 1) credenziali e backup legacy/ruolo preflight; 2) ACL sintetiche e isolamento identità/autorizzazioni; 3) connessione TLS Render–Supabase e E2E; 4) QA/rollback e dismissione legacy solo con GO.

Valutazione d'impatto proposta: **7/10**, subordinata a esito CI; avanza le autorizzazioni minime per snapshot, ma il test con 10 votanti e il collegamento applicativo rimangono aperti.

## Esito CI verificato

**Commit collaudato:** `310048f0feb24a8324479f2a7aa011176b98dc74`. La suite `Unified Staging Offline Safety`, run `41636937013`, ha concluso **3/3 job SUCCESS**: `bootstrap-offline-contract` (Node **61/61 + 29/29 = 90/90 PASS**), `p0-schema-postgres16` SUCCESS, `p1-p3-schema-postgres16` (comprende P1–P5 e ACL) **6/6 test Python/PostgreSQL16 PASS**. Il nuovo test P5 è `test_zzzz_snapshot_acl_enforces_minimum_count_and_freeze`.

Una prima versione del test statico dava rosso perché richiedeva tre controlli RLS `total_responses >=10`, mentre l'UPDATE ne contiene correttamente **due** (USING e WITH CHECK): i controlli effettivi sono quattro. È stata corretta l'aspettativa, **non** ridotta la soglia. La CI sul commit successivo è verde. Security Agent, CIE, Legacy Menu e Notifiche hanno esito SUCCESS; il build frontend era ancora in progress al momento della verifica, Snyk SUCCESS.

**Staging condiviso ancora NO-GO:** la prova riguarda codice e database CI *temporaneo*, non l'applicazione attiva. La bozza ACL P5 resta **non applicata**. I quattro gate principali non sono chiusi. **Importanza confermata: 7/10**.
