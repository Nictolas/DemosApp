# DEMOS — piano di persistenza catalogo e rollback (OP-41/42)

**Stato: proposta non implementata.** Nessuna DDL, nessuna migrazione, nessun
collegamento alle route e nessuna modifica a Supabase sono autorizzati da questo
documento. Il modello attuale con 94 colonne TEXT rimane la fonte autorevole.

## Condizione per procedere

Non migrare al BYTEA finché i benchmark integrati non mostrano un vantaggio
netto misurabile rispetto a **TEXT con query aggregate ottimizzate**.
Il test isolato nel run GitHub Actions 40052212670 confronta 94 aggregazioni
TEXT sequenziali con una query TEXT raggruppata su 1.200 account sintetici:
48,571 ms somma dei tempi server delle 94 query, contro 26,815 ms mediana
server della query unica. Parità dei risultati f/c/i/NULL per 94 opinioni,
filtro PERSON, consenso e soppressione dinamica di celle 10→9→10. Non è una
misura di latenza HTTP, produzione o app Android; il percorso reale Sondaggi
esegue inoltre controlli information_schema non compresi nel confronto.

## Requisiti del catalogo persistito (solo disegno)

1. Catalogo immutabile con versione positiva crescente, hash SHA-256 degli ID
   ordinati, ID e posizioni immutabili, data di pubblicazione. Le aggiunte
   sono append-only; disattivare un'opinione senza riassegnare la posizione.
2. Conservare tutte le versioni ancora referenziate da un blob. Un processo
   di lettura deve caricare l'esatta versione registrata nel blob, verificare
   fingerprint e schemaVersion e rifiutare dati incongruenti senza indovinare
   il significato dei bit.
3. Il blob per account richiede almeno encoding, catalogVersion, fingerprint,
   payload e revision per CAS; l'integrità del fingerprint non autentica il
   contenuto né sostituisce autorizzazioni, vincoli o RLS.
4. Qualsiasi cambio di versione deve preservare NULL come «mai risposto»:
   nessuna inizializzazione a indeciso e nessuna reinterpretazione degli slot.
5. Le fonti JSONB restano dati separati: la codifica delle risposte non
   autorizza a eliminarle o a perdere provenienza/evidenze.

## Compatibilità e sicurezza prima di un eventuale rollout

- Mantenere invariati GET /api/opinioni-list con userAnswer f/c/i/null e
  POST /api/opinioni/salva con mappa ID→f/c/i. Non esporre BYTEA ai vecchi
  client Android. Verificare versioni AAB realmente installate.
- Le verifiche di autenticazione, account, consenso e isolamento devono
  rimanere lato server. Le risposte personali non vanno inserite in cache
  condivise; cache locale separata per account e invalidata a logout,
  revoca consenso, cancellazione account e cambio identità.
- Aggregati pubblici: niente risultati da cache stantia dopo revoca o
  cancellazione se una cella può scendere sotto 10. Testare tutte le
  segmentazioni e l'assenza di inferenze tramite confronti prima/dopo.
- Le scritture parziali devono preservare le altre opinioni con lock di riga
  oppure revision/CAS e retry. Testare richieste concorrenti e ripetute.
- Testare RLS e accesso non autorizzato su un ambiente di prova dedicato
  prima di qualsiasi cambio di schema; il pool mock non prova RLS reale.

## Sequenza condizionata di adozione e ritorno indietro

**Non eseguire ora**. Se il vantaggio è dimostrato e viene autorizzato:
snapshot verificato e ripristinabile; catalogo versionato persistito;
eventuale colonna shadow senza DROP; doppia lettura in confronto con TEXT;
scritture atomiche con verifica di parità; backfill controllato e verificato
su tutti gli account; monitoraggio errori e latenze; test Android; rollout
graduale dietro feature flag con ritorno immediato alla lettura TEXT.
La rimozione delle colonne legacy è una decisione distinta, posticipata fino
a quando nessun client o percorso di rollback le richieda più.

**Stop automatico dell'esperimento** in presenza di mismatch, errore di
fingerprint, perdita di aggiornamenti, revoca consenso non rispettata,
aggregati sotto soglia, regressioni Android o risparmio netto assente.

## Stato delle evidenze

- CI 40052212670: test unitari, HTTP con mock, benchmark PostgreSQL 17
  effimero, confronto TEXT 94→1 e suite consenso/privacy completati PASS.
- Nessun E2E Android, nessuna prova RLS su Supabase, nessuna verifica di
  persistenza del catalogo, nessuna migrazione o rollback reali.
- OP-41 resta **In corso**; OP-42 resta **Da fare**; KPI-23 **Non verificato**.
