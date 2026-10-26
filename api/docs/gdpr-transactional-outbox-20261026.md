# DEMOS — Outbox transazionale degli eventi GDPR (proposta)

**26 ottobre 2026 — codice DRAFT, disattivato per default. Nessun deployment né migrazione dei DB reali.**

## Obiettivo

Impedire il caso in cui la revoca del consenso o la cancellazione account venga salvata in PostgreSQL ma la richiesta di copiarne l'evento in B2 venga dimenticata in un crash del backend. Con `GDPR_ERASURE_OUTBOX_ENABLED=true`, `PrivacyErasureLedgerService.recordEvent` inserisce evento nel ledger e riga di outbox **con una sola istruzione PostgreSQL** e nella stessa transazione delle modifiche che chiamano `recordEvent`.

Se il database abortisce, vengono annullate revoca, evento e outbox insieme; con commit sono tutti permanenti nello stesso DB. Se la richiesta B2 fallisce dopo il commit, la riga rimane non consegnata e puo' essere ritentata. Con flag OFF, il comportamento storico rimane invariato.

## Schema proposto

`privacy_erasure_delivery_outbox`: event_key (PRIMARY KEY e FK verso privacy_erasure_ledger), queued_at, delivered_at nullable, b2_version_id nullable, b2_sha256 nullable. Non duplica identificativo utente, opinioni politiche o dettagli dell'evento.

Il codice di sviluppo utilizza `ensureDeliveryOutbox` per creare lo schema solo se abilitato; in produzione lo schema va creato con una migrazione revisionata, con ruoli/privilegi minimi. La tabella non viene creata su sistemi con flag OFF.

## Consumazione e riavvii

Il servizio `PrivacyErasureOutboxWorker` non e' montato nel backend e non ha un cron automatico. Occorrono **due flag espliciti**: `GDPR_ERASURE_OUTBOX_ENABLED=true` e `GDPR_ERASURE_OUTBOX_WORKER_ENABLED=true`, oltre al controllo B2 gia' presente nella PR #300.

Il worker apre una transazione DB, seleziona 1-20 eventi in attesa ordinati per ingresso con `FOR UPDATE OF o SKIP LOCKED`, invoca l'esportazione B2 verificata e segna consegnato con SHA256 e VersionId solo dopo readback e conferma retention. Il commit salva i marcatori. Il fallimento di una rete, di una conferma o del commit provoca rollback: l'evento resta in coda. Dopo un PUT riuscito ma senza ACK, il worker puo' riutilizzare l'oggetto B2 verificato mediante la stessa event_key. Non usa cursori basati su data che possano perdere eventi committati in ritardo.

`PrivacyErasureOutboxWorker.status(client)` restituisce solo installazione, numero degli eventi in attesa e timestamp del piu' vecchio. `ready=true` significa soltanto che **in quella lettura** l'outbox locale e' vuota: non e' una attestazione di backup, freschezza esterna, o completamento di operazioni attualmente in transazione.

## Bootstrap senza lacune

