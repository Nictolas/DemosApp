# DEMOS — Gate GDPR delle proposte di soggetti (bozza DPO)

**Stato:** DRAFT / NO-GO. Aggiornamento: 31 ottobre 2026. Documento tecnico per la valutazione del DPO e di un professionista legale competente; **non** stabilisce da solo una base giuridica, un'eccezione agli articoli 9/10 o un termine di conservazione. Nessuna migrazione o pubblicazione autorizzata dalla sola esistenza di questa bozza.

## Perimetro reale (PR #502, non ancora pubblicata)

| Flusso | Origine e dati | Destinatario / esposizione | Controllo tecnico |
| --- | --- | --- | --- |
| Proposta Capo di Stato | utente autenticato: UUID interno, nome di terzo, breve testo facoltativo, fonte HTTPS | Admin legge titolo/testo/fonte; approvazione in elenco pubblico con nome e voto possibile | POST unico, `pending`, unique partial index, review Admin atomica |
| Amnistia | stesse colonne; titolo di una proposta normativa e testo facoltativo | Admin; catalogo pubblico `amnistia` dopo approvazione | nome nuovo non pubblicabile/votabile tramite endpoint legacy |
| Attivisti e Organizzazioni | titolo, dettagli facoltativi e URL di fonte; possono contenere dati su persone terze | Admin vede anche testo e URL della fonte; directory pubblica `GET /approved` espone solo ID e titolo dopo approvazione | nessun account/ruolo fittizio; approvazione esplicita, ma nessuna verifica automatica del contenuto |
| Grazia | UUID proponente, nome di terzo, fonte HTTPS; **nessun campo libero su reati/sentenze** | **solo** coda `richieste_grazia` e moderazione dedicata | `/api/grazia`; la coda generica rifiuta categoria Grazia con 409 prima di SQL |
| Esito e avvisi | ID proponente nel database, categoria, stato e testo neutro | notifica privata al proponente; avviso neutro all'Admin | non includere nomi di terzi nei banner |
| Pannello generale Admin | ID proposta, categoria, titolo, dettagli, fonte, data | solo Admin autenticato | **escluso** `proposer_user_id` dalla risposta `GET /api/subject-proposals/admin`; il server lo conserva per inviare la notifica post-review |

Il catalogo "approvati" di Attivisti/Organizzazioni restituisce **solo ID e titolo**. `details` e `source_url` rimangono accessibili alla moderazione Admin e non sono trasmessi dalle tre API pubbliche (`/api/subject-proposals/approved`, `/api/attivisti`, `/api/organizzazioni`). Anche un semplice titolo contenente il nome di una persona **può costituire un dato personale**: la revisione GDPR deve comunque stabilire se e a quali condizioni può essere reso pubblico. Una fonte online non autorizza automaticamente la ripubblicazione di dati di terzi.

## Decisioni obbligatorie del DPO prima del GO

| Gate | Evidenza/decisione da formalizzare | Esito |
| --- | --- | --- |
| **GDPR artt. 5–6** | Finalità specifiche per proposta, review, pubblicazione, notifica e antispam; base giuridica distinta per ogni finalità; liceità, minimizzazione, accuratezza, conservazione; aggiornare registro e informative | **DA DECIDERE** |
| **Art. 9** | Capo di Stato e Attivisti possono rivelare convinzioni politiche: valutare se si trattano categorie particolari, la specifica condizione applicabile e le garanzie. Non equiparare il consenso del proponente al consenso del soggetto nominato | **DA DECIDERE** |
| **Art. 10 e norme italiane** | Per Grazia identificare preventivamente il fondamento normativo autorizzante e le garanzie, non solo oscurare i dettagli del reato. Se non è dimostrato, non avviare la raccolta/pubblicazione di dati relativi a condanne e reati | **BLOCCO LEGALE** |
| **Art. 14** | Persona proposta da un altro utente: definire informativa nei casi applicabili, modalità e tempi, eventuali eccezioni motivate e documentate; definire contatto per rettifica/contestazione | **DA DECIDERE** |
| **Artt. 13, 15–22** | Informativa al proponente; accesso, rettifica, cancellazione, limitazione, opposizione, e gestione di dati già visibili al pubblico, con escalation al DPO | **DA DEFINIRE** |
| **Retention (art. 5(1)(e))** | Fissare e documentare termini distinti per pending, rejected, approved, `review_note`, notifiche, URL fonte e duplicati; definire revisione/scadenza automatica. Non assumere alcun termine per default | **DA DECIDERE** |
| **Rettifica, verifica fonte e abuso** | Criteri Admin per fondatezza, pertinenza, obsolescenza, diffamazione, informazioni giudiziarie, minori, URL con parametri identificativi; canale urgente per opposizione e rettifica | **DA DEFINIRE** |
| **DPIA (art. 35)** | Valutare documentatamente se il trattamento e la pubblicazione di nominativi e potenziali dati art. 9/10 richiedano valutazione d'impatto prima dell'attivazione | **DA VALUTARE** |
| **Sub-responsabili e trasferimenti** | Verificare trattamento effettivo su Render/Supabase, accordi e trasferimenti, accessi ai log, misure di cancellazione e backup | **DA VERIFICARE** |

