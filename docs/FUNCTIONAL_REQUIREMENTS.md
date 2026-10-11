# DEMOS — Requisiti funzionali canonici

**Versione:** 2026-10-11  
**Dipendenza:** `docs/PRODUCT_FEATURE_CATALOG.md`  
**Perimetro:** comportamento funzionale dell'applicazione già implementato o esplicitamente previsto dal catalogo corrente. I requisiti di sistema, infrastruttura, disponibilità, prestazioni e sicurezza trasversale appartengono a F12-03 e non sono duplicati qui.

## Convenzioni

- `UF-xxx` identifica la funzione nel catalogo prodotto.
- `RF-xxx` identifica un requisito funzionale verificabile.
- **DEVE** indica comportamento richiesto.
- **NON DEVE** indica comportamento vietato/fail-closed.
- Gli account politici sono determinati dalle capability canoniche (`isPolitician`, `isCandidate`) e non soltanto dal vecchio campo `ruolo`.
- Le funzioni indicate come limitate devono applicare il controllo lato backend quando esiste un'azione privilegiata; la sola visibilità della UI non costituisce autorizzazione.

## A. Accesso, onboarding e identità

| Requisito | Funzione | Attore | Specifica funzionale verificabile |
|---|---|---|---|
| RF-001 | UF-001 | Visitatore | DEMOS DEVE rendere raggiungibile una landing page pubblica dalla route `/` e consentire l'accesso al percorso di autenticazione senza richiedere una sessione esistente. |
| RF-002 | UF-002 | Utente | DEMOS DEVE consentire l'avvio dell'autenticazione dalla superficie `/auth` e, dopo autenticazione valida, rendere disponibili le route protette dell'account. |
| RF-003 | UF-003 | Nuovo utente / utente esistente | Il bootstrap con Google DEVE poter identificare la credenziale esterna, ma per un nuovo account personale NON DEVE creare l'account definitivo prima del completamento della verifica CIE. |
| RF-004 | UF-004 | Nuovo utente / utente esistente | Il bootstrap con Apple DEVE seguire lo stesso modello del bootstrap OAuth: autenticare/identificare la credenziale esterna e, per i nuovi account personali, subordinare la creazione dell'account alla CIE. |
| RF-005 | UF-005 | Utente con dispositivo compatibile | DEMOS DEVE consentire la creazione e l'uso di credenziali Passkey/WebAuthn; la registrazione pubblica di una passkey per un nuovo account personale NON DEVE produrre un JWT definitivo prima della CIE. |
| RF-006 | UF-006 | Nuovo account personale | DEMOS DEVE richiedere una verifica CIE valida prima di creare o attivare un nuovo account personale; account, identità verificata, profilo e consensi obbligatori DEVONO essere finalizzati in modo atomico e un'identità CIE già associata a un altro account DEVE causare rollback completo. |
| RF-007 | UF-007 | Nuovo utente | Il flusso di registrazione DEVE acquisire i dati anagrafici previsti dalle schermate correnti (nome, genere, cittadinanza e data/anno di nascita) prima del completamento dell'onboarding. |
| RF-008 | UF-008 | Nuovo utente | Prima del completamento della registrazione DEMOS DEVE raccogliere separatamente i consensi obbligatori a Privacy Policy e Termini; il consenso al trattamento delle opinioni politiche DEVE restare esplicito e gestibile separatamente. |
| RF-009 | UF-009 | Nuovo utente | Il flusso di registrazione DEVE acquisire il territorio di residenza previsto e renderlo disponibile ai servizi territoriali/elettorali senza inventare un'appartenenza elettorale ufficiale non verificata. |
| RF-010 | UF-010 | Utente | Una route protetta DEVE reindirizzare l'utente non autenticato verso `/auth`; durante la verifica di una sessione esistente PUÒ mostrare uno stato di caricamento e NON DEVE rendere il contenuto protetto come se l'autenticazione fosse già confermata. |

## B. Profilo, account e diritti privacy