1. **Fermare tutti i writer** (Render, worker, API dirette, Supabase Data API) in manutenzione; verificare realmente il freeze. Il solo middleware non basta.
2. Revisionare la migrazione, l'installazione dell'outbox e le autorizzazioni; conservare il precedente ledger e i dati originali. Il flag non deve essere abilitato prima di schema + recovery plan.
3. Abilitare temporaneamente il flag in ambiente autorizzato e chiamare `backfillDeliveryOutbox(client,{maintenanceConfirmed:true})` per includere tutti gli eventi storici, con idempotenza. Eseguire la query di confronto `SELECT COUNT(*) FROM privacy_erasure_ledger l LEFT JOIN privacy_erasure_delivery_outbox o USING(event_key) WHERE o.event_key IS NULL`; il risultato deve essere **zero**. E' una prova locale, non esterna.
4. Configurare un bucket B2 **dedicato** con Object Lock COMPLIANCE e retention approvata da titolare/DPO. Provare l'export/GET/retention su bucket staging autorizzato; non usare l'attuale bucket log.
5. Avviare worker separato solo dopo B2 pronto e prova sulla concorrenza. Osservare `pending`, `oldestPendingAt`, errori senza user ID o contenuti politici. Se il backlog cresce, attivare allarme e non approvare recovery.
6. Per un recovery, ottenere checkpoint antico-rollback **esterno e separato** (PR #299) con cutoff certificato, verifica che nessun evento successivo sia stato perso, e quarantena completa degli ingress. Non fidarsi mai del solo stato `pending=0` nel DB ripristinato.

## Limite cruciale

**L'outbox transazionale elimina il buco applicativo fra commit e pianificazione dell'upload ma NON garantisce che l'ultima revoca sia gia' nel bucket B2 quando il database viene distrutto.** Se il DB cade completamente prima che il worker abbia esportato una riga, anche quella riga si perde insieme al DB. Per una garanzia forte occorrono una sorgente transazionale indipendente, un meccanismo sincrono/ack di durabilita' esterna compatibile con gli obblighi GDPR, oppure una procedura che tratti ogni finestra senza checkpoint attestato come perdita di integrita' con recovery bloccato e risposta incident. In ogni caso la firma B2 non basta a provarne la completezza.

Le preferenze possono contenere dati ex art. 9 GDPR. Non aggiungere dettagli al log; minimizzazione, durata B2 e accessi restano soggetti a DPIA e decisione titolare/DPO. La PR #296 (issue) resta aperta fino a completa prova end-to-end e isolamenti Render/Supabase.

## Verifiche previste

- GitHub Actions con PostgreSQL 17 locale e credenziali sintetiche: rollback, inserimento atomico in autocommit, backfill storico idempotente, errore rete prima/dopo PUT, errore SQL dopo PUT, riutilizzo stessa versione, due worker concorrenti SKIP LOCKED.
- Suite regression: privacy, ledger, recupero e contratto B2 immutabile sui rami stacked.

**Nessun merge, deploy o write B2 reale.**


## Gate locale di quarantena sul worker (PR successiva a #324)

Il worker outbox avviato nel percorso normale non deve proseguire durante una procedura di recovery GDPR. Il codice applica il flag `DEMOS_PRIVACY_RECOVERY_MAINTENANCE` con la stessa semantica fail-closed del middleware HTTP:

- Solo flag **assente** oppure valore esatto `false` permette l'esportazione ordinaria.
- Qualunque altro valore impostato, anche `true`, `TRUE`, stringa vuota o con spazi, blocca il worker **prima** di configurare B2 e prima di aprire il pool PostgreSQL.
- Il controllo viene ripetuto subito dopo `BEGIN`, prima di ogni export, al ritorno da ciascuna chiamata B2 e prima del `COMMIT`. Se il flag cambia durante una chiamata B2, il worker esegue `ROLLBACK` e lascia la ricevuta non confermata nel DB. Se l'oggetto B2 era già stato caricato, un'esecuzione futura **autorizzata**, con quarantena terminata, può verificarlo e riutilizzare la stessa versione.
- I test sintetici e il drill PostgreSQL 17 verificano l'assenza di nuove connessioni durante maintenance, il rollback in corso di batch e il retry senza duplicare l'oggetto fittizio.

**Limiti della protezione locale:** un flag ambientale non si propaga automaticamente a vecchi processi o istanze separate e non chiude Supabase Data API, connessioni dirette o altri writer. Il controllo non è sincronizzato atomicamente con l'ultima transazione; una variazione del flag dopo l'ultimo controllo non sostituisce un freeze infrastrutturale dimostrato. Prima di un recovery vero, interrompere e verificare tutte le istanze e revocare/limitare gli ingressi previsti nella procedura approvata.

**Recovery offline separato:** durante un restore potrebbe servire esportare eventi reimportati *senza* riaprire API pubbliche. Questa PR non aggiunge un bypass per il worker ordinario. Servono un runner offline specifico, isolato e verificabile, responsabilità operative, approvazione documentata del titolare e valutazione DPO: non disattivare il flag di recovery al solo scopo di far ripartire il worker normale. Nessun deploy/merge/migrazione/configurazione/contatto con B2 reali.
