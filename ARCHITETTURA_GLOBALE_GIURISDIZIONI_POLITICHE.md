# DEMOS — Architettura globale delle giurisdizioni politiche

## Decisione di prodotto

DEMOS è una sola piattaforma globale. I sistemi politici nazionali e territoriali non devono diventare fork dell'applicazione: il core conosce concetti generali, mentre ogni giurisdizione fornisce configurazione e adapter.

L'Italia è il primo adapter politico completo. Camera, Senato, Regione e Comune non sono categorie universali del core.

## Separazione dei concetti

Il core deve distinguere almeno:

- `jurisdiction`: territorio o ordinamento a cui appartiene una regola politica;
- `political_office`: ufficio/istituzione selezionabile, per esempio Camera o Senato nell'adapter italiano;
- `election_type`: tipo di elezione e relativo ambito territoriale;
- `territory_scope`: livello geografico usato per determinare pertinenza ed eleggibilità;
- `opinion_scope`: gruppo di Opinioni usato per matching politico, che può essere condiviso da più uffici;
- `legacy_selection_field`: colonna attuale del database mantenuta soltanto come compatibilità durante la migrazione.

## Scope territoriali del core

Il registry v1 riconosce scope generici:

- sovranazionale;
- Paese;
- regione/stato federato;
- provincia/contea o livello intermedio;
- comune/città;
- custom, per sistemi che richiedono una regola specifica.

Questi scope non implicano nomi istituzionali italiani.

## Adapter Italia v1

L'adapter italiano registra oggi cinque uffici politici usati dalle superfici DEMOS:

1. Parlamento europeo — slot italiano;
2. Camera dei deputati;
3. Senato della Repubblica;
4. livello regionale;
5. livello comunale.

Per ogni ufficio il registry definisce alias legacy, scope territoriale, campo rappresentante, campo candidato, scope Opinioni e livello del Podio di Trasparenza.

Le elezioni sono registrate separatamente dagli uffici. In particolare, un'elezione politica nazionale italiana può alimentare due uffici distinti, Camera e Senato.

## Opinioni e matching

Gli scope delle Opinioni non coincidono necessariamente con gli uffici. Nell'adapter italiano:

- `E` = Europeo;
- `N` = Nazionale, condiviso oggi da Camera e Senato;
- `R` = Regionale;
- `CO` = Comunale.

Questa separazione evita di imporre ad altri Paesi la struttura bicamerale italiana o lo stesso schema di matching.

## Compatibilità database

Il checkpoint v1 non introduce una migrazione DB.

Le colonne come `rappresentante_camera`, `candidato_senato` e simili restano operative per compatibilità con client e dati esistenti. La loro associazione semantica è però definita in un solo registry: le route non devono possedere copie indipendenti delle stesse mappe.

Una fase successiva potrà sostituire progressivamente questi campi fissi con relazioni del tipo:

`utente + jurisdiction + political_office + selected_subject`

senza cambiare la semantica applicativa già centralizzata.

## Stato IMP-027 — Political Jurisdiction Registry v1

Implementato localmente:

- registry di scope territoriali, tipi di elezione, uffici politici e scope Opinioni;
- adapter Italia con i cinque slot politici attuali;
- normalizzazione centralizzata degli alias legacy;
- eleggibilità di rappresentanti e candidati basata sullo scope dell'ufficio;
- filtro geografico degli eventi elettorali basato sullo scope del tipo elezione;
- chiusura lifecycle elettorale collegata ai campi candidati tramite registry;
- selezioni rappresentanti/candidati e relativi gradi di matching derivati dal registry;
- destinatari push dei sostenitori correnti derivati dal registry;
- livelli del Podio e normalizzazione SQL dei mandati derivati dal registry;
- livelli delle comunicazioni istituzionali derivati dal registry;
- mapping frontend/database degli scope Opinioni derivato dal registry;
- test di wiring contro la reintroduzione di mappe semantiche duplicate.

## Regola per nuovi Paesi

Un secondo Paese non deve richiedere nuove route `if country === ...` per elezioni, matching, Podio o selezioni. Deve prima estendere il registry/adapter con uffici, alias, scope territoriali, tipi di elezione e scope Opinioni; eventuali adapter di fonte o regole eccezionali devono restare dietro questa interfaccia.

