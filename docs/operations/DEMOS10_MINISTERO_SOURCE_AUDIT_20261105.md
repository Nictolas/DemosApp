# DEMOS 10 — Audit reale API Ministero, 05/11/2026

**Verifica senza accesso al database e senza invio di notifiche.**

L'API ufficiale `https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public`
ha risposto HTTP **200**, `Content-Type: application/json`.

La risposta contiene `content` con **87 record** e
`infoPaginazione: {elementCount:87, pageIndex:1, pageSize:10}`.
Questi valori sono ricavati dalla fonte pubblica: non da fixture di CI.

Lettura e validazione con il parser realmente presente in
`api/services/ministeroPaginationSafety.js` e la mappatura di
`api/services/civicProcessRegistryService.js`, in worktree temporaneo
del ramo `ops/demos-unified-staging-20261102`, eliminato dopo il test.

**Classificazione:**
- 80 leggi di iniziativa popolare;
- 7 referendum abrogativi;
- 47 in raccolta firme;
- 31 chiuse;
- 2 messe a disposizione, 3 alla Camera, 4 al Senato.

Tutti i tipi restituiti hanno corrispondenza nel catalogo di processi
civici DEMOS. Non bisogna trattare gli 87 record come 87 novità.

**Difetto identificato:** il parser usava
`totalElements`, `total`, `totale`, ma non il campo realmente
presente, `elementCount`. In caso di risposta parziale, il parser
poteva fermarsi dopo una pagina senza accorgersi del totale atteso.
La patch verifica anche `elementCount`, fallendo in caso di feed
incompleto; test specifico su risposta con 87 elementi e caso parziale.

**Test locali:** 9/9 `ministeroPaginationSafety.test.js` PASS,
controllo sintattico PASS. CI PostgreSQL 16/17 e ulteriori test
nella PR.

**NON ESEGUITO:** import Ministero nella cache di Supabase,
scheduler Ministero, invio FCM, cambio Render, modifica produzione/main
o Play. Il gate `CIVIC_MINISTERO_SCHEDULER_ENABLED` e le chiavi
di invocazione continuano disattivati; issue #589 resta aperta.

ECI invece ha già un baseline sul solo Demos-Staging:
12 ECI da fonte UE, 12 outbox `suppressed`, nessuna in
`pending/dispatching/sent`, zero device, guardia blocco push attiva.
Questo è documentato in `DEMOS10_ECI_STAGING_BASELINE_20261105.md`.
