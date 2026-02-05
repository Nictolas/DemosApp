# Proponi opinione, Gestisci opinioni e dove sono i voti

## Tabella `opinioni_proposte` (nuova)

Le proposte "da approvare" possono essere migrate dalla tabella `opinioni_domande` alla nuova tabella **`opinioni_proposte`** (stesso `id` per mantenere i voti in `voti_opinioni_proposte`).

- **Script di creazione e migrazione:** `api/create-opinioni-proposte-and-migrate.sql` (usa la colonna `gradi_opinioni` come in Neon). Se la colonna si chiama `gradi_opinione`, usa `api/create-opinioni-proposte-gradi_opinione.sql`.
- Dopo la migrazione, l’API legge e scrive da `opinioni_proposte` quando la tabella esiste; altrimenti continua a usare `opinioni_domande` (righe con "da approvare").

## Pagina Proponi opinione (`/proponi-opinione`)

La pagina mostra le **proposte di opinione** in attesa di approvazione (quelle in `opinioni_domande` con `gradi_opinione` che contiene **"da approvare"**).

- **Dati:** arrivano da **GET `/api/opinioni-proposte`** (backend `api/routes/opinioni-proposte.js`).
- **Tabella Neon:** **`opinioni_domande`** (colonne: `id`, `text`, `gradi_opinione`, `approfondimento`).
- **Filtro:** vengono restituite solo le righe in cui `gradi_opinione` include `"da approvare"` (supportato sia come array di testo che come JSONB).

Se in Neon vedi le proposte ma in pagina no, le cause tipiche sono:
1. **Tipo di `gradi_opinione`:** se in Neon è JSONB (es. `["da approvare"]`), la vecchia condizione SQL `'da approvare' = ANY(gradi_opinione)` non funziona. È stato aggiunto un filtro che funziona anche con JSONB (`gradi_opinione::text LIKE '%da approvare%'`).
2. **Tabella voti mancante:** se la query faceva JOIN con `voti_opinioni_proposte` e la tabella non esisteva, la GET andava in errore. Ora, se la tabella non c’è, la GET viene eseguita senza JOIN e i voti sono restituiti come 0.

## Dove sono registrati i voti (numero voti per proposta)

I voti sulle **proposte di opinione** (quelle “da approvare”) sono registrati nella tabella Neon:

**`voti_opinioni_proposte`**

| Colonna      | Tipo        | Uso |
|-------------|-------------|-----|
| `id`        | SERIAL      | Chiave primaria |
| `utente_id` | UUID        | ID utente che ha votato |
| `opinione_id` | VARCHAR(255) | ID della proposta (stesso `id` di `opinioni_domande`) |
| `data_voto` | TIMESTAMP   | Quando è stato espresso il voto |
| UNIQUE(`utente_id`, `opinione_id`) | | Un utente può votare una sola volta per proposta |

- Il **numero di voti** mostrato in Proponi opinione e in Gestisci opinioni è il **conteggio** delle righe in `voti_opinioni_proposte` per quel `opinione_id` (calcolato nella GET con un `LEFT JOIN` + `GROUP BY` / `COUNT`).
- La tabella viene creata allo startup dal backend con `CREATE TABLE IF NOT EXISTS voti_opinioni_proposte ...` (in `opinioni-proposte.js`). Se su Neon non esiste ancora, va creata (o riavviare l’API dopo aver verificato che lo script di creazione giri correttamente).

## Gestisci opinioni (`/gestisci-opinioni`)

La pagina **Gestisci opinioni** usa gli stessi dati:
- **GET `/api/opinioni-proposte`** per l’elenco delle proposte “da approvare” e il **numero di voti** (sempre da `voti_opinioni_proposte`).
- Endpoint aggiuntivi per accettare/rifiutare/cancellare proposte (che aggiornano `opinioni_domande` e, in caso di cancellazione, anche `voti_opinioni_proposte`).

## Riepilogo tabelle Neon

| Tabella                    | Uso |
|---------------------------|-----|
| **`opinioni_domande`**    | Contiene tutte le domande/opinioni (incluse le proposte “da approvare”). Colonne: `id`, `text`, `gradi_opinione`, `approfondimento`. |
| **`voti_opinioni_proposte`** | Registra chi ha votato quale proposta: `utente_id`, `opinione_id`, `data_voto`. Il **numero voti** è il conteggio per `opinione_id`. |