La prova decisiva del modello sarà aggiungere un secondo sistema politico con struttura diversa da quella italiana senza duplicare il core.
## Stato IMP-027 — Political Jurisdiction Registry v2 / stress test USA

Il 9 ottobre 2026 il modello v1 è stato validato contro un secondo sistema politico volutamente diverso da quello italiano: gli Stati Uniti.

Fonti istituzionali usate per definire lo stress test: USAGov per struttura federale/statale/locale; U.S. House per il rapporto tra rappresentante e Congressional District; U.S. Senate/USAGov per la rappresentanza statale e la separazione tra House e Senate.

Lo stress test ha imposto quattro correzioni strutturali al core:

1. `jurisdiction` è ora un registro condiviso tra dominio civico e dominio politico (`api/config/jurisdictions.js`), invece di essere ridefinito in ogni sottosistema.
2. Un `election event` non coincide con un singolo ufficio politico. Il core distingue ora i `contest`: una General Election USA può contenere Presidenza, House, Senate, governatore, legislature statali e cariche locali con scope territoriali diversi.
3. Gli alias di uffici, elezioni e scope Opinioni sono risolvibili nel contesto di un adapter (`it`, `us`). Un nuovo Paese non deve appropriarsi globalmente di parole generiche come `Senate`, `State` o `National`.
4. Il territorio elettorale non è più limitato a Paese/Regione/Provincia/Comune. Il core supporta anche `ADMIN_LEVEL_1`, `ADMIN_LEVEL_2` ed `ELECTORAL_DISTRICT`.

### Adapter USA introdotto come prova architetturale

Configurati senza nuove route o nuove colonne legacy:

- President of the United States — scope Paese;
- U.S. House of Representatives — scope distretto elettorale;
- U.S. Senate — scope livello amministrativo 1 / Stato;
- State Governor — scope Stato;
- State Legislature upper/lower chamber — scope distretto elettorale;
- Mayor — scope Comune/località.

Sono inoltre presenti tipi evento/contest per Presidenza, House, Senate, Congressional Election, State Election, Local Election e General Election.

### Regola mixed-scope

Quando un evento contiene contest con scope territoriali differenti, `getElectionResidenceScope()` restituisce `CUSTOM` e il core non tenta di inventare una sola geografia per tutto l'evento.

In assenza di mapping delle unità elettorali, un evento mixed-scope è `fail-closed`: non viene dichiarato pertinente all'utente sulla sola base di Paese/Stato/Comune.

### Compatibilità Italia

L'adapter USA non crea `rappresentante_*`, `candidato_*`, livelli Podio o altre proiezioni italiane. Tutti i campi legacy e il Podio continuano a essere prodotti esclusivamente dall'adapter `it`.

### Limite ancora aperto

Il core ora può descrivere e confrontare anche un `ELECTORAL_DISTRICT`, ma il profilo utente/database non possiede ancora una relazione canonica persistente tra persona e giurisdizioni/unità elettorali. Per un rollout USA reale servirebbero quindi:

- risoluzione ufficiale di Stato/distretto dell'utente;
- persistenza generica delle selezioni politiche;
- adapter di fonti ufficiali USA;
- UI jurisdiction-aware.

Il prossimo passo architetturale non è aggiungere altre route USA: è sostituire progressivamente le colonne fisse `rappresentante_*` / `candidato_*` con una relazione generica di selezione politica.
## Stato IMP-027 — Political Selections v1

Il passo successivo al registry v2 è la persistenza generica delle scelte politiche correnti. Il core introduce `political_selections`, indicizzata da `user + selection_kind + political_office`, con `jurisdiction_id`, soggetto selezionato e riferimenti opzionali alla candidatura o al mandato che giustificano la selezione.

Regola di transizione:

- quando `political_selections` esiste, la lettura canonica è autorevole anche se non restituisce righe;
- le scritture italiane sono dual-write: relazione canonica + colonne legacy `rappresentante_*` / `candidato_*`;
- se la migrazione non è ancora installata, le API italiane continuano a funzionare tramite fallback legacy;
- gli adapter senza colonne legacy, come `us`, scrivono esclusivamente la relazione canonica;
- i sostenitori correnti, i push e le notifiche per cambio Opinione risolvono l'identità del sostenitore dalla relazione canonica, con fallback legacy soltanto se lo schema manca;
- la cancellazione account elimina le selezioni sia quando l'utente è il selezionante sia quando è il soggetto selezionato;
- RLS è abilitata senza policy Data API pubbliche: la relazione è privata e backend-only per default.

