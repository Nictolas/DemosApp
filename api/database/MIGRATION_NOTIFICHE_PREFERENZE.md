# Migrazione Preferenze Notifiche

Questa migrazione sposta le preferenze delle notifiche push dalla colonna JSON `notifiche_preferenze` nella tabella `users` a una nuova tabella separata `notifiche_preferenze`.

## Vantaggi della nuova struttura

- ✅ **Performance migliori**: Query più efficienti con indici dedicati
- ✅ **Scalabilità**: Facile aggiungere nuove preferenze senza modificare la tabella `users`
- ✅ **Manutenibilità**: Logica delle notifiche isolata e più chiara
- ✅ **Normalizzazione**: Separazione delle responsabilità

## Struttura della nuova tabella

```sql
notifiche_preferenze (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id),
  demos BOOLEAN DEFAULT false,           -- Notifiche Demos
  istituzione BOOLEAN DEFAULT false,     -- Notifiche voti rappresentanti
  avvistamenti BOOLEAN DEFAULT true,      -- Notifiche avvistamenti animali
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Passi per la migrazione

### 1. Eseguire lo script SQL

Esegui lo script SQL per creare la tabella:

```bash
# Connessione al database Neon
psql $DATABASE_URL -f database/create-notifiche-preferenze-table.sql
```

Oppure esegui manualmente il contenuto del file `database/create-notifiche-preferenze-table.sql`.

### 2. Eseguire lo script di migrazione

Esegui lo script Node.js per migrare i dati esistenti:

```bash
node database/migrate-notifiche-preferenze.cjs
```

Lo script:
- Migra tutti i dati dalla colonna JSON `notifiche_preferenze` in `users` alla nuova tabella
- Crea record di default per utenti senza preferenze
- Mostra statistiche della migrazione

### 3. Verificare la migrazione

Controlla che i dati siano stati migrati correttamente:

```sql
-- Conta utenti con preferenze
SELECT COUNT(*) FROM notifiche_preferenze;

-- Verifica distribuzione preferenze
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE demos = true) as demos_count,
  COUNT(*) FILTER (WHERE istituzione = true) as istituzione_count,
  COUNT(*) FILTER (WHERE avvistamenti = true) as avvistamenti_count
FROM notifiche_preferenze;
```

### 4. (Opzionale) Rimuovere la colonna vecchia

**⚠️ IMPORTANTE**: Rimuovi la colonna `notifiche_preferenze` dalla tabella `users` **SOLO DOPO** aver verificato che tutto funziona correttamente in produzione.

```sql
-- Rimuovi la colonna JSON dalla tabella users (DOPO aver verificato che tutto funziona)
ALTER TABLE users DROP COLUMN IF EXISTS notifiche_preferenze;
```

## Compatibilità

Il codice è stato aggiornato per:
- ✅ `routes/notifiche.js` - Endpoint GET e POST `/api/notifiche/preferenze`
- ✅ `routes/comunicazioni.js` - Query per notifiche Demos e istituzionali
- ✅ `routes/avvistamenti.js` - Query per notifiche avvistamenti

## Valori di default

- `demos`: `false` (disattivato di default)
- `istituzione`: `false` (disattivato di default)
- `avvistamenti`: `true` (attivato di default per retrocompatibilità)

## Note

- La migrazione è **idempotente**: può essere eseguita più volte senza problemi
- Gli utenti senza preferenze riceveranno valori di default
- Le query usano `LEFT JOIN` per garantire compatibilità con utenti senza preferenze


