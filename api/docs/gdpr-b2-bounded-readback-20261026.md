# DEMOS — Limite memoria e ordine dei controlli per il readback GDPR B2

**26/10/2026 · PR #309 DRAFT, stacked su #308 → #302. Non rilasciata.**

## Difetto

La verifica della versione B2 eseguiva `GetObject` insieme a `GetObjectRetention` e usava `transformToByteArray()` per caricare in memoria tutto il corpo, controllando gli 8192 byte soltanto *dopo* il download. Un oggetto inatteso di dimensioni elevate poteva consumare memoria durante il recovery; una retention non conforme poteva comunque avviare un download superfluo.

## Correzione

La verifica controlla prima la retention COMPLIANCE della **versione specifica**. Solo dopo chiama `GetObject`. Una lunghezza dichiarata superiore a 8192 byte viene rifiutata immediatamente; il corpo Node.js è letto come stream a chunk con limite cumulativo di 8192 byte, senza usare il buffer completo dell'SDK. Se la dimensione supera il limite, il flusso viene chiuso e il recovery fallisce. Restano il confronto SHA-256, contenuto canonico, VersionId e verifica read-only; non è consentito riparare oggetti assenti tramite PUT.

Il metodo **non** invoca più `transformToByteArray()`: un corpo nonstreaming viene rifiutato, anziché rischiare un'allocazione illimitata. Il runtime Node AWS SDK deve quindi fornire un corpo async iterable (oppure un buffer/stringa già materializzati e di dimensioni verificabili). La dimensione dei singoli chunk resta responsabilità dello stack HTTP, ma il totale accettato dal verificatore non supera 8192 byte.

## Verifiche

Test sintetici: ContentLength falso/enorme, stream più grande del limite con lunghezza assente, stream valido spezzato in chunk, rifiuto senza chiamata a `transformToByteArray()` di corpi nonstreaming, retention non conforme senza GetObject, nessun PUT durante il readback. Nessuna rete B2 reale, credenziale o dato personale reale.

## Limiti aperti — #296

La protezione memoria non certifica l'integrità o la freschezza **globale** della cronologia esterna, né prova che tutti gli eventi prima del crash siano stati esportati. Prima di autorizzare un ripristino reale servono un checkpoint indipendente verificabile, l'isolamento di Render e Supabase Data API, test autorizzati su B2 staging, decisioni su retention/costi e aggiornamento DPIA con approvazioni. **Nessun merge/deploy/migrazione/produzione.**