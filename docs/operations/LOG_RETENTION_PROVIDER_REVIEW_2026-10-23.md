# DEMOS — verifica delle conservazioni e dei log (23 ottobre 2026)

**Stato:** inventario tecnico READ-ONLY (salvo migrazione di hardening separata). **Non equivale ad approvazione delle policy RP-09, RP-10, RP-17.**

## Risultati effettivi sull'account collegato

| Sistema | Evidenza verificata | Durata effettiva | Azione prima di approvare |
|---|---|---|---|
| Render | workspace `Nicolas`; servizio `demos-backend` su piano servizio Free a Francoforte; log di job Axiom→B2 attivo il 23/10 | **non verificabile per l'account con i metadati collegati**: documentazione ufficiale Render parla di 7/14/30 giorni secondo piano *workspace* Hobby/Pro/Scale; il piano del servizio Free NON basta per determinarlo | Controllare workspace/log explorer e accessi ai log, conservare screenshot/impostazioni senza payload |
| Supabase DEMOS | progetto `wxnblcqoyjqxktwkcqok` ACTIVE_HEALTHY PostgreSQL 17, EU Central; stream log 23/10 conteggi: 1848 postgres_logs, 711 supavisor_logs, 142 postgrest_logs nella finestra 00:00–20:59 UTC | **non ricavabile** dal campione giornaliero né dal plan del DB | Verificare impostazione di progetto/organizzazione e limiti del piano |
| Axiom | dataset archiviati `centralized_logs` e `real-time`; il processo di archiviazione ha più completamenti `caughtUp=true` il 23/10 | **non verificata account-specific per dataset**; Axiom Personal pubblica massimo 30 giorni, Cloud permette personalizzazione. Modificare verso il basso comporta cancellazione irreversibile di record precedenti | Leggere da Settings > Datasets & views la retention per ciascun dataset e per organizzazione, SENZA fare Submit |
| Backblaze B2 | bucket `demos-log-archive-eu`, prefix `demos/axiom-archive/v1/` con categorie `technical`, `audit`, `security`; restore autentico READ-ONLY da staging PASS CP-EA-057 | **lifecycle non verificato**; B2 mantiene le versioni per default fino a cancellazione, se non ci sono regole custom; non dedurre il default sul bucket dell'utente | Leggere Lifecycle Settings del bucket e regole per prefisso, senza aggiungerle o modificarle |
| Outbox audit PostgreSQL | PR #218 ancora draft/non rilasciata; staging con test e dataset Axiom sintetici; 0 record outbox nello snapshot già attestato | Nessuna policy RP-17 approvata: non configurare TTL o nuova ingest | Definire esattamente eventi critici, campi strettamente necessari e incident handling prima dell'attivazione |

## Attenzione: il database conserva configurazioni storiche, NON policy legali

Query aggregate di sola lettura su `public.logging_config`:
- ambiente `production`: DEBUG off/0 giorni, TRACE off/0, INFO on/180, WARN on/365, ERROR on/730;
- la tabella `log_retention_config` è vuota; `logging_jobs` registrava `cleanup_old_logs` come enabled, senza last_run/next_run. Gli altri descrittori `compress_metadata` e `record_stats` non sono prova di cron effettivo.
- Non risulta installato `pg_cron`. Le tabelle `centralized_logs`, `audit_logs`, `performance_metrics` NON esistono in questo schema. La procedura SQL `public.cleanup_old_logs()` esisteva ancora con istruzioni DELETE per INFO/WARN/ERROR in base a `logging_config`, audit 2555 giorni, performance 30 giorni. Privilegio EXECUTE implicitamente permesso a `anon`, `authenticated` e `service_role` (SECURITY INVOKER). Non è evidenza di cancellazioni effettuate.
- La migrazione `api/migrations/20261023_disable_legacy_log_cleanup_unapproved.sql` la rende fail-closed ed esclude l'esecuzione pubblica, revoca l'EXECUTE API su due altre procedure legacy e disabilita il descrittore (non elimina la riga). Non modifica dati dei log né la policy dei provider.

## Regole di governance da sottoporre al DPO/titolare

1. Valutare e documentare quali categorie di eventi sono realmente necessarie per audit tecnico, sicurezza, incident response, funzioni esercizio diritti e accessi di amministratori di sistema. L'obbligo di conservare certi accessi degli AdS *se applicabile* non implica estensione indiscriminata a ogni log applicativo.
2. Classificare ciascun evento per finalità, base giuridica, identificatori e contenuto sensibile ammissibili, origine, fornitore, accessi, tempo effettivo, proposta di durata, copia B2, condizioni di cancellazione, eventuale blocco per incidente.
3. Approvare RP-09 / RP-10 / RP-17 soltanto dopo questa matrice e configurazioni provider verificate. Non assumere 30/180/2555/730 giorni come durata legale.
4. Non attivare la PR #218 soltanto per aumentare il numero di log conservati: stabilire se affidabilità del recapito è necessaria per eventi minimizzati già consentiti, evitare duplicazioni Axiom/Postgres/B2.
5. Dopo parere DPO e decisione titolare, introdurre configurazioni separate per dataset e prefissi B2, con prova non distruttiva prima di qualsiasi cleanup. La modifica della retention Axiom al ribasso è irreversibile.

## Riferimenti verificati

- Axiom: https://axiom.co/docs/reference/datasets e https://axiom.co/docs/reference/limits
- B2: https://www.backblaze.com/docs/en/cloud-storage-lifecycle-rules
- Render: https://render.com/docs/logging
- Supabase function grants: https://supabase.com/docs/guides/database/functions
- GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng

**Divieti:** niente token/segreti in documenti o log; nessuna lettura di preferenze politiche individuali; nessuna nuova retention o cancellazione in questa fase.
