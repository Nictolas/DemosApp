# DEMOS — Addendum di valutazione privacy: cinque assi politici

**Data bozza:** 5 novembre 2026  
**Riferimento:** PR #615 · `client/src/lib/politicalCompassModel.ts` · `client/src/pages/Profilo/components/PoliticalCompassPreview.tsx`  
**Stato:** BOZZA TECNICA IN REVISIONE. Non costituisce DPIA approvata, autorizzazione al rilascio o parere giuridico del DPO.

## 1. Trattamento aggiuntivo e scopo

La funzionalità esistente del Compasso a due assi viene affiancata da cinque indicatori tematici personali: **economia, Stato, costumi, ambiente, immigrazione**. I risultati derivano esclusivamente da un insieme versionato di Opinioni che l'interessato ha già scelto di esprimere nell'app. La scelta di visualizzare la pagina dedicata avvia l'elaborazione in memoria.

I valori elaborati sono **inferenze su orientamenti politici**, categorie particolari ai sensi dell'art. 9 GDPR. L'elaborazione locale riduce i rischi di esposizione, ma non esonera dalla trasparenza, dalla valutazione di compatibilità con le finalità già dichiarate e dalla DPIA.

| Elemento | Implementazione nella PR | Verifica/limite |
| --- | --- | --- |
| Interfaccia | Pagina privata `/compasso-politico`, dopo accesso e verifica del consenso politico | Non visualizzare dati per account terzi |
| Provenienza | Risposte già disponibili nel profilo protetto | Il caricamento delle risposte segue la logica esistente; non sono nuove query per ciascun asse |
| Elaborazione | `calculatePoliticalAxes(answers)` in memoria del dispositivo | Non scrivere inferenze nel database o in log/analytics |
| Output | Cinque barre con due poli e numero di risposte | Soglie minime UX, non significatività scientifica |
| Conservazione dei punteggi | Nessuna conservazione persistente dei nuovi score nel codice della PR | Rimane la conservazione già prevista delle Opinioni sorgente |
| Comunicazione | Nessun endpoint o pubblicazione dei cinque punteggi | Verificare assenza di cattura dei dati nei sistemi di monitoraggio |
| Destinatari | Soltanto utente autenticato che visita la propria pagina | Non riutilizzare per matching, targeting, segmentazione o amministrazione |
| Diritti | Nessun record aggiuntivo da cancellare; la revoca del consenso blocca l'accesso al compasso | Verificare cancellazione e revoca delle Opinioni sorgente e dei vault locali sui dispositivi |
| Dati religiosi | Non raccolti | Evitare qualsiasi nuova classificazione religiosa per inferenza |

## 2. Necessità e proporzionalità

La finalità è una visualizzazione facoltativa e privata delle proprie posizioni su specifiche questioni civiche. La soluzione meno invasiva disponibile usa soltanto risposte già raccolte, senza nuove categorie anagrafiche o trasferimenti dei punteggi al backend. Alternative più intrusive (salvataggio di profili, segmentazione per gruppi religiosi, condivisione dei punteggi, nuove query) non sono necessarie alla finalità e non sono autorizzate.

**Punto da decidere:** confermare che il consenso esplicito già registrato e l'informativa aggiornata descrivano con sufficiente specificità questa ulteriore finalità d'inferenza personalizzata. Una scelta tecnica non equivale a un consenso validamente acquisito.

## 3. Rischi specifici

| Rischio | Gravità potenziale | Contromisure nel ramo | Rischio residuo da validare |
| --- | --- | --- | --- |
| Esposizione di convinzioni politiche individuali | Alta | Elaborazione solo in RAM, nessuna pubblicazione/API nuove; pagina privata | Dipendenza dalla sicurezza di sessione, dispositivo e cache delle risposte |
| Inferenze erronee, eccessivamente semplificate | Media–alta | Disclaimer, barra «Dati insufficienti», sperimentale su assi fragili | Scoring non validato; risposte su un solo gruppo possono essere interpretate come identità politica |
| Uso secondario non autorizzato | Alta | Nessun invio di punteggi o nuovo tracciamento | Controlli di regressione necessari su future evoluzioni, inclusi analytics e pubblicità |
| Accumulo di dati Art. 9 per correlazione | Alta | Nessun salvataggio delle nuove inferenze | Esistono già Opinioni, voti e dati di profilo: rischio complessivo non azzerato |
| Profilazione non trasparente | Alta | Sezione 4.2 proposta in `PrivacyPolicy.tsx` e avviso nella pagina personale | Revisione e approvazione del testo prima della pubblicazione |
| Sviluppo futuro che modifica silentemente le regole | Media | Mappature e test versionati, documento metodologico | Necessario processo di revisione a ogni variazione degli assi |

## 4. Evidenza tecnica disponibile

- `api/tests/politicalCompassPrototype.smoke.test.js`: ID allineati al catalogo di 94 Opinioni, soglie per polo, risposte mancanti/indecise, estremi, calcoli invariati del compasso originale, controllo interfaccia.
- `scripts/test-profile-persistent-browser.cjs`: test mobile sintetico, pagina protetta, consenso e revoca, assenza di letture supplementari, assi sotto il grafico, scroll.
- Workflow GitHub Actions dedicato: TypeScript reale compilato, build frontend e regressione.
- Il passaggio dei test prova proprietà tecniche specifiche; **non prova da solo la conformità al GDPR, il funzionamento su un Android fisico o la validità metodologica**.

## 5. Esito e gate di approvazione

**Stato attuale: revisione aperta; NO attestazione di conformità e NO pubblicazione automatica.**

Per l'approvazione del rilascio occorre:
1. Verificare e autorizzare la nuova informativa proposta al §4.2, coerente con il trattamento effettivo e con i consensi esistenti (artt. 5–6, 9, 12–13 GDPR).
2. Integrare la DPIA principale e il registro dei trattamenti con questa specifica elaborazione locale, valutando rischio residuo e necessità di ulteriori misure (artt. 25, 32, 35).
3. Verificare in modo non distruttivo sessione, revoca e cambio account su web e dispositivo Android reale; nessuna esposizione negli strumenti di debug o logging.
4. Riesaminare gli assi **Costumi**, **Ambiente** e **Immigrazione** con competenza metodologica; il documento `docs/political-axes-methodology.md` espone le principali limitazioni.
5. Registrare data, versione, responsabile della decisione e parere DPO dove applicabile, senza sostituire la prova con un generico «approvato».

**Non trattare questa bozza come una nuova nomina del DPO, parere professionale o DPIA firmata.**