| Requisito | Funzione | Attore | Specifica funzionale verificabile |
|---|---|---|---|
| RF-011 | UF-011 | Utente autenticato | L'utente DEVE poter consultare il proprio profilo e modificare i campi esposti come modificabili dalla superficie Profilo, con persistenza sul proprio account. |
| RF-012 | UF-012 | Utente autenticato | DEMOS DEVE consentire la consultazione del profilo pubblico di politici/candidati riconosciuti senza esporre nella proiezione pubblica email, dati anagrafici privati o residenza privata non destinata alla pubblicazione. |
| RF-013 | UF-013 | Utente autenticato | L'utente DEVE poter configurare il proprio avatar/immagine mediante la superficie dedicata e la configurazione salvata DEVE essere riutilizzata nelle superfici che mostrano il profilo. |
| RF-014 | UF-014 | Utente autenticato | Il profilo DEVE mostrare le selezioni correnti di rappresentanti/candidati e, dove previsto, il governo ideale; i controlli di modifica DEVONO essere disponibili solo sul proprio profilo. |
| RF-015 | UF-015 | Utente autenticato | L'utente DEVE poter consultare, concedere e revocare il consenso al trattamento delle opinioni politiche; la revoca DEVE essere persistita e rispettata dalle elaborazioni che richiedono tale consenso. |
| RF-016 | UF-016 | Utente autenticato | L'utente DEVE poter richiedere l'esportazione dei dati personali disponibili nel proprio account in almeno uno dei formati supportati dalla funzione di export. |
| RF-017 | UF-017 | Utente autenticato | L'utente DEVE poter avviare la cancellazione volontaria del proprio account; la cancellazione DEVE utilizzare il percorso canonico di erasure e rimuovere i collegamenti personali coperti dal servizio di cancellazione. |
| RF-018 | UF-018 | Utente autenticato | DEMOS DEVE offrire una superficie per richiedere la limitazione del trattamento e registrare la richiesta secondo il flusso applicativo previsto. |
| RF-019 | UF-019 | Utente autenticato | DEMOS DEVE offrire una superficie per esercitare l'opposizione al trattamento e registrare la richiesta secondo il flusso applicativo previsto. |
| RF-020 | UF-020 | Utente autenticato | Le Impostazioni DEVONO rendere raggiungibili le sezioni privacy, informazioni legali e copyright previste dall'app, inclusi collegamenti diretti ai documenti legali correnti. |

## C. Opinioni, matching e selezioni politiche

| Requisito | Funzione | Attore | Specifica funzionale verificabile |
|---|---|---|---|
| RF-021 | UF-021 | Utente autenticato | L'hub Opinioni DEVE permettere di raggiungere gli ambiti territoriali di Opinione disponibili per l'utente. |
| RF-022 | UF-022 | Utente autenticato | L'utente DEVE poter esprimere una risposta ammessa alle Opinioni di ambito europeo e la risposta DEVE essere salvata come posizione dell'utente. |
| RF-023 | UF-023 | Utente autenticato | L'utente DEVE poter esprimere una risposta ammessa alle Opinioni di ambito nazionale e la risposta DEVE essere salvata come posizione dell'utente. |
| RF-024 | UF-024 | Utente autenticato | L'utente DEVE poter esprimere una risposta ammessa alle Opinioni di ambito regionale pertinenti e la risposta DEVE essere salvata come posizione dell'utente. |
| RF-025 | UF-025 | Utente autenticato | L'utente DEVE poter esprimere una risposta ammessa alle Opinioni di ambito comunale pertinenti e la risposta DEVE essere salvata come posizione dell'utente. |
| RF-026 | UF-026 | Utente autenticato | L'utente DEVE poter proporre una nuova Opinione entro i limiti applicativi previsti; la proposta NON DEVE diventare automaticamente Opinione ufficiale senza il percorso di moderazione/approvazione. |
| RF-027 | UF-027 | Utente autenticato | Il matching politico DEVE utilizzare le risposte dell'utente e dei soggetti politici secondo la matrice canonica; i suggerimenti DEVONO restare vuoti finché l'utente non ha completato tutte le Opinioni richieste dal gate corrente. |
| RF-028 | UF-028 | Utente autenticato | L'utente DEVE poter selezionare un rappresentante per un livello politico disponibile; la selezione DEVE rispettare l'eleggibilità territoriale e utilizzare la relazione canonica di selezione quando disponibile. |
| RF-029 | UF-029 | Utente autenticato | L'utente DEVE poter selezionare il candidato sostenuto per un livello/elezione disponibile; il backend DEVE rifiutare candidati fuori dal perimetro elettorale applicabile. |
| RF-030 | UF-030 | Utente autenticato | Il Podio Trasparenza DEVE presentare il ranking secondo la metrica canonica corrente e consentire, dove previsto, la selezione diretta di un rappresentante riutilizzando le stesse regole di eleggibilità delle altre selezioni. |
| RF-031 | UF-031 | Utente autorizzato alla vista statistica | Le statistiche aggregate delle Opinioni NON DEVONO restituire celle demografiche con meno di 10 risposte valide e DEVONO rimuovere tali celle prima della risposta API. |

