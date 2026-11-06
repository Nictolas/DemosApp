# DEMOS 12 — Gestione delle richieste sui soggetti pubblicati (Grazia e directory)

**Stato al 5 novembre 2026: BOZZA OPERATIVA / NON VALIDATA / NO-GO.** Documento per definire e testare un processo, non una certificazione di conformità. Non abilita nuove raccolte, non modifica database, log, flag o canali email. Applicabile alle proposte di Grazia, Attivisti e Organizzazioni; valutare separatamente Capo di Stato e Amnistia.

## Canale e responsabilità

- Canale proposto e già mostrato nell'interfaccia DRAFT: `privacy@demos.community`. **Non è stata verificata in questo intervento la ricezione di messaggi, la loro consegna al responsabile, l'accesso autorizzato alla casella né un'eventuale risposta automatica.**
- La persona che presenta la richiesta non deve includere inizialmente documenti d'identità, condanne, referti, preferenze di voto o altri dati sensibili. Il `mailto:` non precompila titolo, URL, ID utente, nome né contenuto del reclamo.
- Il titolare del trattamento deve designare l'operatore responsabile del primo riscontro e della gestione dei casi, con escalation verso DPO/legale. Non è assegnato automaticamente nessun ruolo.
- Fino alla validazione operativa, mantenere disabilitati `DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED` e `DEMOS_GRAZIA_NOMINATIONS_ENABLED` nei servizi con dati reali.

## Processo da approvare e collaudare

1. **Ricezione.** Effettuare un test autorizzato con messaggio sintetico e non personale indirizzato a `privacy@demos.community`; dimostrare ricezione nella casella corretta, accesso del responsabile e risposta di prova. Verificare anche spam/inoltri e assenza di diffusione ad altri utenti. **Gate aperto fino a prova reale.**
2. **Registrazione minima.** Creare, in sistema ad accesso ristretto da approvare dal DPO, un identificativo interno di pratica, data di ricezione, tipo richiesta, stato, assegnatario, scadenze e azioni. Non mettere nomi, fonte giudiziaria, URL nominativi o documenti di identità nei titoli delle attività, log tecnici, notifiche o Google Sheet di progetto. Luogo di archiviazione, accessi e retention del registro sono **da decidere**.
3. **Identificazione proporzionata.** Distinguere l'account proponente dalla persona terza nominata: l'accesso DEMOS del primo **non prova** l'identità o la rappresentanza della seconda. Usare eventuali mezzi di autenticazione già esistenti quando appropriati; chiedere informazioni aggiuntive solo in presenza di ragionevoli dubbi, in modo proporzionato e tramite canale sicuro. Non richiedere automaticamente copia di documento via email ordinaria. Eventuali richieste di accesso a dati di terzi restano bloccate finché non sia verificata la legittimazione.
4. **Triage urgente.** Se la segnalazione prospetta danno immediato, trattamento di dati giudiziari/particolari, errore di persona o pubblicazione non autorizzata, segnalare subito a chi è autorizzato a valutare una sospensione cautelativa. L'Admin dispone già di percorsi di ritiro DRAFT: verificarne l'esito reale prima di rispondere all'interessato. La rimozione dal catalogo non garantisce cancellazione di copie esterne, motori di ricerca o cache di terzi.
5. **Decisione motivata.** Il DPO/legale definisce caso per caso rettifica, ritiro, limitazione, opposizione o risposta negativa, insieme alla base giuridica e al perimetro dei dati coinvolti. Non dichiarare una cancellazione totale se permangono audit, voti storici o backup; distinguere disattivazione pubblica, correzione di contenuti e cancellazione dati.
6. **Risposta.** Informare l'interessato senza ingiustificato ritardo e, di norma, entro **un mese dalla ricezione**. L'eventuale proroga di altri due mesi nei casi previsti va comunicata entro il primo mese, con motivazione. Se non si dà seguito, comunicare motivi e rimedi pertinenti. Non allegare automaticamente dati di altri utenti o informazioni giudiziarie.
7. **Chiusura ed evidenza.** Verificare con dati sintetici che il soggetto ritirato non ricompaia in Grazia o nelle directory e che un aggiornamento della pagina non ripubblichi contenuti obsoleti. Registrare solo esito, data e riferimenti tecnici non identificativi nel tracker DEMOS. La prova di gestione operativa deve restare presso il responsabile autorizzato con accesso ristretto e tempi di conservazione da approvare.

## Test di accettazione (non ancora eseguiti)

| Test | Criterio di superamento | Stato |
| --- | --- | --- |
| DSAR-01 Ricezione | Email sintetica consegnata a casella e responsabile corretti, con evidenza autorizzata | NON VERIFICATO |
| DSAR-02 Riscontro | Primo riscontro ottenuto sul canale autorizzato senza trasmettere dati di terzi | NON VERIFICATO |
| DSAR-03 Identità | Simulazione di richiesta da proponente, persona segnalata e soggetto non autorizzato, senza divulgazione | NON VERIFICATO |
| DSAR-04 Ritiro | Ritiro amministrativo sintetico persistente e catalogo aggiornato, senza dipendere dalla notifica | SOLO TEST DI CODICE / STAGING DA VERIFICARE |
| DSAR-05 Tempi | Registro pratica con scadenza e gestione delle proroghe verificato senza dati personali nei tracker | NON VERIFICATO |
| DSAR-06 Conservazione | DPO approva policy di audit, email, allegati, eventuale correzione e backup | DECISIONE APERTA |

