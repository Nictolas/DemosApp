# DEMOS — Procedura di ripristino GDPR (26 ottobre 2026)

**Stato:** PR #297 DRAFT, dipendente da #295 e da tutta la catena privacy #264–#293. Nessun deploy o recupero di dati reali autorizzato.

## Rischio e protezioni

Un backup anteriore a una revoca o cancellazione account può ripristinare dati già eliminati. Il nuovo consenso non deve fare ricomparire le selezioni politiche pre-revoca.

- HTTP: il flag DEMOS_PRIVACY_RECOVERY_MAINTENANCE=true blocca con 503, no-store e Retry-After le richieste Express (OPTIONS, health, GET, POST ecc.) prima delle route; disabilita anche i job periodici avviati da api/app.js.
- Non isola altre istanze Render, worker separati, CDN, Supabase Data API, client SQL diretti o provider. **Il blocco HTTP non equivale alla quarantena del database.**
- Riconciliazione offline: privacyRecoveryGateService richiede un manifest esterno firmato HMAC-SHA256, ID della sessione, timestamp autenticato del backup ripristinato ed eventi di cancellazione. La chiave resta fuori da backup/repo/log.
- Una sola transazione PostgreSQL applica il ledger e annulla tutte le modifiche in caso di errore. Se il backup precede una revoca, cancella i dati personali precedenti anche quando il consenso viene successivamente concesso di nuovo.

## Procedura operativa da realizzare e approvare

1. Mettere in quarantena il database di destinazione, sospendendo ingress, worker, API dati Supabase e connessioni esterne. Non aprire il traffico in alcuna fase intermedia.
2. Acquisire un ledger esterno al backup, cifrato, integro e completo fino al blocco degli accessi. Verificare indipendentemente il suo punto di cattura. La firma HMAC non dimostra, da sola, completezza o freschezza.
3. Verificare la data del dump/PITR dai metadati del provider e autorizzare un recovery ID. Non inventare il cutoff.
4. Ripristinare in ambiente isolato senza avviare le API; invocare offline reconcileRestoredPrivacyState con maintenanceConfirmed=true, manifest firmato e chiave approvata.
5. Controllare che dati degli account cancellati e preferenze politiche revocate non siano presenti, incluse proiezioni legacy. Provare anche un manifest corrotto: deve restare impossibile accedere al database.
6. Solo dopo attestation di integrità, verifiche GDPR/DPIA e approvazione del titolare/DPO, rimuovere la quarantena e riabilitare i servizi nell'ordine previsto.

## Verifiche automatizzate

- Workflow: .github/workflows/privacy-recovery-gate-ci.yml (PostgreSQL 17 con dati esclusivamente sintetici).
- Test HTTP: api/tests/privacyRecoveryGate.test.js, inclusi 503 no-store e richieste OPTIONS.
- Test SQL: api/scripts/verify-privacy-recovery-gate-ci.js, inclusi firma manomessa, backup pre-revoca, successivo nuovo consenso, idempotenza, rifiuto conflitti e rollback.

## Condizioni ancora aperte

- Integrazione con un vero ledger esterno e una prova indipendente della sua freschezza/completa sequenza.
- Blocco operativo di tutti gli ingress e dei job di altri servizi, non solo Express.
- Drill con dump/PITR sintetico, verifica readiness, backup cutoff e test di recupero fallito.
- Revisione DPIA, retention backup, responsabilità e consenso del DPO/titolare.
- Test Android/CDN e approvazione della catena di PR prima del deploy.

**L'issue #296 resta aperta; questa PR non implementa né autorizza un restore operativo in produzione.**
## Correzione parità flag HTTP/job (26 ottobre 2026, DRAFT)

L'audit ha individuato una divergenza: `privacyRecoveryMaintenance` bloccava HTTP per qualsiasi valore impostato diverso da `false`, mentre l'avvio dei job in `api/app.js` veniva fermato solo da `true` esatto. Un errore `TRUE` o `true ` lasciava quindi attivi audit, sync, ottimizzazioni e altri job mentre HTTP rispondeva 503. Il predicato `isPrivacyRecoveryMaintenanceActive` è ora condiviso da middleware, avvio job dell'app e worker outbox. Test sintetici verificano valori assenti, `false`, `true`, valori malformati e parità con l'app. **Non dimostra né sostituisce la quarantena di worker esterni, Supabase Data API, client SQL diretti, istanze già avviate o traffico su altri provider.** In particolare modificare la variabile d'ambiente richiede il riavvio di tutte le istanze perché i job già avviati non vengono fermati dal solo controllo iniziale.

## Difesa aggiuntiva: nuovi cicli dei job già schedulati (26 ottobre 2026 — DRAFT)

Oltre al gate all'avvio (#348), sono stati introdotti controlli *prima di ogni nuova esecuzione* dei job locali: pulizia retention, violazioni, Ministero (compresi retry), processi civici, territori, unità elettorali, voti parlamentari, Openpolis e archivio Axiom. Analogamente i servizi locali di audit, monitoraggio e ottimizzazione ricontrollano il flag prima di nuovi cicli. In modalità normale gli intervalli/cron restano invariati.

**Questa protezione ha limiti importanti:** il processo Node non riceve automaticamente le modifiche alle variabili di ambiente del pannello Render. Operazioni già in corso possono completare I/O dopo la decisione di quarantena; quindi non è una garanzia di interruzione transazionale o di isolamento. Per il recovery reale restano indispensabili stop/restart dei processi, blocco ingress e accessi esterni, verifica effettiva della Data API Supabase, ledger esterno completo e autorizzazioni GDPR. Nessuna modifica ai servizi o al database di produzione.

## Inventario provider e criterio NO-GO (rilevazione in sola lettura, 26 ottobre 2026)

Per stato verificato dei servizi Render, metadati Supabase e blocchi esterni non attestati, consultare `gdpr-provider-quarantine-audit-20261026.md`. Questi metadati NON attestano un ambiente già isolato. Attualmente il criterio di apertura **GO/NO-GO è NO-GO**: Data API e connessioni SQL esterne non sono state verificate come interrotte, così come i collegamenti dei servizi di staging alle credenziali di produzione. Nessun restore o quarantena reale eseguiti.

## Preflight indipendente e fallback NO-GO (26 ottobre 2026)

Per raccogliere attestazioni di quarantena verificabili per singola superficie senza includere segreti nel risultato, usare il componente *offline* `api/services/privacyRecoveryQuarantineEvidenceGate.js` insieme all'inventario `gdpr-provider-quarantine-audit-20261026.md`. Non è un agente che possa interrogare Render/Supabase: richiede riferimenti prodotti e verificati dall'operatore. Qualunque lacuna `NO_GO`; pacchetto formalmente completo `MANUAL_INDEPENDENT_REVIEW_REQUIRED`. **Non avvia né sblocca alcun recovery e non sostituisce approvazione del titolare/DPO.**
