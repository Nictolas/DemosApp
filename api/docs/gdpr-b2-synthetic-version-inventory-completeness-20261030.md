# GDPR/B2 — completezza inventario versioni sintetico (30 ottobre 2026)

**Ambito:** PR Draft #374, issue #296. Questo è un controllo **solo in memoria**, non un client Backblaze, non un attestatore esterno, non una prova di recupero. Nessun accesso a provider, credenziali, dati personali, database o backup reali.

## Blocco tecnico distinto dai preflight precedenti

Il preflight read-only già esistente controlla una **singola versione di un oggetto sintetico noto**. Non dimostra che il registro GDPR sia completo: un oggetto valido può coesistere con eventi omessi, versioni cancellate, inventari troncati o paginazione incongruente.

La nuova fixture `api/tests/fixtures/gdprB2VersionInventorySynthetic.js` verifica un inventario fittizio **esplicitamente dichiarato completo** contro un journal sigillato e il checkpoint del testimone HMAC sintetico:

- Sequenza di oggetti `events/<epoch>/<seq>.json` senza buchi, duplicazioni, inversioni o voci extra; confronto dei byte canonici, SHA-256, lunghezza, chiave e versione univoca.
- Rifiuto di delete marker, versioni non correnti, campi aggiuntivi, ID non validi, record oltre il limite.
- Pagine con cursori consecutivi, token validi e terminazione esplicita; rifiuto di troncamenti, loop, pagine vuote intermedie e liste eccessive. Limiti test: 512 voci, 64 pagine, 100 voci per pagina, 4096 byte per oggetto.
- Checkpoint esterno sintetico verificato come **corrente** e journal sigillato, con catena valida e senza intenti ambigui. Non basta un hash di file o un conteggio autocertificato.

La funzione restituisce sempre `productionRecoveryReady:false`, `completeGdprJournalVerified:false`, `externalProviderAttested:false` e `isolatedRestoreVerified:false`, anche nel percorso positivo. L'inventario di test non viene usato per autorizzare un ripristino.

## Prove sintetiche

`api/tests/gdprB2VersionInventorySynthetic.test.js` aggiunge otto gruppi: inventario completo; buchi; riordino/duplicati; manomissioni di byte e metadati; paginazione; checkpoint scaduto/offline; catena alterata/intent pending; journal vuoto. Il workflow B2/PG17 esegue la suite automaticamente.

## Gate di produzione ancora aperti

Il fatto che **un elenco simulato** sia completo non prova che un elenco B2 reale lo sia. Per attestare completezza reale servono: fonte indipendente e fresca dell'head/epoch/count; identità del bucket e del tenant; autorizzazione a leggere tutte le versioni pertinenti; paginazione completa e verificabile; controlli Object Lock e retention per versione; legame tra ACK esterni e commit SQL originali; isolamento dei writer e dell'ingresso; esercitazione di restore con dati sintetici in ambiente quarantinato. Anche una risposta `ListObjectVersions` apparentemente completa non è da sola una prova indipendente di durabilità o assenza di omissioni.

Nessuna di queste prove esterne è stata eseguita o autorizzata qui. **Issue #296 OPEN, PR #374 Draft, recovery NO-GO. Nessun merge/deploy/restore.**

**CI:** registrare lo SHA finale e le conclusioni dei workflow in PR #374 e issue #296 dopo la verifica.