Non introdurre "consenso implicito" attribuito a terze persone, non considerare sufficiente che un'informazione fosse già online e non usare dati di produzione come fixture.

## Tracciato tecnico di sicurezza (già nel codice DRAFT)

1. Due code non sovrapposte: **Grazia** su `richieste_grazia`, quattro altre categorie su `subject_proposals`.
2. Ogni nuova proposta è `pending` e l'Admin deve approvarla prima della pubblicazione.
3. Le richieste generiche impediscono duplicati in sospeso con indici `UNIQUE` parziali e validano una fonte HTTPS.
4. Il controllo `api/scripts/check-proposals-schema-readiness.js` legge soltanto metadati PG e segnala mancanze, RLS eccessivamente permissiva, vincoli e indici.
5. **Minimizzazione applicata ora:** la lista Admin generica non richiede e non riceve lo UUID del proponente; il server lo usa solo nella transazione di notifica esito.
6. Le tre API pubbliche elencano **solo ID e titolo** di Attivisti/Organizzazioni approvati; testo e fonte restano nella coda Admin, con test contrattuale sulle pagine e verifica HTTP/PG17 sul catalogo condiviso.
7. La cancellazione di un account rimuove le proposte con `ON DELETE CASCADE` e azzera `source_proposal_id` nelle voci approvate del catalogo Capo di Stato; questo **non** è un meccanismo completo per i diritti della persona nominata.
8. Test automatici su PostgreSQL 17 **effimero** (non lo staging Supabase) controllano autorizzazioni, review, SQL, privacy e regressioni.

## Condizioni di rilascio non soddisfatte

- [ ] Decisioni motivate del DPO e revisione legale per le categorie (in particolare artt. 9/10/14).
- [ ] Informative e registro trattamenti, percorso DSAR e contestazione di un nominativo pubblicato; anche l'esposizione del solo titolo/identificativo resta subordinata alla revisione DPO.
- [ ] Tabella formale della retention e cancellazione tecnica/test, senza introdurre scadenze arbitrarie.
- [ ] Staging gratuito schema-completo (oggi 7 tabelle e 2 colonne mancanti + categoria Grazia ancora nel CHECK), senza copia di profili reali.
- [ ] Test End-to-End con 2 identità sintetiche + Admin e verifica revoca/ritiro di una proposta approvata.
- [ ] QA Android, controlli di autorizzazione effettivi e differenze rispetto al `main` corrente.
- [ ] Autorizzazioni distinte per migrazione, merge e deploy. **Non** dedurre il via libera dai test verdi.

## Riferimenti normativi ufficiali

- GDPR integrale, [Regolamento (UE) 2016/679, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- EDPB, [Linee guida sulla trasparenza (WP260 rev.01)](https://www.edpb.europa.eu/system/files/2023-09/wp260rev01_en.pdf), in particolare informazioni raccolte indirettamente da altre persone.