## D. Preferiti, directory e relazioni

| Requisito | Funzione | Attore | Specifica funzionale verificabile |
|---|---|---|---|
| RF-032 | UF-032 | Utente autenticato | L'hub Preferiti DEVE aggregare i collegamenti alle principali selezioni e funzioni civiche previste; la voce PUÒ essere nascosta ai tipi account per cui non è pertinente. |
| RF-033 | UF-033 | Utente autenticato | La directory dei rappresentanti DEVE mostrare soggetti politici eleggibili/pertinenti e consentire l'accesso al loro profilo pubblico quando disponibile. |
| RF-034 | UF-034 | Utente autenticato | La directory dei candidati DEVE mostrare candidati pertinenti e consentire l'accesso al loro profilo pubblico e al flusso di selezione. |
| RF-035 | UF-035 | Visitatore | La route Attivisti DEVE essere consultabile pubblicamente secondo l'implementazione corrente e mostrare gli attivisti disponibili senza richiedere autenticazione della route. |
| RF-036 | UF-036 | Utente autenticato | La directory Organizzazioni DEVE consentire la consultazione delle organizzazioni disponibili e dei relativi dettagli pubblicabili. |
| RF-037 | UF-037 | Utente autenticato | Le superfici Siti e Social DEVONO rendere consultabili i collegamenti raccolti dall'app secondo le rispettive categorie. |
| RF-038 | UF-038 | Proprietario del profilo / soggetto autorizzato | La funzione Sostenitori DEVE esporre al proprietario gli aggregati privati consentiti; conteggi politici privati NON DEVONO essere leggibili arbitrariamente da altri utenti non autorizzati. |

## E. Firma e processi civici

| Requisito | Funzione | Attore | Specifica funzionale verificabile |
|---|---|---|---|
| RF-039 | UF-039 | Utente autenticato | L'hub Firma DEVE indirizzare alle raccolte canoniche di Iniziative Popolari, Referendum Abrogativi e ICE/ECI senza ripristinare i vecchi flussi manuali ritirati. |
| RF-040 | UF-040 | Utente autenticato | La raccolta Iniziative Popolari DEVE leggere il modello/fonte ufficiale configurato e NON DEVE dipendere da proposte manuali legacy come fonte della lista canonica. |
| RF-041 | UF-041 | Utente autenticato | La raccolta Referendum Abrogativi DEVE presentare la collezione ufficiale senza ranking di “priorità DEMOS” dei referendum né scritture di voto legacy. |
| RF-042 | UF-042 | Utente autenticato | La raccolta ICE/ECI DEVE essere una vista delle iniziative ufficiali UE e l'azione di firma DEVE condurre al canale ufficiale previsto; DEMOS NON DEVE creare o votare internamente una ICE come vecchia funzione autonoma. |
| RF-043 | UF-043 | Utente autenticato | La priorità DEMOS per le Iniziative Popolari DEVE essere disponibile soltanto quando le condizioni canoniche della raccolta ufficiale sono soddisfatte e DEVE rispettare il cooldown applicabile. |
| RF-044 | UF-044 | Admin/Staff | Gli strumenti di riconciliazione multi-fonte DEVONO richiedere autorizzazione amministrativa; la marcatura di un processo come “realizzato” DEVE richiedere il riferimento previsto ed essere reversibile secondo il servizio corrente. |

## F. Preferenze democratiche e istituzionali

