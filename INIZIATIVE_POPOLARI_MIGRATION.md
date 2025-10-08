# Migrazione Tabella Iniziative Popolari

## Problema
La tabella `iniziative_popolari` deve avere la stessa struttura della tabella `ice` per far funzionare la pagina `/iniziative-popolari` esattamente come la pagina ICE.

## Soluzione
Aggiornare la tabella `iniziative_popolari` con le colonne mancanti per renderla compatibile con la struttura ICE.

## Colonne Richieste

### Struttura ICE (riferimento):
- `id` - VARCHAR (chiave primaria)
- `nome` - VARCHAR
- `descrizione` - TEXT
- `datainizio` - DATE
- `datafine` - DATE
- `sitoweb` - TEXT
- `quorum` - VARCHAR(50)
- `data_creazione` - TIMESTAMP
- `votiices` - INTEGER
- `firme` - INTEGER
- `esito` - VARCHAR(100)

### Modifiche Necessarie per `iniziative_popolari`:

1. **Aggiungere colonne mancanti:**
   ```sql
   ALTER TABLE iniziative_popolari 
   ADD COLUMN IF NOT EXISTS descrizione TEXT,
   ADD COLUMN IF NOT EXISTS datainizio DATE,
   ADD COLUMN IF NOT EXISTS datafine DATE,
   ADD COLUMN IF NOT EXISTS sitoweb TEXT,
   ADD COLUMN IF NOT EXISTS quorum VARCHAR(50) DEFAULT 'pending',
   ADD COLUMN IF NOT EXISTS data_creazione TIMESTAMP DEFAULT NOW(),
   ADD COLUMN IF NOT EXISTS votiices INTEGER DEFAULT 0,
   ADD COLUMN IF NOT EXISTS firme INTEGER DEFAULT 0,
   ADD COLUMN IF NOT EXISTS esito VARCHAR(100);
   ```

2. **Rinominare colonne esistenti (se necessario):**
   ```sql
   -- Se esistono colonne con nomi diversi, rinominarle
   ALTER TABLE iniziative_popolari RENAME COLUMN data_inizio TO datainizio;
   ALTER TABLE iniziative_popolari RENAME COLUMN data_fine TO datafine;
   ALTER TABLE iniziative_popolari RENAME COLUMN sito_web TO sitoweb;
   ```

3. **Aggiornare dati esistenti:**
   ```sql
   -- Copia dati da colonne vecchie a nuove (se necessario)
   UPDATE iniziative_popolari 
   SET data_creazione = created_at 
   WHERE data_creazione IS NULL AND created_at IS NOT NULL;
   ```

## File Creati

1. **`update-iniziative-popolari-schema.sql`** - Script SQL per l'aggiornamento
2. **`migrate-iniziative-popolari.cjs`** - Script JavaScript per eseguire la migrazione
3. **API aggiornata** - `api/routes/iniziative-popolari.js` con colonne corrette

## Esecuzione

Per eseguire la migrazione:

```bash
# Opzione 1: Esegui lo script SQL direttamente nel database
psql $DATABASE_URL -f update-iniziative-popolari-schema.sql

# Opzione 2: Esegui lo script JavaScript
node migrate-iniziative-popolari.cjs
```

## Verifica

Dopo l'esecuzione, verifica che la tabella abbia tutte le colonne necessarie:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'iniziative_popolari' 
ORDER BY ordinal_position;
```

## Risultato

Dopo la migrazione, la pagina `/iniziative-popolari` funzionerà esattamente come la pagina ICE con:
- ✅ Stessa struttura dati
- ✅ Stessa logica di visibilità basata sui ruoli
- ✅ Stesse funzionalità di creazione/modifica/eliminazione
- ✅ Stessi indicatori visivi (cerchi colorati, badge)
- ✅ Stessa gestione delle iniziative proposte
