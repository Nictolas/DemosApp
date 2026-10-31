# DEMOS GDPR/B2 — snapshot condiviso fra connessioni PostgreSQL 17 (30 ottobre 2026)

**PR #374 Draft · issue #296 · recovery NO-GO.** Test esclusivamente sintetici su PostgreSQL 17 temporaneo della CI. Nessun backup reale, B2, credenziali, Supabase/Render produzione, deploy, merge o restore.

## Lacuna distinta dal controllo precedente

Un backup può distribuire le letture SQL fra più connessioni. La transazione `REPEATABLE READ READ ONLY` protegge **una** connessione, ma non allinea automaticamente lo snapshot di una seconda. Senza un protocollo condiviso, una connessione può leggere il profilo prima di una revoca e l'altra il ledger GDPR dopo il commit.

## Prova effettiva, solo su database effimero

`api/tests/gdprRecoveryCrossConnectionSnapshotPg17Synthetic.test.js` esercita l'API PostgreSQL 17 `pg_export_snapshot()` e `SET TRANSACTION SNAPSHOT`, mai con credenziali produttive.

- Un esportatore avvia `REPEATABLE READ READ ONLY` ed esporta il token di snapshot. Due lettori autonomi importano il token **prima di ogni query**, mantenendo il medesimo `pg_current_snapshot()`. Una terza connessione committa una revoca sintetica mentre i lettori sono aperti: i due lettori mantengono gli stessi account e ledger (stato vecchio) in modo coerente.
- Controllo negativo: due connessioni `READ COMMITTED` che leggono prima e dopo il commit vedono stati diversi.
- PostgreSQL rifiuta `SET TRANSACTION SNAPSHOT` dopo che un lettore ha già fatto una query, e rifiuta l'importazione quando la transazione esportatrice è terminata.
- Il test rifiuta token arbitrari prima di costruire una query SQL. Lo snapshot esportato non può essere una stringa fornita dall'utente.
- Anche uno snapshot condiviso è **potenzialmente precedente** a revoche già avvenute dopo il cut, quindi senza journal esterno e checkpoint indipendente non costituisce prova di recupero completo.

Sono cinque gruppi di test; il workflow B2 worker/PG17 ne esegue i controlli sintattici e funzionali. Lo schema fittizio `gdpr_multireader_cut_ci` viene creato e distrutto dentro il database CI con guardia su URL esatto, marker GitHub Actions e assenza di variabili produzione.

## Limiti e prossimi gate reali

Questa è una prova del comportamento del server PostgreSQL, non un `pg_dump`/`pg_restore`, un backup verificato o un'attestazione della sua provenienza. Non dimostra WAL/LSN, sistema/timeline del backup, allineamento con il journal B2, completezza dei dati, versioni Object Lock, writer fence, witness anti-rollback realmente indipendente o restore isolato. I due lettori **non** possono autorizzare alcuna scrittura B2 o cambiare `productionRecoveryReady:false`.

**PR #374 resta Draft; GH-296 resta OPEN; recovery NO-GO.**
