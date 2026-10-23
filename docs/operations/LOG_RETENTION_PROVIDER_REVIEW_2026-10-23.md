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


## Aggiornamento verificato — 24 ottobre 2026: accessi AdS e limiti dei piani Free

**Scopo:** decidere se serva un archivio con durata >=6 mesi per **accessi logici degli amministratori di sistema**, non per la diagnostica ordinaria o per gli audit di voto/opinioni. Verifica senza leggere dati personali degli utenti, senza nuove raccolte e senza modifiche ai provider.

### Perimetro giuridico effettivo (fonte primaria)

Il Garante, provv. 27/11/2008 n. 1577499 (modificato 25/06/2009), punto 4.5 e FAQ:
- **FAQ 9, 11 e 19:** eventi di autenticazione e disconnessione degli AdS su sistemi e DBMS; identità, ora, sistema, esito; raccolta completa e verificabile **se** il provvedimento si applica.
- **FAQ 15 e 22:** non richiede comandi o operazioni interattive né, in quanto tale, il login al pannello applicativo DEMOS.
- **FAQ 3:** nel caso-limite in cui il titolare è realmente **l'unico amministratore di sistema**, non si applicano tenuta del log degli accessi e verifica dell'operato di quell'AdS. Questa eccezione non si deduce dalla sola presenza di un unico Admin nell'app: accertare i ruoli tecnici realmente assegnati.
- L'obbligo specifico, quando applicabile, è **almeno sei mesi**, non un obbligo di sette mesi su ogni evento di sicurezza o audit.

Fonte: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/1577499

### Risultati reali dei provider

| Fonte | Evidenza 24/10 | Cosa NON dimostra / limite |
| --- | --- | --- |
| Supabase org `vvovvqtczxrbmexpsyhv`, progetto `wxnblcqoyjqxktwkcqok` | Piano **Free** confermato da API. Flussi recenti aggregati: `postgres_logs`, `supavisor_logs`, `postgrest_logs`, `pgbouncer_logs`, altri. `auth.audit_log_entries`: **0 righe** (SQL read-only). | I flussi DB/API/connection e gli Auth Audit Log dell'app **non** costituiscono i Platform Audit Logs degli amministratori della console. Documentazione ufficiale: i Platform Audit Logs dell'organizzazione sono disponibili nei piani **Team e Enterprise**. La stessa documentazione menziona i log dell'account personale, senza garantirne qui esportabilità o copertura. |
| Render, backend `srv-d2gt3dodl3ps73fmereg` | Servizio/workspace collegato con servizio **Free**. | L'API dei log di servizio e degli eventi di deploy **non** equivale al registro login/logout console/SSH. Documentazione ufficiale: gli audit log workspace (`LoginEvent`, `LogoutEvent`, `StartShellEvent`, `EndShellEvent`) sono esportabili **dal piano workspace Pro in su**; la conservazione parte dall'upgrade, senza retroattività. Il piano workspace va verificato separatamente dal piano servizio. |
| Axiom | Dataset `centralized_logs` e `real-time`, retention 30 giorni attestata 23/10; archiviatore Axiom→B2 su audit/security. | I messaggi di audit **dell'app** non provano gli accessi privilegiati alle console dei provider. |
| Backblaze `demos-log-archive-eu` | Bucket privato e `Keep all versions` documentati il 23/10; nuovo codice esclude i tecnici prospetticamente. | Nessuna prova di un flusso autenticazioni AdS→B2 né di una scadenza automatica per audit/security. Inventario attuale delle versioni non completato; **non** impostare policy sull'intero bucket. |

Fonti dei fornitori:
- https://supabase.com/docs/guides/security/platform-audit-logs
- https://render.com/docs/audit-logs
- https://www.backblaze.com/docs/en/cloud-storage-lifecycle-rules

### Decisione operativa del titolare e requisiti di chiusura

1. **Nessun nuovo servizio, DB, log generico, piano a pagamento o copia su PC** soltanto per presunta necessità GDPR; partire dalla verifica fattuale dei soggetti che amministrano i sistemi e dei privilegi effettivi. Il titolare indica un solo Admin **applicativo**, che è cosa diversa dall'AdS.
2. **Non considerare conformi sei mesi gli archivi attuali**, né assumere un obbligo di sei mesi per tutti gli audit. **Non configurare 210 giorni sui prefissi correnti** `.../data/audit/` e `.../data/security/`.
3. Se emergono effettivi accessi AdS soggetti al provvedimento, documentare per ogni piattaforma: sorgente autentica, login/logout/tentativi falliti, identità tecnica, timestamp, sistema, completezza, integrità, disponibilità di estrazione/esportazione. Una conservazione B2 **dedicata e minimizzata** è possibile **solo dopo** che esista una fonte reale e verificata. Proposta tecnica, non attiva: prefisso separato, 210 giorni se adeguati e ciclo automatizzato testato.
4. **Non usare audit dell'app per surrogare l'accesso ai provider**. Se il piano Free non espone né esporta la fonte, registrare il limite e verificare alternative realmente disponibili prima di valutare upgrade; una copia di un dato che non arriva non crea conformità.
5. Mantenere **temporaneamente inalterato** B2 corrente fino a un inventario live, confronto con manifest/checkpoint e verifica degli eventuali vincoli; l'autorizzazione del titolare a cancellare **solo** storici non necessari è già stata concessa il 24/10. Non attribuire un'approvazione formale a terzi in assenza di un verbale.
6. **Stato produzione:** Axiom 30 giorni; B2 archivia solo audit/security nuovi; nessuna nuova policy lifecycle, cancellazione o collector AdS attivato da questa revisione. `logging_jobs.cleanup_old_logs` risulta **disabled** nella lettura di produzione del 24/10 (corregge il vecchio snapshot sopra, in cui risultava enabled).

**Esito:** la necessità dell'archivio B2 **AdS** rimane condizionata alla verifica del perimetro; l'attuale B2 è utile come archivio di audit/security ma non è provato come registro conforme degli accessi AdS. Nessuna modifica all'ambiente di produzione.
