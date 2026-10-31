# DEMOS GDPR/B2 — binding della fotografia SQL al checkpoint B2 (30 ottobre 2026)

**PR #374 Draft; GH-296 OPEN; recovery NO-GO.** Solo dati e autorità inventati in memoria, senza credenziali, dati personali, database reali, storage B2, merge, deploy o restore di produzione.

## Lacuna tra prove già esistenti

Finora le suite dimostravano separatamente (a) che più lettori PostgreSQL 17 possono condividere una fotografia consistente e (b) che un inventario B2 simulato può corrispondere a un journal sigillato con pin di versione e retention COMPLIANCE. **Le due prove potevano però essere entrambe positive su punti temporali diversi.** Mancava un controllo integrato che dichiarasse esplicitamente quali eventi fossero già compresi nella fotografia SQL e quali dovessero essere riprodotti dal journal.

## Nuovo contratto di prova, offline e sintetico

`api/tests/fixtures/gdprCrossPlaneRecoveryCutSynthetic.js` combina le funzioni già esistenti `verifySyntheticPinnedB2VersionRetention` e `restoreSyntheticSnapshot`. L'evidenza sintetica contiene:

- un manifesto con identificatore del backup fittizio, ID server PostgreSQL fittizio, timeline, LSN in formato controllato, epoch del journal, contatore e hash del punto di taglio, digest canonico dello snapshot SQL;
- l'ultimo checkpoint sigillato del witness in memoria, un inventario paginato completo **nel modello**, version ID pinned in un'altra autorità in memoria e un attestato COMPLIANCE simulato **per ogni versione**;
- tre barriere di isolamento simulate `writersFenced`, `ingressBlocked`, `providersQuarantined`.

Il verificatore **non genera** ricevute da un inventario sconosciuto: richiede l'autorità già sigillata e rifiuta incoerenze di hash, epoch, contatori, versioni o lock. Al taglio dichiarato il journal non deve contenere `prepare` pendenti, e i marker di commit dello snapshot SQL devono corrispondere **esattamente** alle operazioni già committate prima di quel taglio. Un backup con marker futuri, mancanti, fingerprint alterati o stato incoerente viene respinto prima del replay. È una restrizione conservativa per il modello, non un protocollo di commit SQL/B2 in produzione.

`api/tests/gdprCrossPlaneRecoveryCutSynthetic.test.js` ha **13 gruppi di test**: taglio prima/dopo un'operazione, mismatch SQL/journal in entrambe le direzioni, taglio su `prepare`, falso LSN/epoch/system ID/hash, account mutati, receipt B2 falsificate o versioni mancanti, witness indisponibile, isolamento falso e scenario positivo **sempre con** `productionRecoveryReady:false`. La suite è integrata nella CI B2/PG17, ma è offline e non esegue query SQL.

## Evidenze reali che mancano

Questo controllo **non prova** che il backup esista, che system ID/timeline/LSN siano autentici, che il taglio SQL sia stato attestato da una terza parte, che tutte le operazioni GDPR siano mai entrate nel journal, che tutte le versioni B2 reali siano presenti e bloccate in modalità COMPLIANCE, o che i testimoni sopravvivano alla perdita dei sistemi originali.

I digest del backup e le ricevute di pin sono inventati nella stessa fixture e possono essere creati in modo internamente coerente: la coerenza NON sostituisce provenienza e completezza. Per un GO servono fonte SQL/WAL affidabile, attestazione **indipendente** dell'ultimo checkpoint e dell'intero inventario B2, protezione anti-rollback durabile, fencing reale dei writer e restore in quarantena con verifiche GDPR/DPO.

**Stato invariato: PR Draft, GH-296 OPEN, recovery NO-GO.**
