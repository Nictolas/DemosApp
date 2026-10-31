# DEMOS GDPR / B2 — retention COMPLIANCE per ogni versione (30 ottobre 2026)

**Ambito:** PR Draft #374, issue #296. Test puramente sintetico, offline, in memoria. Nessun accesso a Backblaze B2, SQL, Render, Supabase, dati degli utenti, credenziali, merge o deploy.

## Lacuna individuata

Il preflight già presente verifica la conservazione COMPLIANCE per **una sola versione di un oggetto di prova**. Il verificatore sintetico di inventario completo e pin degli ID di versione, invece, confronta byte, hash e identità senza esigere la retention di **ciascuna** versione. L'integrità dei byte non dimostra che tutti gli oggetti siano recuperabili durante il periodo necessario.

## Nuova prova sintetica

`api/tests/fixtures/gdprB2VersionRetentionSynthetic.js` confronta un inventario già verificato tramite `verifySyntheticPinnedB2Inventory` con una risposta di retention simulata per **ogni** voce, senza saltare versioni.

- Confronto esatto e ordinato di bucket esplicitamente approvato, chiave e VersionId già ancorati alle ricevute indipendenti del modello; rifiuto di record mancanti, extra, duplicati e riordinati.
- Solo `Mode=COMPLIANCE`; `GOVERNANCE`, assenza di lock, date mancanti o scadute comportano fallimento. Ogni `RetainUntilDate` deve essere una data UTC ISO 8601 canonica **successiva** al termine del controllo più il minimo residuo configurato.
- Validazione esplicita degli istanti di inizio/fine, ordine temporale, durata massima della scansione sintetica (10 minuti), minimo residuo 1–3000 giorni e limite massimo 512 versioni. Risposte con campi aggiuntivi o forme inattese vengono respinte.
- Anche dopo un percorso di prova positivo, l'output mantiene `productionRecoveryReady:false`, `completeGdprJournalVerified:false`, `externalProviderAttested:false` e `isolatedRestoreVerified:false`.

Dieci test isolati in `api/tests/gdprB2VersionRetentionSynthetic.test.js`, inclusi input ostili, clock incoerente, versioni sostituite con ricevute contraffatte e indisponibilità delle autorità sintetiche. La suite è richiamata dal workflow GitHub B2/PG17.

## Confine della prova e gate ancora aperti

La funzione **non parla con Backblaze**: un array di metadati predisposto dal chiamante non dimostra che la risposta provenga dal provider né che tutte le versioni storiche siano elencate. Non verifica realmente i privilegi `readFileRetentions`, il tenant, il bucket, i token, il clock di un'autorità indipendente, la durata effettiva dei lock o la conservazione del journal dopo una perdita di PostgreSQL. Anche la firma HMAC e i pin del prototipo sono **solo in memoria**.

Per avanzare verso GO servono una credenziale dedicata read-only con ambito approvato, controlli provider indipendenti su bucket/versioni reali, attestazione della completezza dello storico e del checkpoint esterno, SQL/writer fence confermato, e restore isolato con risultati riproducibili. Nessuna di queste prove esterne viene sostituita dai test.

**Decisione: PR #374 Draft, issue #296 OPEN, recovery NO-GO.**
