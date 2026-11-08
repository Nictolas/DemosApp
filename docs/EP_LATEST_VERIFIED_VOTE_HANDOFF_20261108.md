# DEMOS — Parlamento europeo: ultimo voto verificato (handoff Draft)

Data controllo: 2026-11-08. Proprietario: fonte PE, attribuzione, API reader/UI europea.
**Non è una dichiarazione GO per la prossima AAB. Nessun deploy o SQL applicato.**

## Stato reale e criticità confermate
- Supabase Demos produzione: `parlamento_europeo` **84** righe, data massima **2015-01-13**;
  `parlamento_europeo_voti_nominali` **0** righe ma chiave `(uri_votazione,mep_id)`
  progettata per storicizzare. Demos-Staging: le due tabelle assenti. Non è copertura 2026.
- Il GET legacy `/dettagli/:uri` poteva creare tabelle e salvare voti nominali;
  la funzione legacy assegnava falsamente `Assente` a ogni ID non elencato,
  usava un confronto permissivo `includes()` sugli ID e fallback non ufficiali.
- `political_mandates` produzione ha **76** record con `office_code='E'`,
  ma nessuna colonna di crosswalk ufficiale MepId; i rappresentanti selezionati
  sono identificati tramite UUID DEMOS. Nome/cognome non è una chiave valida.
- Le API di lettura europee nel ramo sono bloccate dal salvataggio storico:
  `GET /ultime` non forza più una sync, `GET /dettagli` non chiama il writer
  nominale legacy, `POST /sincronizza` e `POST /aggiorna-titoli` rispondono 409.
  **Queste modifiche restano Draft e disabilitano il comportamento storico;
  la sostituzione col writer canonico è responsabilità dell'altra chat.**

## Implementazione su questo ramo
1. `api/services/europeanParliamentVerifiedRollCallReader.js`:
   lettore XML istituzionale `PV-10-YYYY-MM-DD-RCV_EN.xml` per seduta,
   timeout 12s, dimensione massima 6 MiB, cache in memoria 6h, richieste
   simultanee deduplicate, zero query/write DB, zero AI e zero servizi a pagamento.
2. Attribuzione usando soltanto `PoliticalGroup.Member.Name MepId` (ID numerico
   esatto); se è assente dal file RCV, il voto **non è attribuibile** e non
   diventa `Assente`. Duplicati e ambiguità sono respinti.
3. La selezione dell'ultimo voto è rigorosa e non promuove una votazione a
   definitiva sulla sola base della descrizione o dei conteggi. Richiede
   riconciliazione con decisione **ufficiale VOT** per ID/date/oggetto/esito
   confermati, tramite `verifiedDecisions`; nessuna fonte VOT automatica
   completata in questo ramo.
4. `client/src/pages/Rappresentanti/index.tsx` alimenta il dialogo già
   esistente `ViewOpinioniDialog` con il solo
   `rappresentanti.europeo[0].ultimo_voto_nominale`, quando esiste.
   La UI mostra oggetto/data/voto/esito/fonte ufficiale, altrimenti «non
   verificabile». Non effettua query storiche aggiuntive e non visualizza gruppi.
   Rimosse 4 occorrenze del gruppo dal dettaglio legacy PE. Podio
   di Trasparenza nascosto in questo dialogo per la categoria europea.
5. Test unitari: identità, falsi positivi, collisioni, voti mancanti, fonte
   ufficiale, risultato finale, regressione temporale, cache/deduplica.
   Workflow CI include sonda HTTP su XML ufficiale reale e build frontend.

## Contratto di integrazione con «DEMOS — Ultimo voto per rappresentante»
**Questa chat NON possiede schema o writer** e non ha modificato tabelle,
constraint, migrazioni, job di persistenza né PR #576.

Richieste al proprietario della persistenza:
- Costruire un crosswalk istituzionale verificato `users.id UUID` ↔
  `MEP MepId numerico` per ciascun mandato europeo attivo. Nessuna
  attribuzione automatica per nome o iniziali. Ambiguità = nessun voto.
- Conservare **un solo** record corrente per rappresentante con
  `vote_order` comparabile e aggiornamento atomico monotono
  (non sostituire dati recenti con vecchi), con fonte e stato di verifica.
- Esporre nel payload autenticato già esistente
  `GET /api/rappresentanti`, sotto
  `data.rappresentanti.europeo[0].ultimo_voto_nominale`, solo:
  `{verified:true,mepId,voteId,subject,date,vote,outcome,sourceUrl}`.
  Niente gruppo/partito; `null` se non accertato. Il backend deve
  garantire coincidenza tra MepId e UUID del profilo selezionato.
- Collegare un importatore **a frequenza limitata** alla coppia RCV
  + VOT ufficiali, alimentando il writer comune. Se il documento è
  indisponibile, incompleto o non attestato come voto finale, non scrivere.
- Coordinare il ritiro delle tabelle `parlamento_europeo_voti_nominali`
  e `parlamento_europeo` solo dopo audit, approvazione, bonifica/rollback
  e prove sugli endpoint; **nessun DROP/DELETE in questo ramo**.

## Gate aperti prima di AAB
- Verifica VOT XML reale e riconciliazione deterministica RCV ↔ VOT.
- Copertura reale dell'ultima seduta 2026 e verifica delle identità
  dei 76 MEP italiani (il numero dei mandati DB non è prova di 76 crosswalk).
- Schema/writer e read-side current-only dalla chat proprietaria.
- Integrazione API autenticata e prova E2E su staging condiviso esistente.
- QA su Chrome mobile reale a 320×568 / 390×844: browser remoto non
  raggiungibile durante questa sessione; una build CI non equivale al QA Chrome.
- Verifica delle politiche di retention, approvazione rilascio, AAB
  firmato e test Android da canale Play. **Produzione/Play invariati.**