| Requisito | Funzione | Attore | Specifica funzionale verificabile |
|---|---|---|---|
| RF-045 | UF-045 | Utente autenticato | L'hub Vota DEVE rendere raggiungibili le preferenze correnti per Capo di Stato, Governo, Grazia, Amnistia e priorità delle Iniziative Popolari. |
| RF-046 | UF-046 | Utente autenticato | L'utente DEVE poter esprimere/modificare la preferenza per Capo di Stato secondo le regole del relativo scope e cooldown. |
| RF-047 | UF-047 | Utente autenticato | L'utente DEVE poter comporre il proprio Governo ideale selezionando le preferenze ministeriali supportate; ogni modifica soggetta a cooldown DEVE usare lo scope corretto del ministero. |
| RF-048 | UF-048 | Utente autenticato | L'utente DEVE poter esprimere o rimuovere la preferenza relativa alla Grazia secondo lo stato e il cooldown canonici. |
| RF-049 | UF-049 | Utente autenticato | L'utente DEVE poter esprimere o rimuovere la preferenza relativa all'Amnistia secondo lo stato e il cooldown canonici. |
| RF-050 | UF-050 | Utente autenticato | Le preferenze coperte dal servizio condiviso DEVONO applicare un cooldown di 24 ore alle modifiche reali; una prima scelta consentita o un no-op NON DEVONO essere trattati come una modifica arbitrariamente bloccata. |

## G. Eventi, comunicazioni e strumenti avanzati

| Requisito | Funzione | Attore | Specifica funzionale verificabile |
|---|---|---|---|
| RF-051 | UF-051 | Utente autenticato | Il feed Eventi DEVE mostrare eventi approvati/rilevanti secondo le regole correnti, combinando priorità dei soggetti selezionati, territorio ed elezioni pertinenti quando tali dati sono disponibili. |
| RF-052 | UF-052 | Utente autenticato | L'utente DEVE poter aprire il dettaglio di un evento raggiungibile dal feed/calendario senza ottenere privilegi di modifica non posseduti. |
| RF-053 | UF-053 | Soggetto abilitato alla creazione eventi | La creazione di un evento DEVE essere autorizzata per capability/ruoli ammessi; un evento creato da un soggetto non Admin DEVE entrare nello stato di approvazione previsto e NON DEVE essere pubblicato automaticamente se manca il modello di approvazione. |
| RF-054 | UF-054 | P/C/CP/Admin/I/A/O o capability equivalente | La superficie Strumenti DEVE negare l'accesso funzionale agli utenti ordinari non abilitati e rendere disponibili soltanto le azioni coerenti con il tipo/capability dell'account. |
| RF-055 | UF-055 | Politico/soggetto istituzionale autorizzato | La funzione Comunica DEVE attribuire la comunicazione al soggetto autenticato autorizzato e NON DEVE consentire a un utente normale di scegliere arbitrariamente un altro politico come autore. |
| RF-056 | UF-056 | Istituzione con autorità territoriale valida | Informa Cittadini DEVE consentire l'invio territoriale solo quando esiste una membership comunale canonica `OFFICIAL` non ambigua; membership `VERIFIED` o `SELF_DECLARED` NON DEVONO essere sufficienti ad autorizzare il broadcast istituzionale. |
| RF-057 | UF-057 | Candidato con candidatura attiva | Il Programma elettorale DEVE essere associato alla candidatura canonica attiva; se vi sono più candidature attive DEVE essere richiesto un contesto esplicito, e alla chiusura della candidatura il programma DEVE seguire il percorso di finalizzazione previsto. |
| RF-058 | UF-058 | Utente autenticato | Il flusso di riconoscimento/reclamo profilo DEVE consentire di richiedere il riconoscimento del soggetto previsto senza trasformare autonomamente l'utente in una capability privilegiata prima della verifica/approvazione prevista. |

## H. Notifiche, sondaggi, segnalazioni e utilità

