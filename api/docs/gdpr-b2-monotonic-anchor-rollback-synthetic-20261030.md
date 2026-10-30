# DEMOS GDPR/B2 — anchor monotono e rollback delle prenotazioni PUT (30 ottobre 2026)

**PR #374 Draft · issue #296 · recovery NO-GO.** Prove rigorosamente sintetiche, nessuna credenziale, dato personale, bucket, PostgreSQL/Render/Supabase di produzione, deploy, merge o restore reale.

## Gap concreto nella suite precedente

Il modello `gdprB2WitnessSingleUseReservationSynthetic.test.js` aveva dimostrato che, perdendo lo storico del witness, una prenotazione `UNKNOWN` poteva essere concessa per la seconda volta, producendo un'altra versione immutabile. Un permesso monouso senza **protezione dal rollback** dell'autorità indipendente non basta. La PR era già NO-GO.

## Nuovo blocco modellato e verificato

`api/tests/fixtures/gdprB2MonotonicAnchorSynthetic.js` separa due strutture **entrambe in memoria**, per rendere verificabile il protocollo necessario:

1. Un journal di prenotazioni dei PUT sintetici, con chiave, digest, sequenza, previous hash e hash concatenato.
2. Un secondo anchor indipendente *nel modello*, con `count`, `head` e receipt HMAC sintetica. L'anchor aumenta monotonamente e non accetta un checkpoint vecchio. Il journal deve verificare l'intera catena e corrispondere esattamente a count/head del secondo anchor **prima** di emettere un permesso.

La decisione di una finta PUT è presa solamente dopo verifica di intento SQL locale `UNKNOWN`, append del journal e commit al secondo anchor. Una collisione event_key/hash, un precedente permesso o una situazione non verificabile rifiutano il tentativo. Non è implementato alcun nuovo PUT reale, né un'alternativa per riattivare l'outbox Draft: il worker resta disabilitato per B2.

`api/tests/gdprB2MonotonicAnchorSynthetic.test.js` contiene **13 casi**: permesso monouso, replay di snapshot vecchio, perdita dello storico witness, due processi con vista divergente, crash tra journal e anchor, crash dopo anchor, perdita connettività, manomissione della catena, collisione chiave, perdita intento SQL, avanzamento con eventi distinti, vecchia attestazione e perdita simultanea di **entrambi** gli stati.

### Perché resta NO-GO

Il test di perdita **di entrambi** gli stati è volutamente negativo: dopo un reset contemporaneo di journal e anchor, il modello permette un secondo PUT sintetico. Questo documenta un requisito NON risolto, non una prova positiva.

La seconda autorità non è un server né uno storage realmente indipendente: i dati e la chiave HMAC stanno tutti nella memoria dello stesso processo di test. L'ordine dei commit journal/anchor non è transazionale; l'errore nel mezzo è volutamente ambiguo e non riparato automaticamente. Non esiste un'identità del provider o una prova di version inventory/COMPLIANCE reale, durata e anti-rollback dell'anchor dopo distruzione SQL, né fencing di writer/ingress o ripristino isolato. Una migrazione o connessione reale richiederebbe revisione e autorizzazione esplicite.

**Prossimi gate esterni**: witness durevole e monotono con anti-rollback indipendente, conferma real-provider B2 versioni/retention/completezza, prova di isolamento di tutti i writer e test restore GDPR in quarantena. **Recovery NO-GO, PR Draft, issue OPEN.**
