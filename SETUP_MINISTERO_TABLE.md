# Setup Tabella iniziative_ministero

## Script SQL da eseguire

Esegui questo script SQL direttamente sul database Neon (tramite dashboard o client PostgreSQL):

```sql
-- Tabella per iniziative e referendum dal Ministero della Giustizia
CREATE TABLE IF NOT EXISTS iniziative_ministero (
    id VARCHAR(255) PRIMARY KEY,
    id_ministero VARCHAR(255) UNIQUE,
    titolo TEXT NOT NULL,
    descrizione TEXT,
    tipo VARCHAR(50) DEFAULT 'iniziativa',
    stato VARCHAR(50) DEFAULT 'in_corso',
    
    -- Date
    data_inizio DATE,
    data_fine DATE,
    
    -- Sostenitori e quorum
    firme_raccolte INTEGER DEFAULT 0,
    quorum INTEGER DEFAULT 0,
    quorum_raggiunto BOOLEAN DEFAULT false,
    
    -- URL e link
    sito_web TEXT,
    documento TEXT,
    
    -- Metadati
    promotore TEXT,
    dati_raw JSONB,
    
    -- Timestamps
    data_ultimo_aggiornamento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_id_ministero ON iniziative_ministero(id_ministero);
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_tipo ON iniziative_ministero(tipo);
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_stato ON iniziative_ministero(stato);
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_data_fine ON iniziative_ministero(data_fine);
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_quorum_raggiunto ON iniziative_ministero(quorum_raggiunto);

-- Commenti per documentazione
COMMENT ON TABLE iniziative_ministero IS 'Iniziative e referendum sincronizzati dal Ministero della Giustizia';
COMMENT ON COLUMN iniziative_ministero.id_ministero IS 'ID univoco dall''API del Ministero';
COMMENT ON COLUMN iniziative_ministero.tipo IS 'Tipo: iniziativa, referendum, etc.';
COMMENT ON COLUMN iniziative_ministero.stato IS 'Stato: in_corso, conclusa, etc.';
COMMENT ON COLUMN iniziative_ministero.quorum_raggiunto IS 'Indica se il quorum è stato raggiunto';
```

## Come eseguire

### Opzione 1: Dashboard Neon
1. Vai sulla dashboard Neon del tuo progetto
2. Apri il SQL Editor
3. Incolla lo script sopra
4. Esegui

### Opzione 2: Client PostgreSQL
```bash
# Se hai DATABASE_URL configurato
psql $DATABASE_URL -f api/database/create-ministero-table.sql
```

### Opzione 3: Script Node.js (quando DATABASE_URL è configurato)
```bash
node api/database/create-ministero-table.cjs
```

## Verifica

Dopo l'esecuzione, verifica che la tabella sia stata creata:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'iniziative_ministero'
ORDER BY ordinal_position;
```

## Prossimi passi

Dopo aver creato la tabella:

1. **Testare la sincronizzazione manuale:**
   ```bash
   POST /api/ministero/sync
   ```

2. **Verificare i dati sincronizzati:**
   ```bash
   GET /api/ministero/database
   ```

3. **Il job automatico si avvierà automaticamente** all'avvio del server e sincronizzerà ogni 6 ore.