| Requisito | Funzione | Attore | Specifica funzionale verificabile |
|---|---|---|---|
| RF-059 | UF-059 | Utente autenticato | Il feed Notifiche DEVE mostrare le notifiche destinate all'utente autenticato e NON DEVE usare un feed globale come sostituto delle notifiche recipient-specific. |
| RF-060 | UF-060 | Utente autenticato | L'utente DEVE poter consultare e modificare le preferenze di notifica esposte dalla superficie dedicata e tali preferenze DEVONO essere utilizzabili dal sistema di invio. |
| RF-061 | UF-061 | Utente autenticato | La superficie Notifiche Totali DEVE rendere disponibili gli aggregati previsti senza ampliare l'accesso a dati privati di altri utenti oltre le autorizzazioni applicabili. |
| RF-062 | UF-062 | Utente che segue/seleziona un politico o candidato | Quando un politico/candidato modifica realmente una propria Opinione, DEMOS DEVE poter generare una notifica ai destinatari risolti dalle selezioni politiche correnti; prima risposta e valore invariato NON DEVONO generare una notifica di cambio Opinione. |
| RF-063 | UF-063 | Utente con accesso alla funzione | I Sondaggi DEVONO poter essere consultati/filtrati ai livelli territoriale Regione, Provincia e Comune previsti dalle relative route e dal contesto dell'utente. |
| RF-064 | UF-064 | Utente autenticato | L'utente DEVE poter inviare una segnalazione tramite la superficie “Segnala problema” secondo i campi e i vincoli esposti dal flusso corrente. |
| RF-065 | UF-065 | Utente autenticato | La superficie Avvistamenti DEVE essere raggiungibile dalla navigazione principale e offrire le funzioni correnti di avvistamento/contatto senza richiedere capability politiche avanzate. |
| RF-066 | UF-066 | Utente autenticato | La superficie Riscontro DEVE consentire all'utente di fornire il feedback previsto dal flusso applicativo corrente. |

## I. Requisiti funzionali trasversali derivati dal comportamento corrente

Questi requisiti non introducono nuove funzioni, ma formalizzano regole che più funzioni condividono.

| Requisito | Funzioni collegate | Specifica funzionale verificabile |
|---|---|---|
| RF-067 | UF-022, UF-023, UF-024, UF-025, UF-027 | Le risposte canoniche alle Opinioni DEVONO essere normalizzate nei valori ammessi dal modello corrente (`Favorevole`, `Contrario`, `Non lo so` / rappresentazione interna equivalente); valori non ammessi NON DEVONO essere scritti come risposta valida. |
| RF-068 | UF-012, UF-021…UF-031 | Le Opinioni di un cittadino ordinario DEVONO restare private verso altri cittadini; le Opinioni di politici/candidati DEVONO essere consultabili dagli utenti autenticati secondo la policy corrente; l'Admin PUÒ accedervi per esigenze operative autorizzate. |
| RF-069 | UF-028, UF-029, UF-051, UF-053, UF-056 | Quando esiste una membership territoriale/elettorale canonica più specifica e autorevole, essa DEVE prevalere sui fallback legacy più ampi; conflitti di pari autorità DEVONO fallire chiuso anziché ampliare l'eleggibilità. |
| RF-070 | UF-003, UF-004, UF-005, UF-006 | I percorsi di registrazione alternativi DEVONO convergere sullo stesso vincolo “CIE prima dell'account personale” e NON DEVONO esistere bypass pubblici che creino `users` o JWT definitivi pre-CIE. |
| RF-071 | UF-040, UF-041, UF-042, UF-043 | Le fonti ufficiali/canoniche DEVONO essere autoritative per le raccolte civiche correnti; vecchie tabelle o route manuali ritirate NON DEVONO riapparire come fonte pubblica alternativa. |
| RF-072 | UF-017, UF-028, UF-029, UF-050, UF-059, UF-062 | La cancellazione di un account DEVE rimuovere i collegamenti personali canonici previsti, inclusi selezioni politiche, cooldown e relazioni di notifica dove il servizio di erasure li gestisce. |

## J. Tracciabilità e manutenzione

- Ogni `UF-001…UF-066` del catalogo DEVE avere almeno un `RF-*` in questo documento.
- Ogni `RF-*` DEVE riferirsi a uno o più `UF-*` esistenti nel catalogo.
- Un requisito che descrive infrastruttura, performance, disponibilità, compatibilità di piattaforma o security non funzionale DEVE essere spostato nel documento F12-03 anziché duplicato qui.
- Quando cambia il comportamento di una funzione, catalogo e requisito collegato DEVONO essere aggiornati nello stesso checkpoint.
- Il test `api/tests/functionalRequirements.smoke.test.js` controlla la tracciabilità minima e l'unicità degli identificativi.
