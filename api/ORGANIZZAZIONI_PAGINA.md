# Pagina Organizzazioni – Come funziona e perché può essere vuota

## Come funziona

La pagina **https://www.demos.community/organizzazioni** mostra l’elenco delle **organizzazioni** registrate.  
Non esiste una tabella separata “organizzazioni”: le organizzazioni sono **utenti** della tabella **`users`** con **`ruolo = 'O'`** (Organizzazione).

- Il frontend chiama:
  - **GET** `https://demos-c7k0.onrender.com/api/organizzazioni` (lista, con eventuali filtri `search`, `regione`, `tipologia`)
  - **GET** `https://demos-c7k0.onrender.com/api/organizzazioni/filtri` (regioni e tipologie per i filtri)
- L’API (in `api/routes/organizzazioni.js`) fa una query su **`users`** con `WHERE ruolo = 'O'` e restituisce quei record come “organizzazioni”.

## Tabelle Neon usate

| Tabella | Uso |
|--------|-----|
| **`users`** | Unica tabella usata per la lista organizzazioni. Colonne rilevanti: `id`, `nome`, `cognome`, `email`, `ruolo`, `status`, `regione_residenza`, `tipologie_attivismo`, social, avatar, ecc. Gli utenti con **`ruolo = 'O'`** sono le organizzazioni. |
| **`users.organizzazioni`** | Colonna sulla tabella **`users`**: per gli utenti “sostenitori” indica **l’id dell’organizzazione** che stanno seguendo (uno solo). Usata per il conteggio “sostenitori” per ogni organizzazione. |

Quindi:
- **Lista organizzazioni** = `SELECT ... FROM users u WHERE u.ruolo = 'O'`.
- **Conteggio sostenitori** per ogni organizzazione = quanti `users` hanno `organizzazioni = <id organizzazione>`.

Nessun’altra tabella (es. “organizzazioni” dedicata) è usata per questa pagina.

### Colonne di `users` usate per le organizzazioni

L'API in `api/routes/organizzazioni.js` seleziona queste colonne per ogni organizzazione: `id`, `nome`, `cognome`, `email`, `ruolo`, `status`, `created_at`, `updated_at`, `avatar_config`, `genere`, `data_nascita`, `cittadinanza`, `paese_residenza`, `regione_residenza`, `provincia_residenza`, `comune_residenza`, **`facebook_url`**, **`website_url`**, `twitter_url`, **`instagram_url`**, `linkedin_url`, `telegram_url`, `twitch_url`, `youtube_url`, **`tipologie_attivismo`** (JSONB). Il conteggio sostenitori è calcolato a runtime (colonna `users.organizzazioni` degli altri utenti).

**Inserire le 10 organizzazioni di esempio:** usare lo script `api/insert-organizzazioni-10.sql` nel SQL Editor di Neon (Legambiente, ActionAid, Cittadinanzattiva, CILD, MIT, City Angels, XR Italia, Di' Gay Project, Love My Way, PeaceLink).

## Perché la pagina è vuota

La pagina è vuota quando in Neon **non ci sono utenti con `ruolo = 'O'`**.

Possibili cause:
1. Nessun account è ancora stato creato/aggiornato con ruolo Organizzazione (`'O'`).
2. In fase di registrazione o gestione utenti il ruolo “Organizzazione” non viene mai impostato su `'O'`.
3. La colonna `ruolo` in `users` esiste ma è sempre valorizzata con altri ruoli (Elettore, Politico, Attivista, ecc.) e mai con `'O'`.

Quindi non è un bug della pagina o dell’API: è coerente con l’assenza di utenti Organizzazione nel DB.

## Cosa controllare in Neon

1. **Presenza della colonna `organizzazioni` in `users`**  
   Se manca, va creata (vedi sotto o `api/routes/migrate-columns.js`).

2. **Quanti utenti hanno `ruolo = 'O'`**  
   Esegui in Neon (SQL Editor):

   ```sql
   SELECT id, email, nome, cognome, ruolo, status, created_at
   FROM users
   WHERE ruolo = 'O'
   ORDER BY created_at DESC;
   ```

   - Se questo query restituisce 0 righe, la pagina organizzazioni resterà vuota finché non ci saranno utenti con `ruolo = 'O'`.
   - Se restituisce righe, quelle sono le organizzazioni che vedrai in lista (salvo filtri).

3. **Verifica colonna `organizzazioni`** (per il conteggio sostenitori):

   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'organizzazioni';
   ```

   Se non c’è, puoi crearla con:

   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS organizzazioni VARCHAR(255) DEFAULT NULL;
   CREATE INDEX IF NOT EXISTS idx_users_organizzazioni ON users (organizzazioni);
   ```

## Come avere organizzazioni in lista

- **Manuale (per test):** aggiornare uno o più utenti esistenti a ruolo Organizzazione:

  ```sql
  UPDATE users SET ruolo = 'O', updated_at = NOW() WHERE id = '<uuid-utente>';
  ```

- **Dalla app:** assicurarsi che il flusso di registrazione o “gestione ruoli” (es. in **/gestisci** o pannello admin) permetta di creare o impostare utenti con ruolo **Organizzazione** e che tale ruolo venga salvato come **`'O'`** nella colonna **`users.ruolo`**.

## Riepilogo

- **Funzionamento:** la pagina organizzazioni legge solo dalla tabella **`users`** (ruolo `'O'` + colonna `organizzazioni` per i sostenitori).
- **Pagina vuota:** significa che in **`users`** non ci sono (ancora) righe con **`ruolo = 'O'`**.
- **Cosa fare:** verificare in Neon con le query sopra e, se serve, creare/aggiornare utenti con `ruolo = 'O'` e aggiungere la colonna `organizzazioni` se manca.