È disponibile inoltre `PUT /api/users/:userId/political-selection`, che usa `kind + officeId + selectedUserId` e non espone nomi di colonne italiane. Le vecchie route italiane restano compatibili ma traducono immediatamente i propri campi legacy nel contratto canonico.

La migrazione `20261009_political_selections.sql` è additiva e contiene il backfill delle selezioni italiane esistenti. Non è applicata a produzione in questo checkpoint.

### Passo successivo

Dopo un gate DB reale, le superfici legacy residue che contano o mostrano sostenitori potranno essere spostate progressivamente sul nuovo service. Solo dopo questa convergenza sarà sicuro pianificare la rimozione delle colonne fisse dal modello `users`.


## Stato IMP-027 — Political Territory Memberships v1

Il core distingue ora due piani che non devono essere confusi:

1. **territori politici dell’utente** (`user_political_territories`): Paese, livelli amministrativi, Regione/Provincia/Comune e, quando pertinente, distretto elettorale;
2. **appartenenza esatta a un’unità elettorale** (`user_electoral_unit_memberships`): relazione utente + evento elettorale + ufficio politico + unità elettorale.

L’unità elettorale esplicita ha precedenza sulla geografia inferita. Questo consente, per esempio, di distinguere correttamente nello stesso evento una circoscrizione House da una competizione statale o da altri contest senza dedurre tutto dal solo indirizzo.

### Affidabilità della fonte

Le appartenenze hanno tre livelli di prova ordinati:

`SELF_DECLARED < VERIFIED < OFFICIAL`

Per lo stesso scope territoriale/ufficio, o per lo stesso evento/ufficio, il core usa soltanto il livello più autorevole disponibile. Un dato auto-dichiarato non può quindi ampliare una circoscrizione già determinata da una fonte verificata o ufficiale.

I campi legacy `paese_residenza`, `regione_residenza`, `provincia_residenza`, `comune_residenza` vengono backfillati come `SELF_DECLARED`. Un trigger DB mantiene questa proiezione sincronizzata quando la residenza legacy cambia, indipendentemente dalla route che effettua l’aggiornamento.

### Fail-closed e compatibilità

Quando le nuove tabelle esistono, il modello canonico è autorevole anche se non contiene righe: non viene riaperto silenziosamente il fallback legacy. Il fallback ai campi `users.*_residenza` avviene esclusivamente quando lo schema canonico non è ancora installato.

Eleggibilità di candidati/rappresentanti e rilevanza delle elezioni usano lo stesso `politicalTerritoryMembershipService`. Gli adapter futuri possono scrivere territori verificati o unità elettorali ufficiali tramite entry point interni, senza nuove colonne nazionali né route pubbliche specifiche.

Entrambe le relazioni hanno RLS attiva senza policy pubbliche e sono incluse nella cancellazione account canonica.

### Stato di rilascio

`20261009_political_territory_memberships.sql` è preparata e validata su PostgreSQL isolato, ma **non è applicata a staging o produzione**. Prima del rilascio va applicata insieme alle altre migrazioni politiche su un DB test/staging reale, verificando ordine, backfill e confronto con i dati legacy. Il passo successivo è costruire resolver ufficiali per `ADMIN_LEVEL_1` / `ELECTORAL_DISTRICT` per ciascun adapter e poi migrare le superfici politiche residue che dipendono ancora direttamente dai campi geografici italiani.


### Gate combinato Political Selections + Territory Memberships

Il gate combinato delle migrazioni `20261009_political_selections.sql` e `20261009_political_territory_memberships.sql` ha evidenziato una regola aggiuntiva necessaria: fonti territoriali diverse devono poter coesistere anche quando attestano lo stesso territorio. Gli indici attivi includono quindi `source`, mantenendo separati i livelli di evidenza.

La risoluzione dell'autorità territoriale è fail-closed. Per ogni `jurisdiction + territory_type + political_office`, DEMOS usa solo il livello di verifica più alto (`SELF_DECLARED < VERIFIED < OFFICIAL`). Se più fonti dello stesso livello massimo indicano codici territoriali diversi, quello scope viene marcato come conflitto ed escluso dal contesto di eleggibilità finché non viene riconciliato. Due fonti di pari autorità che attestano lo stesso codice vengono invece deduplicate.

