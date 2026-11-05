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
