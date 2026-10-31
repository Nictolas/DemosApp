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
8. **Ritiro cautelativo DRAFT** delle sole nomine approvate Attivisti e Organizzazioni: l'Admin apre su richiesta la scheda `Pubblicate`, inserisce una motivazione (3–500 caratteri, evitando dati personali) e conferma. Una transazione con `FOR UPDATE` imposta `status='withdrawn'` e registra separatamente `withdrawn_at`, `withdrawn_by`, `withdraw_note` preservando l'audit della prima approvazione. La directory pubblica include solo `status='approved'`; la risposta non deve essere memorizzata in cache dall'endpoint dedicato (`no-store`). La modifica non cancella automaticamente i dati storici: eventuale cancellazione/retention va autorizzata e progettata dal DPO.
9. Il ritiro delle voci **Capo di Stato e Amnistia non è ancora supportato** da questo endpoint: i loro cataloghi e i voti richiedono un percorso separato e verificato. Anche Grazia resta nella propria coda. Non invocare l'endpoint generico per questi casi.
10. **Pagine rimaste aperte:** dopo il ritiro, un dispositivo che ha lasciato Attivisti o Organizzazioni in background può aver conservato in RAM il vecchio elenco. Il client DRAFT ripulisce subito i nominativi approvati e fa **una sola GET mirata** quando torna visibile/focalizzato, senza polling, con deduplicazione degli eventi e annullamento delle richieste obsolete. La nuova risposta contiene solo `id,title`; in caso di errore non ripropone l'elenco precedente. Il caricamento iniziale delle directory resta quello già esistente e gli errori delle ricerche svuotano gli approvati locali. Organizzazioni usa ora l'API configurata, come la GET al ritorno in primo piano, invece di puntare in modo rigido a Render.
11. **Limite noto:** questa protezione **non** garantisce la rimozione immediata da una pagina continuamente visibile su altri dispositivi, né l'eliminazione di screenshot o contenuti già divulgati. Serviranno test reali Android/WebView e un processo DPO/DSAR prima dell'attivazione. Non introdurre letture periodiche SQL per simulare un push non previsto.
12. Test automatici su PostgreSQL 17 **effimero** (non lo staging Supabase) controllano autorizzazioni, review, SQL, privacy, ritiro concorrente e regressioni; un contratto frontend DRAFT verifica eventi foreground, assenza di polling e API configurata.

## Condizioni di rilascio non soddisfatte

- [ ] Decisioni motivate del DPO e revisione legale per le categorie (in particolare artt. 9/10/14).
- [ ] Informative e registro trattamenti, percorso DSAR e contestazione di un nominativo pubblicato; anche l'esposizione del solo titolo/identificativo resta subordinata alla revisione DPO.
- [ ] Tabella formale della retention e cancellazione tecnica/test, senza introdurre scadenze arbitrarie.
- [ ] Staging gratuito schema-completo (oggi 7 tabelle e 2 colonne mancanti + categoria Grazia ancora nel CHECK), senza copia di profili reali.
- [ ] Test End-to-End sullo staging con 2 identità sintetiche + Admin, ritiro cautelativo Attivisti/Organizzazioni (PG17 effimero già testato), ritorno alla pagina da background e controllo che il nome sia nascosto anche quando la GET fallisce; test sul dispositivo continuamente attivo (NON real-time per ora) e gestione rimozione/DSAR. Progettare separatamente ritiro Capo di Stato, Amnistia e Grazia con impatto su voti/cataloghi.
- [ ] QA Android, controlli di autorizzazione effettivi e differenze rispetto al `main` corrente.
- [ ] Autorizzazioni distinte per migrazione, merge e deploy. **Non** dedurre il via libera dai test verdi.

## Riferimenti normativi ufficiali

- GDPR integrale, [Regolamento (UE) 2016/679, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- EDPB, [Linee guida sulla trasparenza (WP260 rev.01)](https://www.edpb.europa.eu/system/files/2023-09/wp260rev01_en.pdf), in particolare informazioni raccolte indirettamente da altre persone.