Questo evita sia collisioni tecniche tra residenza legacy e fonti verificate, sia l'allargamento involontario dell'elettorato dovuto a evidenze ufficiali discordanti.

## Stato IMP-027 — Political Territory Resolver v1

Il core dispone ora di resolver territoriali configurati per adapter. Per l'Italia sono separati due tipi di autorità:

- `it.istat.situas`: catalogo amministrativo ufficiale Istat/SITUAS. Lo snapshot locale è il report SITUAS 61 alla data 2026-10-09 e contiene 7.894 comuni. Normalizza Comune, livello amministrativo 1 e livello amministrativo 2 in codici stabili; un profilo che coincide con il catalogo viene registrato come `VERIFIED`, non come `OFFICIAL`, perché il catalogo certifica l'esistenza/gerarchia del territorio ma non prova la residenza personale dell'utente.
- `it.interno.eligendo`: autorità per appartenenze a unità elettorali della singola consultazione. È obbligatoriamente `eventScoped`; prima di persistere una membership `OFFICIAL` verifica che l'evento sia elettorale, che l'ufficio politico appartenga al tipo di elezione e che l'unità elettorale appartenga a quell'evento.

Lo snapshot ufficiale è usato localmente e non viene interrogato via rete durante le richieste di eleggibilità. Il resolver fallisce chiuso su Comune sconosciuto o ambiguo.

I vecchi codici regionali a due lettere di DEMOS (`TO`, `LO`, ecc.) sono esplicitamente trattati come alias di compatibilità e non come codici Regione Istat; il resolver li converte nei codici amministrativi ufficiali.

È disponibile un job di normalizzazione dei profili italiani con paginazione keyset e fingerprint del profilo. Il job è esclusivamente opt-in tramite `ENABLE_POLITICAL_TERRITORY_RESOLVER=true`, resta inerte se la migrazione territoriale canonica non è installata e non espone nuove route pubbliche. Nessun ambiente esistente viene attivato automaticamente.

## Stato IMP-027 — DAIT/Eligendo Electoral Unit Ingestion v1

Il catalogo delle unità elettorali è ora separato dall’appartenenza territoriale dell’utente. Per le Politiche del 25 settembre 2022 DEMOS conserva uno snapshot minimizzato derivato dai quattro CSV ufficiali DAIT per Camera e Senato, uninominali e plurinominali. Lo snapshot contiene soltanto circoscrizione, collegio, ufficio politico, tipo unità e hash della fonte: i dati di candidati, liste, data e luogo di nascita presenti negli export originali non vengono conservati.

Conteggi ufficiali importabili per la consultazione `POLITICHE_20220925`: Camera 147 collegi uninominali + 49 plurinominali; Senato 74 uninominali + 26 plurinominali, per un totale di 296 unità. Ogni unità è persistita in `unita_elettorale` con identità stabile scoped all’evento e provenance nel `metadata`.

L’identità del collegio e il suo perimetro sono prove diverse. I CSV DAIT attestano l’esistenza/denominazione dei collegi; il perimetro territoriale è invece materializzato soltanto da evidenza normativa ufficiale. Il checkpoint successivo ha aggiunto le tabelle del d.lgs. 177/2020 e il roster SITUAS alla data dell’elezione: `mappingComplete` indica ora che il perimetro legale dell’unità è stato acquisito, mentre `eligibilityReady` indica separatamente se la sola residenza comunale è sufficiente a risolvere l’appartenenza. Le unità con porzioni sub-comunali restano fail-closed se manca la prova più specifica dell'utente. Per le Politiche 2022 DEMOS dispone ora anche del resolver ufficiale event-scoped basato sulla sezione elettorale, che trasforma quella prova in membership elettorale `OFFICIAL`.

L’import è one-shot e opt-in tramite `ENABLE_ITALIAN_ELECTION_UNIT_SYNC=true`, richiede sempre `ITALIAN_ELECTION_UNIT_SYNC_EVENT_ID` e verifica che data e tipo dell’evento coincidano con la consultazione configurata. Per default confronta inoltre gli SHA-256 dei CSV ufficiali prima di scrivere; un drift della fonte blocca il sync invece di essere accettato silenziosamente. Non esiste una route pubblica di import.

## Electoral Perimeter v1 — Italia (D.Lgs. 177/2020)

Per le Politiche 2022 DEMOS separa l'identità dell'unità elettorale dal suo perimetro ufficiale:

