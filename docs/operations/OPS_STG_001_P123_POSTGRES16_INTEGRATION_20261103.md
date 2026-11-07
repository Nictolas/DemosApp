# OPS-STG-001 — P1/P2/P3 PostgreSQL 16 integration test (03/11/2026)

## Risultato

La PR #565 include ora **`api/tests/test_ops_stg_001_p1_p2_p3_migrations_postgres.py`** e un terzo job del workflow **Unified Staging Offline Safety**, denominato `p1-p3-schema-postgres16`.

**Verifica CI effettuata** su commit `d5e25964b961b10a89f8ec4eb4b78d981a830eba`, run `41618102566`, job `125856532699`: **success**. Anche `bootstrap-offline-contract` e `p0-schema-postgres16` sono **success** nella stessa run. Il job Node ha passato **47/47 + 27/27 = 74/74** test. Il nuovo job Python ha terminato con **OK**.

Questi test non toccano `Demos-Staging`, produzione, Render o FCM. Vengono eseguiti in un database **civic_ci** PostgreSQL 16 temporaneo, disponibile solamente in locale sulla runner Actions tramite `127.0.0.1:5432`, utente CI isolato; una guardia del DSN rifiuta hostname, utente, database o query option diversi. Nessuna credenziale remota è usata e il servizio temporaneo viene eliminato alla fine.

## Che cosa prova il nuovo test

- Crea tre sole tabelle di prerequisiti sintetici (`users`, `eventi`, `civic_processes`), l'identità fittizia del database e la guardia degli invii push.
- Carica direttamente da Git il codice reale delle tre migrazioni SQL **P1, P2 e P3**, sostituendo **soltanto in memoria CI** l'hash di identità `Demos-Staging` con quello del database fittizio.
- **Prima** di ciascuna migrazione tenta un'applicazione non autorizzata: identità database errata per P1/P2; `civic_push_delivery_guard.blocked=false` per P3. Deve fallire e lasciare **zero oggetti parziali**.
- Poi applica le tre migrazioni nell'ordine reale e controlla **114+31+78 = 223 colonne**, **29+14+33 = 76 vincoli**, **48+23+22 = 93 indici**.
- Verifica che **20/20 nuove tabelle** siano vuote e abbiano RLS attiva, senza privilegi `SELECT/INSERT/UPDATE/DELETE` per `anon` e `authenticated`.
- Prova che ciascuna migrazione **rifiuti una seconda applicazione** senza distruggere la struttura esistente.
- In un'ulteriore transazione **interamente annullata**, crea un referendum sintetico con due utenti fittizi: registra `YES` e `NO`, verifica il vincolo su scelte consentite e la PK contro i duplicati; dopo il `ROLLBACK`, nessun voto permane.
- Verifica ancora che la guardia push resti `blocked=true`.

## Verifica read-only sullo staging condiviso

Query di audit Supabase del 03/11/2026:
- **2 utenti sintetici** nello staging; **0 schede `civic_ballots`**, **0 voti `civic_ballot_positions`**, guardia push ancora `true`.
- Il ruolo `demos_staging_runtime` **non dispone** di SELECT/INSERT/UPDATE/DELETE su `civic_ballots` o `civic_ballot_positions`. Non esiste ancora la policy RLS applicativa relativa a queste tabelle. Questo è un **gate positivo di sicurezza**, ma impedisce un E2E reale finché non vengono definite e approvate autorizzazioni limitate ai soli utenti/fixture di staging.
- Il ruolo dedicato `demos_staging_preflight` non è ancora disponibile; non riutilizzare il ruolo runtime per il preflight.
- Il servizio Render `demos-staging` rimane bootstrap (autoDeploy OFF), test applicativi non autorizzati.

## Cosa non è ancora dimostrato

Il test non prova la connettività Render → Supabase, il login reale, il consenso politico, l'assenza di notifiche esterne nelle API, le politiche effettive delle future ACL applicative, né gli E2E multicliente. Non eseguire migrazioni o GRANT automatici al runtime prima dei gate di autorizzazione.

**Gate principali ancora 4**: (1) credenziali/ruolo read-only e dipendenze; (2) ACL minime, schema residuo e fixture sintetiche; (3) collegamento e test E2E veri; (4) confronto/rollback e dismissione dei nove staging ridondanti.

Valutazione importanza dell'intervento: **7/10**. Miglioramento sostanziale nella capacità di rilevare regressioni SQL prima di utilizzare lo staging condiviso, senza pretendere che sia già pronto.
