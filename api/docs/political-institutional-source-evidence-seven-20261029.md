# DEMOS — sette schede istituzionali Camera→Senato, verifica delle fonti
Data verifica: 29 ottobre 2026. Ambito: POL-014/POL-015, issue #396, PR #400.

**SOLO EVIDENZA PUBBLICA DI CARRIERA PARLAMENTARE. Non è un'autorizzazione alla fusione o alla modifica degli account DEMOS, né un'approvazione nella tabella privata dei mandati.**

Le sette pagine del Senato riportano sulla stessa scheda le legislature alla Camera e al Senato attribuite alla persona. Questo prova la **sequenza pubblicata dall'istituzione**, non l'identità tra una scheda parlamentare e uno specifico UUID DEMOS, non le date effettive di inizio/fine di ogni mandato, né l'esistenza di un diritto a fondere account con opinioni, consensi o autenticazione.

| Persona | Senato `did` canonico | Camera risultante dalla scheda | Senato risultante dalla scheda | Fonte Senato | Stato |
|---|---:|---|---|---|---|
| Alberto Losacco | 18055 | XVI, XVII, XVIII | XIX | https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00018055 | SOLO FONTE |
| Andrea Giorgis | 29425 | XVII, XVIII | XIX | https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00029425 | SOLO FONTE |
| Antonio Misiani | 23011 | XV, XVI, XVII | XVIII, XIX | https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=23011 | SOLO FONTE |
| Beatrice Lorenzin | 25474 | XVI, XVII, XVIII | XIX | https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00025474 | SOLO FONTE |
| Daniela Sbrollini | 25402 | XVI, XVII | XVIII, XIX | https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00025402 | SOLO FONTE |
| Dario Franceschini | 5799 | XIV, XV, XVI, XVII, XVIII | XIX | https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=05799 | SOLO FONTE |
| Dario Parrini | 29521 | XVII | XVIII, XIX | https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=29521 | SOLO FONTE |

### Risultati della ricognizione

1. È confermata la **storia di incarichi nelle due Camere sulla stessa scheda istituzionale**. Non creare due identità solo perché il mandato cambia Camera.
2. Nel database storico risultavano **quattro discrepanze anagrafiche** nei casi Losacco, Giorgis, Franceschini e Parrini (vedi `api/docs/parliament-duplicate-review-20261028.md`). Qui non si eseguono rettifiche; eventuali dati di nascita richiedono verifica e motivazione specifiche.
3. L'ID `did` del Senato può comparire con zeri iniziali nell'URL. Il crosswalk deve usare un ID numerico **canonico senza zeri** (es. `00018055` → `18055`) e legare esplicitamente ID e URL. L'ID parlamentare Camera NON si ricava automaticamente da quello del Senato.
4. La sezione «Mandati» delle schede riporta legislature, non necessariamente tutte le date puntuali di assunzione e cessazione. **Non inventare `starts_on`/`ends_on` e non dedurre `ACTIVE` dal solo nome o da `users.ruolo`.** I dataset ufficiali Senato indicano date di mandato per legislatura; verificare il singolo record prima di proporre un'approvazione.
5. **Nessuno dei sette casi è idoneo al merge automatico.** Sono ancora da verificare profili DEMOS, autenticazione, consensi, opinioni, richieste privacy, collegamenti e relazioni. Le sette fusioni sono già state bloccate e restano NON ESEGUITE.

### Gate operativo prima di inserire un'approvazione privata

- Verificare una fonte Camera per il mandato Camera, una fonte Senato per il mandato Senato, e la corrispondenza istituzionale della persona, con IDs reali ed estremi del mandato.
- Correlare ciascuna fonte al profilo DEMOS canonico con una procedura distinta che non si basi su nomi o DOB soltanto.
- Validare date di entrata/fine legislatura e stato corrente in base al singolo mandato.
- Eseguire preflight di account autenticati, privacy e dipendenze; non esporre UUID, tokens o dati personali dei profili in GitHub.
- Solo dopo revisione indipendente autorizzata inserire un record nella tabella privata di approvazione. La registrazione non implica ancora fusioni o cancellazioni.

Ulteriori fonti tecniche:
- https://dati.senato.it/sito/faq?testo_generico=16 — dati mandatari, aggiornamento dei dataset
- https://dati.senato.it/DatiSenato/browse/23 — endpoint SPARQL per dataset del Senato
- https://dati.camera.it/sparql — endpoint e interrogazioni della Camera

**Le fonti e la presente ricognizione non contengono associazioni con UUID reali DEMOS. Nessuna scrittura di produzione effettuata.**
