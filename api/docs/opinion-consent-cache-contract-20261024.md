# DEMOS — revoca consenso e cache delle Opinioni (DOC-022, PR #247)

**Stato:** caratterizzazione delle route attuali con dati sintetici, senza
modifiche alle route, ai database Supabase o ai client. Non è una decisione
sulla base giuridica della conservazione delle opinioni dopo la revoca.

## Comportamento verificabile dal codice attuale

- `POST /api/opinioni/salva` verifica il consenso politico prima di scrivere;
  se revocato, la route rifiuta il salvataggio con HTTP 403.
- `GET /api/opinioni-list?grado=...` richiede un token valido e un account
  attivo, ma **non consulta esplicitamente il consenso politico**. Legge la
  riga personale da `opinioni_risposte` con `SELECT *` e restituisce i valori
  `f/c/i/null` all'account autenticato. Il test isolato documenta che
  una revoca non nasconde automaticamente i voti già memorizzati nella GET.
- L'isolamento tra account A e B è verificato con un pool PostgreSQL fittizio;
  non equivale a una prova RLS sul database reale.
- La route GET non imposta esplicitamente `Cache-Control: no-store` né una
  politica di invalidazione della cache. Non abbiamo misurato la cache
  effettiva del browser, di Android o di eventuali proxy.
- Le aggregazioni statistiche testate separatamente escludono gli utenti
  senza consenso valido e sopprimono i gruppi sotto la soglia 10, anche
  dopo una revoca. Questo non dimostra che tutte le cache statistiche
  vengano invalidate in tempo reale.

## Decisioni e verifiche ancora necessarie prima di un rilascio

1. Distinguere **revoca del consenso per uso statistico/salvataggio**,
   accesso dell'interessato ai propri dati e **cancellazione**: non assumere
   che revocare equivalga automaticamente a cancellare, né che consenta
   di continuare qualunque trattamento. Definire con DPO e policy privacy
   la semantica applicativa e le basi giuridiche.
2. Per risposte politiche personali evitare cache HTTP condivise:
   valutare `Cache-Control: private, no-store` sulle risposte autenticabili,
   `Vary: Authorization` ove opportuno e test di assenza di riuso tra utenti.
   Non cambiare la route in questo prototipo.
3. Definire pulizia di snapshot locali dopo logout, cambio account,
   cancellazione account e revoca pertinente; impedire ripristino di dati
   dell'account A quando entra B. Verificare su browser e Android reale.
4. Qualunque cache di aggregati pubblici deve rispettare revoca, nuovi
   voti, cancellazione e soglia dinamica >=10; invalidazione o ricalcolo
   verificati prima di abilitarla.
5. In eventuale migrazione BYTEA mantenere il contratto JSON legacy
   `f/c/i/null`, auth, consenso e isolamento, senza esporre payload
   binario o catalog fingerprint al client.
6. Eseguire test RLS e end-to-end solo in un ambiente separatamente
   autorizzato; nessuna modifica a staging o produzione è autorizzata.

## Test automatico aggiunto

`api/tests/opinionCodecHttpContract.test.js` caratterizza:
- POST prima della revoca riuscito;
- dopo revoca, GET autenticata dello stesso account continua a mostrare
  il voto precedente; la GET non esegue una query al consenso;
- un altro account non vede quel voto;
- POST dopo revoca restituisce 403 senza mutare il dato;
- dopo ripristino del consenso, POST torna a funzionare.

Un `test.todo` separato tiene aperta la decisione sulle intestazioni
no-store e sulla pulizia cache. **Questo test fotografa il comportamento
attuale, non lo considera automaticamente corretto sotto il GDPR.**

Restano invariati: OP-41 **In corso**, KPI-23 **Non verificato**,
PR #247 **draft**, nessun merge/deploy/DDL e nessun accesso Supabase.
