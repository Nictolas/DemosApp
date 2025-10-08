# Migrazione Tabella Referendum Abrogativi

## Problema
La tabella `referendum_abrogativi` deve avere la stessa struttura della tabella `ice` per far funzionare la pagina `/referendum-abrogativi` esattamente come la pagina ICE.

## Soluzione
Aggiornare la tabella `referendum_abrogativi` con le colonne mancanti per renderla compatibile con la struttura ICE.

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

### Modifiche Necessarie per `referendum_abrogativi`:

1. **Aggiungere colonne mancanti:**
   ```sql
   ALTER TABLE referendum_abrogativi 
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
   ALTER TABLE referendum_abrogativi RENAME COLUMN data_inizio TO datainizio;
   ALTER TABLE referendum_abrogativi RENAME COLUMN data_fine TO datafine;
   ALTER TABLE referendum_abrogativi RENAME COLUMN sito_web TO sitoweb;
   ```

3. **Aggiornare dati esistenti:**
   ```sql
   -- Copia dati da colonne vecchie a nuove (se necessario)
   UPDATE referendum_abrogativi 
   SET data_creazione = created_at 
   WHERE data_creazione IS NULL AND created_at IS NOT NULL;
   ```

## File Creati

1. **`update-referendum-abrogativi-schema.sql`** - Script SQL per l'aggiornamento
2. **`migrate-referendum-abrogativi.cjs`** - Script JavaScript per eseguire la migrazione
3. **API creata** - `api/routes/referendum-abrogativi.js` con struttura identica alle ICE
4. **Frontend aggiornato** - Pagina modificata per funzionare come ICE

## Esecuzione

Per eseguire la migrazione:

```bash
# Opzione 1: Esegui lo script SQL direttamente nel database
psql $DATABASE_URL -f update-referendum-abrogativi-schema.sql

# Opzione 2: Esegui lo script JavaScript
node migrate-referendum-abrogativi.cjs
```

## Verifica

Dopo l'esecuzione, verifica che la tabella abbia tutte le colonne necessarie:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'referendum_abrogativi' 
ORDER BY ordinal_position;
```

## Risultato

Dopo la migrazione, la pagina `/referendum-abrogativi` funzionerà esattamente come la pagina ICE con:
- ✅ Stessa struttura dati
- ✅ Stessa logica di visibilità basata sui ruoli
- ✅ Stesse funzionalità di creazione/modifica/eliminazione
- ✅ Stessi indicatori visivi (cerchi colorati, badge)
- ✅ Stessa gestione dei referendum proposti
