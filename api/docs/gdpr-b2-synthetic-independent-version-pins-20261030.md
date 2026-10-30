# GDPR / B2 — version ID indipendenti dal contenuto (30 ottobre 2026)

**Ambito:** PR Draft #374, issue #296. Solo modello sintetico in memoria. Nessuna credenziale, SDK, rete, dati personali, provider, restore, merge o deploy.

## Difetto distinto dai controlli precedenti

Il verificatore `gdprB2VersionInventorySynthetic.js` controllava catena, byte, SHA-256, ordine e unicità delle versioni; **non aveva però una fonte indipendente dell'identità della versione B2**. Sostituire `VersionId` con un altro identificatore valido e unico, mantenendo gli stessi byte, continuava a superare l'inventario. Questo non è sufficiente per dimostrare che sia stata letta **la versione realmente confermata dal provider**.

## Nuovo modello: pin indipendente della versione

- `api/tests/fixtures/gdprB2IndependentVersionPinsSynthetic.js` simula un secondo registro di ACK, distinto dall'inventario e dal journal: per ogni evento, **prima** della verifica, memorizza `Key`, `VersionId`, `ContentLength`, `Sha256`.
- I pin sono sequenziali, con chiavi attese, ID di versione unici e metadati limitati. La sorgente viene sigillata **solo** dopo la verifica del journal e del checkpoint HMAC sintetico corrente. Non è possibile aggiungere nuovi pin dopo il sigillo.
- Il verificatore combinato confronta **tutti** i pin con l'inventario e rifiuta la sostituzione di `VersionId` anche quando byte, hash, conteggio e ordine sono corretti. Rifiuta inoltre manifest alterati, firme diverse, ACK mancanti, autorità offline o perduta e checkpoint non correnti.
- **Otto gruppi di test** in `api/tests/gdprB2IndependentVersionPinsSynthetic.test.js`. La CI B2/PG17 include la suite.

## Limiti e minacce non risolte

Questo **non è** un attestatore B2: la chiave HMAC è una stringa fissa di test, i pin sono in memoria, l'ACK è simulato, l'autorità può essere costruita a partire da dati falsi e la firma non ha provenienza indipendente reale. Un attaccante che controlla entrambe le fonti può fabbricare una coppia coerente. Un `ListObjectVersions` dichiarato completo non prova che siano state restituite tutte le versioni storiche; i controlli non verificano Object Lock/retention effettivi né eventuali delete marker nascosti. Il sigillo sintetico non prova atomicità o durabilità del commit SQL e della pubblicazione B2.

Per un GO futuro servono, con autorizzazione separata: ricevute version ID **durevoli e autentiche** provenienti dal provider e ancorate a una fonte indipendente prima della lettura; verifica bucket/tenant, permessi, versioning/Object Lock/retention, inventario storico completo e continuità del journal; riconciliazione con il SQL originale; isolamento effettivo di writer e ingress; restore in quarantena con evidenze riproducibili, più approvazioni GDPR/DPO.

L'output positivo mantiene `productionRecoveryReady:false`, `completeGdprJournalVerified:false`, `externalProviderAttested:false`, `isolatedRestoreVerified:false`. **Issue #296 OPEN / recovery NO-GO; PR #374 Draft.**

## Riproduzione

```sh
node --test --test-concurrency=1 api/tests/gdprB2IndependentVersionPinsSynthetic.test.js
```

Registrare SHA e risultati dei workflow completati in PR #374 e issue #296; non attribuire alla CI attestazioni del provider reale.
