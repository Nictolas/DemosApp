# DEMOS GDPR — blocco cross-worker per PUT B2 incerto: prototipo PostgreSQL 17

**30 ottobre 2026 · PR Draft #374 · issue #296 · recovery NO-GO**

## Rischio verificato nel codice Draft

L'esportatore B2 aveva un latch `uncertainWrite` **in memoria**, dopo il primo PUT e fino al readback verificato. Un riavvio, una seconda istanza o un worker diverso non condividono questo latch. Il worker `PrivacyErasureOutboxWorker.runOnce` tiene un lock SQL durante la chiamata B2 ma, in caso di errore/crash, esegue rollback e lascia l'outbox pending: il retry successivo può inviare un **nuovo PUT immutabile** anche quando il primo era già riuscito ma l'ACK è stato perso. `HeadObject` non è prova indipendente di assenza di versioni precedenti.

## Intervento di sicurezza sul servizio Draft

Il worker **reale** ora fallisce esplicitamente con `GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED` prima di ottenere una connessione SQL o effettuare chiamate B2. Questa barriera vale anche se viene iniettata una istanza reale di `PrivacyErasureB2Journal`. I worker con esportatore fittizio restano utilizzabili **solo nei test isolati**. La barriera rende la pipeline Draft volutamente **non operativa per consegne B2 reali**, finché il protocollo durabile non sia implementato, integrato, revisionato e autorizzato.

Non usare l'abilitazione delle variabili di ambiente per aggirare il blocco. Non è una soluzione definitiva: un eventuale caller diretto di `archiveEvent` non passa dal worker e richiede un gate equivalente. Nessun servizio di produzione è stato modificato.

## Prototipo di protocollo, solo test PostgreSQL 17

`api/tests/gdprB2DurablePutClaimPg17Synthetic.test.js` crea uno schema dedicato **esclusivamente nel database effimero CI**, protetto da un guard che rifiuta qualsiasi URL o ambiente non locale. Prima di simulare PUT registra e **committa** una riga `UNKNOWN` per `event_key` e hash del payload; un vincolo univoco impedisce a un secondo worker di acquisire lo stesso evento. Dopo il commit, un crash anche *prima* di PUT lascia lo stato `UNKNOWN`: è conservativo e non autorizza un nuovo PUT. Una seconda istanza SQL osserva il marker dopo riavvio simulato.

Il modello prova la riconciliazione **senza nuovi PUT**, tramite due sorgenti finte distinte: inventario versioni e pin indipendente. Sono richiesti esattamente una versione, hash coerente, lock COMPLIANCE e retention futura. Se il provider restituisce zero o due versioni, o il pin manca/non coincide, lo stato resta `UNKNOWN`. Un esito sintetico `VERIFIED` ha `productionRecoveryReady:false` e **non è un'attestazione**.

La suite include crash pre-PUT, race tra due connessioni PG17, perdita dell'ACK dopo un PUT fittizio, prova mancante/discordante, duplicazione di versioni, e perdita del marker in uno snapshot SQL ripristinato. L'ultima prova dimostra un limite importante: **il solo database non può attestare la propria completezza**. Servono un witness esterno realmente durabile e un inventario B2 versionato, verificati in modo indipendente.

## Hardening idempotenza del claim — 30 ottobre 2026

Nel prototipo PG17, il conflitto su `event_key` non viene più trattato indistintamente come retry: dopo `ON CONFLICT DO NOTHING` viene letta la riga persistita e confrontato lo SHA-256. Solo lo **stesso hash** produce un esito idempotente (`false`); hash differente, riga invisibile o assente producono `CLAIM_EVENT_KEY_HASH_CONFLICT` e non autorizzano alcun PUT. La verifica è effettuata anche dopo l'attesa di una transazione concorrente e dopo la transizione a `VERIFIED`. La modifica è **solo nel test/prototipo**, non una migrazione né un protocollo runtime attivo. Il test SQL utilizza un ruolo privilegiato in CI e non attesta la visibilità con ACL/RLS di un worker reale.

Il claim SQL resta **non indipendente** da uno snapshot precedente: la sua perdita può rendere apparentemente nuovo un evento già caricato. Nessuna condizione di questa suite consente recovery GO senza witness durabile, completezza indipendente e restore isolato.

## Mancano ancora prima di qualunque uso reale

1. Definire schema/migrazione e ACL RLS del marker su un ambiente autorizzato e separato; integrare il claim **committato prima del PUT** nel worker senza finestre di retry automatico.
2. Progettare l'autorità di riconciliazione e l'eventuale esito `UNKNOWN` anche quando il DB originario è distrutto: il marker locale non basta.
3. Verificare con autorizzazione esplicita il comportamento provider B2 (version inventory, Object Lock, retention, consistenza), l'identità del ruolo SQL e il fencing cross-worker.
4. Prova di completezza esterna del journal, isolamento di ingress/writer e restore GDPR in quarantena; revisione DPO/DPIA e autorizzazioni.

**Questo intervento NON chiude il blocco distribuito:** impedisce l'uso rischioso del worker reale nel Draft e dimostra soltanto proprietà di un modello PostgreSQL 17 sintetico. Nessuna credenziale, dato personale, bucket reale, produzione, merge, deploy o restore. **PR Draft; GH-296 OPEN; recovery NO-GO.**