## Separazione dalle protezioni già implementate

- Il nuovo contatto nella **classifica Grazia** e quelli presenti nelle directory **Attivisti/Organizzazioni** sono una protezione di accessibilità: **non** provano ricezione, autenticazione, rettifica effettiva o conformità.
- Nessuna nuova tabella, endpoint di raccolta DSAR, lettura SQL nella navigazione o registrazione automatica di dati di terzi è introdotta da questo runbook.
- Gate legali GDPR 5/6/9/10/14, informative, DPIA se dovuta, retention, test staging DEMOS 10, Android fisico, merge, deploy e attivazione restano **NO-GO**.

## Fonti normative

- Commissione europea, *Dealing with requests from individuals*: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en
- EDPB, *Guidelines 01/2022 on data subject rights – Right of access*, versione 2.0: https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf
- Regolamento (UE) 2016/679, artt. 12, 15–22: https://eur-lex.europa.eu/eli/reg/2016/679/oj

## Verifiche tecniche successive — 05/11/2026

- La pagina Grazia e gli avvisi del salvataggio voto non mostrano più `error.message` né un errore API arbitrario: gli errori di trasporto e le risposte `success:false` vengono ricondotti a testi neutri. Questo evita che un messaggio server contenente nominativi, query SQL o preferenze politiche sia riprodotto sullo schermo; non costituisce un audit completo degli altri endpoint.
- Il contatto per rettifica è riutilizzato anche nel fallback della pagina quando il `GET /api/grazia` non riesce. In modalità normale resta disponibile tanto con classifica popolata quanto vuota; nessuna query SQL aggiuntiva.
- Test sintetici: `api/tests/d12GraziaPersonalCacheIsolation.synthetic.test.js` include errori fittizi con dati privati e verifica che React Query e toast non li riflettano. `api/tests/d12GraziaPrivacyContact.contract.test.js` blocca la reintroduzione di stringhe backend e garantisce il contatto anche nell'errore. `scripts/test-grazia-privacy-browser.cjs` usa **Chrome** con API sintetiche locali, 320×568/390×844, scenari classifica vuota, popolata, errore 503; blocca richieste esterne. CI nel workflow Unified. Il superamento delle verifiche deve essere attestato sull'ultimo SHA prima di segnare i test PASS.
- **Nessun accesso alla casella di destinazione**: le credenziali Gmail collegate non costituiscono prova di controllo del recapito `privacy@demos.community`. Nessuna email di prova è stata inviata e nessuna evidenza di consegna o riscontro è stata acquisita. **DSAR-01 e DSAR-02 rimangono NON VERIFICATI.**
- Nessun merge, deploy, modifica a produzione/staging o abilitazione delle nomine viene autorizzata da questa sezione.

## 06/11/2026 — Errori amministrativi Grazia e proposte

**Perimetro tecnico della PR Draft.** In `client/src/pages/GestisciGrazia.tsx` i tre caricamenti Admin (richieste pendenti, pubblicate, avvisi di ritiro), le mutazioni di approvazione/rifiuto e il ritiro ora restituiscono **messaggi di errore fissi**: non mostrano `error.message`, `err.message`, `data.error`, dettagli SQL, nomi di persone o risposte grezze dal server. La pagina delle richieste non stampa più la proprietà `error.message` durante il caricamento fallito. Anche il vecchio handler di proposta in `useGraziaVoting.ts`, pur non usato dal form principale attuale, non riporta più eccezioni API nei toast. Successi, categorie, autorizzazione Admin, paginazione, effetto dei ritiri e loro audit rimangono invariati.

**Test di regressione sintetico.** `api/tests/d12GraziaAdminErrorRedaction.synthetic.test.js` carica i due moduli frontend reali in una VM con React Query e API simulati, senza rete/DB: verifica che errori con nomi e preferenze fittizie siano neutralizzati sui tre GET, su due POST Admin, nei toast Admin e nel percorso proposta legacy. È eseguito dai job `client-build` e `mobile-browser` del workflow Unified. L'esito va attribuito soltanto allo SHA controllato. La presenza del test **non prova** che `privacy@demos.community` riceva davvero i messaggi di rettifica.

**Gate ancora aperti.** Le verifiche DSAR-01..06, la base giuridica e la procedura per dati giudiziari e di terzi (GDPR artt. 5/6/9/10/14), le informative, la conservazione, l'eventuale DPIA, lo staging DEMOS10 autorizzato e il collaudo Android fisico restano NO-GO. Nessun merge, deploy, nuova tabella, invio email o modifica ai dati reali viene effettuato da questo intervento.
