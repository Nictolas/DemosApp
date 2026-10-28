# DEMOS — verifica ufficiale di 7 coppie Camera/Senato ancora da consolidare

Data ricognizione: 28 ottobre 2026  
Issue: https://github.com/Nictolas/DemosApp/issues/396

## Stato

**SOLO RICOGNIZIONE. NESSUNA FUSIONE DI QUESTE SETTE COPPIE ESEGUITA.** La proposta transazionale precedente è stata bloccata prima dell'esecuzione. Non riprovare con altre vie o assumere che la verifica dei dati istituzionali autorizzi la cancellazione degli account.

Il Senato documenta che le stesse persone hanno ricoperto incarichi Camera nelle legislature precedenti e sono senatori nella XIX legislatura. Il database DEMOS contiene due account per ciascuno, uno `C` e uno `S`, entrambi con mandato `LEGACY_BACKFILL/ACTIVE`. **Non sono mandati simultanei reali.**

| Persona | Data nascita nel DB legacy | Data nascita Senato | Stato |
|---|---|---|---|
| Alberto Losacco | 14/04/1970 | **01/07/1970** | Correzione anagrafica richiesta |
| Andrea Giorgis | 24/08/1965 | **12/04/1965** | Correzione anagrafica richiesta |
| Antonio Misiani | 04/09/1968 | 04/09/1968 | Confermata |
| Beatrice Lorenzin | 14/10/1971 | 14/10/1971 | Confermata |
| Daniela Sbrollini | 30/09/1971 | 30/09/1971 | Confermata |
| Dario Franceschini | 31/10/1958 | **19/10/1958** | Correzione anagrafica richiesta |
| Dario Parrini | 19/10/1973 | **17/10/1973** | Correzione anagrafica richiesta |

## Fonti istituzionali verificabili

- Alberto Losacco: https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00018055
- Andrea Giorgis: https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00029425
- Antonio Misiani: https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=23011
- Beatrice Lorenzin: https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00025474
- Daniela Sbrollini: https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00025402
- Dario Franceschini: https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=05799
- Dario Parrini: https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=29521

Il Senato riporta le legislature e la Camera precedente, ma **non** verificare uno start/end puntuale di *ogni* singolo mandato dal solo passaggio "Mandati". Per la data esatta, recuperare i documenti della legislatura pertinente.

## Requisiti prima della fusione

1. Verificare un identificativo istituzionale univoco per il politico e i corrispondenti profili `users`. Nome+cognome e date legacy non bastano.
2. Preservare tutte le opinioni e le rispettive fonti, anche quando distribuite fra account.
3. Conservare le richieste GDPR (`user_rights_requests.user_id` è testuale e non coperto da FK), i consensi e qualunque autenticazione.
4. Riconciliare tutti i riferimenti FK e non-FK; mantenere un solo record territoriale per ogni relazione identica senza perdere territori distinti.
5. Separare `political_mandates` storici e attuali con date ufficiali e provenienza; non trasformare un vecchio `LEGACY_BACKFILL/ACTIVE` in dato verificato senza evidenza.
6. Una volta consentito, eseguire un aggiornamento atomico con preflight, rollback e test dopo la scrittura. Non compiere eliminazioni automatiche di elettori o ruoli misti.

## Caso da escludere dai batch automatici

**Claudio Borghi**: un profilo Camera contiene credenziali di autenticazione collegate, opinioni e selezioni personali. Necessario esame identità e consenso separato; non assumere che sia un duplicato eliminabile.

## Evidenza strutturale verificata

- 58 gruppi sospetti residui: 37 composti solo da P e 21 con altri ruoli, 59 potenziali profili extra non confermati.
- 36 gruppi hanno nello stesso nome un mandato Camera e un mandato Senato entrambi `LEGACY_BACKFILL/ACTIVE`.
- 21 gruppi hanno autenticazione, 20 date di nascita mancanti, 2 date discordanti (categorie sovrapponibili).
- 1.529 mandati `LEGACY_BACKFILL/ACTIVE` in produzione, 1.528 con data di inizio del backfill 13/10/2026.

Per nuove importazioni vietare i due script legacy ritirati nella PR #397. Il backfill dei mandati in `api/database/create-account-capabilities-model.sql` va revisionato separatamente per non ricostruire falsi mandati ACTIVE.
