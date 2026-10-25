# DEMOS — Gate di integrazione privacy e preparazione al rilascio

**Data revisione:** 25 ottobre 2026. **Stato:** istruzioni e controlli su ramo di sviluppo in bozza; non costituisce approvazione al rilascio, certificazione GDPR o parere giuridico.

## Perimetro verificato in GitHub

Il 25 ottobre 2026 risultano **23 PR aperte e in bozza (#264–#286)**, concatenando la base di ogni PR al ramo precedente. La #264 ha base `main`; la #286 ha base #285. `main` è antenato del ramo finale `fix/public-profile-client-private-route-20261025`: **95 commit avanti, zero dietro, 93 file con 9.290 righe totali cambiate** secondo `compare_commits`. Non esiste ancora merge a `main`.

**Prove sul commit di #286 prima del nuovo workflow:** privacy sintetica e PostgreSQL 17 [PASS](https://github.com/Nictolas/DemosApp/actions/runs/40202713424), Legacy Menu [PASS](https://github.com/Nictolas/DemosApp/actions/runs/40202713438), Snyk PASS. Queste verifiche non sono prova di correttezza di tutta DEMOS. Non risultano review formali sulle PR #264 o #286 al momento del controllo.

### Raggruppamento delle PR (per dipendenze)

| Gruppo | PR | Contenuto |
|---|---|---|
| A. Core opinioni e consenso | 264–269 | Salvataggio vs revoca, cache, minimizzazione, letture opinioni |
| B. Matching e liste | 270–271 | Filtri consenso per matching e HTTP no-store |
| C. Referendum/amnistia | 272–274 | Scritture protette da revoca |
| D. Capo di Stato/Grazia | 275–279 | Letture/scritture, consenso, cache e concorrenza |
| E. Proposte/Governo | 280–284 | Scritture Governo/ministeri e letture/aggregati protetti |
| F. Profili pubblici | 285–286 | Proiezione delle preferenze, separazione profilo proprio/altrui, cache e log |

La concatenazione è **lineare**, non una serie di 23 cambi indipendenti da integrare automaticamente in qualunque ordine. Evitare merge parziali o rebase senza nuova verifica dei commit base e del contenuto.

## Gate tecnici automatici

- **CI privacy specializzata:** test del consenso, letture/scritture e vere transazioni PostgreSQL 17 con fixture sintetiche su localhost. Deve essere verde sul commit finale.
- **Legacy Menu e compilazione web:** esito verde sul commit finale.
- **Snyk:** esito verde sul commit finale.
- **Nuovo workflow `demos-privacy-integration-readiness.yml`:** verifica che `main` sia antenato della testata proposta, esamina il diff complessivo per errori di whitespace, esegue anche i pacchetti di test backend esistenti `test:identity`, `test:webauthn`, `test:privacy`, `test:logging-privacy`, `test:security-hardening`, `test:firebase-admin-compat`, non inclusi integralmente nel workflow specializzato. Non passa segreti all'ambiente CI; non esegue comandi di deploy, migrazione, pulizia o accesso alle basi dati di produzione.
- Queste suite non equivalgono a test E2E complessivi di ogni funzionalità, né al penetration test.

## Gate manuali da completare prima del rilascio

1. **Staging sicuro, con soli account sintetici:** differenziare account ordinario, candidato e politico; verificare profilo pubblico, proprio profilo, login, logout e cambio account; mai consultare risposte politiche reali per finalità di test.
2. **Revoca e concorrenza dal dispositivo:** su Android WebView reale e web, verificare salvataggio in corso, revoca, nuove richieste HTTP, navigazione indietro, ritorno online e sessione successiva. Controllare sparizione dei dati in DOM, React Query, storage locale, HTTP cache e viste storiche.
3. **Cache CDN reale:** verificare per `/api/opinioni`, `/api/governo`, `/api/users/*/public-profile`, `/api/candidati`, `/api/rappresentanti` gli header origin/edge (200/401/403/500), assenza di caching personalizzato e corretta invalidazione tra account. Verifica solo con dati sintetici.
4. **Conteggi e privacy inferenziale:** verificare soglie minime, filtri territoriali e differenze tra istanti temporali; evitare identificazione di preferenze politiche tramite piccoli aggregati. Testare anche zero/uno votante.
5. **Regressioni oltre privacy:** eseguire E2E coerenti con le funzionalità interessate, test DPO read-only e Admin, verifiche CIE/WebAuthn/push e funzionamento Play Console su distribuzione di prova, prima di reali utenti.
6. **Rollout e rollback:** predisporre release candidate identificata da SHA, inventario eventuali migrazioni DB, backup ripristinabile, metriche di errore/latency e piano reversibile backend + frontend + Android. **Non avviare** questi cambi in assenza del gate di approvazione.

## Decisioni di privacy e documentazione da riconciliare

- **Scelte di rappresentanti/candidati:** nel ramo in bozza, la proiezione pubblica ora **nasconde preventivamente** le scelte/ID del soggetto quando il consenso politico è revocato, preservando i campi solo con consenso attivo. È una mitigazione del rilascio di dati e non elimina righe di `user_representatives`. La loro base giuridica, l'eventuale opt-in alla pubblicazione, la conservazione/cancellazione su revoca e la distinzione da incarichi importati sono **ancora da definire**. Non cancellare massivamente i dati per ipotesi: assumere una decisione documentata e testare il cleanup prima del rilascio.
- **DPIA:** nel repository il documento `DPIA_DemosApp.md` ha intestazione **versione 1.1, revisione marzo 2026**, le sezioni di parere DPO e decisione finale non sono compilate, e l'Allegato H (25 ottobre 2026) è ancora esplicitamente **bozza non approvata**. L'interlocutore ha dichiarato in chat di essere il DPO e di approvare la DPIA, ma l'identità del DPO riportata nell'ultima DPIA **non coincide con questa dichiarazione**. Prima di rappresentare il documento come approvato occorre riconciliare nomina/ruoli e associare l'esito a **versione, data, parere, rischi residui e firma/evidenza**. Nessuna approvazione retroattiva è inferibile dalla sola CI.
- **Conservazioni/audit:** verificare che le durate e le basi giuridiche descritte nella DPIA rispecchino la configurazione reale di Axiom, Backblaze, audit outbox e cancellazione selettiva delle risposte.
- **Test non sufficiente:** l'assenza di errori rilevati da CI non è una prova di anonimizzazione irreversibile o conformità complessiva.

## Strategia per la catena, senza merge automatico

1. Mantenere le 23 PR in bozza e la catena non pubblicata.
2. Richiedere una revisione **consolidata del diff `main...fix/public-profile-client-private-route-20261025`**, non solo degli ultimi 9 file della #286; valutare review del titolare, sicurezza e DPO competente.
3. Completare tutti i gate tecnici e manuali sullo **stesso commit candidato al rilascio**. Se cambiano i file dopo la review, ripetere i controlli interessati.
4. Solo dopo le approvazioni, concordare la strategia di integrazione Git (top-level vs merge sequenziale della catena), evitando doppie applicazioni e verificando aggiornamento delle basi delle PR. L'intervento richiederà autorizzazione separata per merge/deploy.
5. Pubblicare con piano di monitoraggio e rollback, conservando evidenze della release candidate.

**Stato finale di questo documento:** audit preliminare e piano test; nessun merge, deploy, modifica ai dati degli utenti o accesso a produzione.

## Riscontro tecnico aggiuntivo — selezioni del profilo pubblico

La revisione integrata del 25/10/2026 ha trovato un percorso residuo di esposizione: `user.rappresentante_*`, `user.candidato_*` e `public.rappresentanti/candidati` continuavano a essere serializzati anche se il consenso politico del soggetto risultava revocato, mentre il solo `governoIdeale` era già filtrato. Sul ramo in bozza è stata estesa la verifica **finale** del consenso prima della risposta: con consenso assente/revocato i campi user della selezione sono null e gli oggetti public delle selezioni sono vuoti. Con consenso attivo viene mantenuto il comportamento precedente. Test sintetici verificano preferenze residue e revoca durante la lettura.

**Limite:** le righe in `user_representatives` e in altri store legacy non sono eliminate da questa correzione; servirà la decisione DPO/titolare sul perimetro e la DPIA. Una revoca conclusa dopo la verifica finale non ritira retroattivamente una risposta HTTP già inviata.
