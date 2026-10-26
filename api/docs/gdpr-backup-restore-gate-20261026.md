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