- i CSV DAIT/Eligendo identificano i 296 collegi/circoscrizioni importabili per l'evento;
- le tabelle A.1/A.2/B.1/B.2 del decreto legislativo 23 dicembre 2020, n. 177 definiscono la composizione territoriale;
- il roster SITUAS del 25 settembre 2022 fornisce i codici Comune validi alla data dell'elezione: tutti i 7.897 codici comunali usati dal perimetro sono stati verificati contro il roster di 7.904 Comuni;
- il modello contiene 31.085 mapping `MUNICIPALITY` e 668 mapping `SUB_MUNICIPAL_AREA`; non usa più placeholder `OFFICIAL_AREA` nel perimetro 2022;
- 254 delle 296 unità sono risolvibili integralmente dalla residenza comunale; 42 unità includono almeno una porzione sub-comunale e quindi hanno `eligibilityReady=false` pur avendo il perimetro legale acquisito;
- le sei città che richiedono risoluzione più fine sono Torino, Milano, Genova, Roma, Napoli e Palermo. Il Comune intero non viene mai associato a uno dei rispettivi collegi uninominali. Uno snapshot minimizzato da fonti comunali ufficiali mappa 6.909 sezioni elettorali ai collegi Camera e Senato: Torino 919, Milano 1.248, Genova 656, Roma 2.602, Napoli 884, Palermo 600. Il resolver è event-scoped a `POLITICHE_20220925`, fail-closed se la sezione manca o non esiste e persiste quattro membership `OFFICIAL` (uninominale/plurinominale per Camera e Senato);
- i collegi plurinominali materializzano l'unione dei rispettivi uninominali. L'unica estensione documentata è l'adeguamento per Montecopiolo e Sassofeltrio conseguente alla legge 28 maggio 2021, n. 84, registrato esplicitamente per le assegnazioni 2022 di Camera e Senato;
- `mappingComplete=true` significa che il perimetro legale è stato acquisito; il valore storico `eligibilityResolutionComplete=false` del solo manifest di perimetro continua a significare che la sola residenza non basta per tutti. A livello composito, però, la risoluzione 2022 è ora completa: 254/296 unità sono risolvibili dalla residenza comunale e le restanti 42 sono coperte dal resolver di sezione, quindi 296/296 hanno un percorso deterministico ufficiale.

L'import rimane opt-in tramite `ENABLE_ITALIAN_ELECTION_UNIT_SYNC=true`, richiede l'evento esplicito e non viene attivato automaticamente in produzione. Il resolver sezione→collegio per le sei città è ora acquisito e collegato alla persistenza delle membership elettorali `OFFICIAL`; non sono stati eseguiti deploy, push o scritture sul database reale.


## Comunicazioni istituzionali comunali canoniche — 10 ottobre 2026

`Informa Cittadini` non usa più il vecchio modello in cui autore e Comune potevano derivare dal payload o da testo libero. Il contratto locale qualificato è ora:

- l'autore è sempre l'utente autenticato;
- può inviare soltanto un account `INSTITUTION` o Admin;
- l'autorità territoriale richiede esattamente una membership generale `MUNICIPALITY` canonica con `verification_level=OFFICIAL`; `VERIFIED` e `SELF_DECLARED` non autorizzano la diffusione istituzionale;
- membership legate a uno specifico ufficio politico non concedono autorità generale di comunicazione comunale;
- conflitti o più Comuni `OFFICIAL` attivi falliscono chiusi;
- `dove` resta solo descrizione interna al Comune autorizzato e non determina mai il territorio destinatario;
- gli avvisi canonici sono salvati nella tabella backend-only `institutional_territorial_notices`, con RLS abilitato e senza policy Data API pubbliche;
- le vecchie righe `notifiche_comunali` non vengono migrate né mostrate nel feed ordinario perché il loro target territoriale storico non è dimostrabile in modo sicuro;
- il feed utente mostra un avviso solo quando `jurisdiction_id + territory_code` coincidono con la membership comunale canonica del destinatario;
- la vista Admin può continuare a ispezionare le righe legacy e vede anche i nuovi avvisi canonici.

La migrazione resta esplicita in `20261010_municipal_institutional_communications.sql`: il codice rimane fail-closed finché la tabella canonica non è installata e l'account istituzionale non possiede un'autorità comunale `OFFICIAL`. Nessuna migrazione o modifica al database reale è stata eseguita durante il gate locale.
