-- Script per aggiornare la tabella iniziative_popolari per renderla uguale alla tabella ice

-- Aggiungi le colonne mancanti per renderla compatibile con la struttura ICE
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

-- Aggiorna la colonna data_creazione se esiste già created_at
UPDATE iniziative_popolari 
SET data_creazione = created_at 
WHERE data_creazione IS NULL AND created_at IS NOT NULL;

-- Rinomina le colonne esistenti se necessario (opzionale)
-- ALTER TABLE iniziative_popolari RENAME COLUMN data_inizio TO datainizio;
-- ALTER TABLE iniziative_popolari RENAME COLUMN data_fine TO datafine;
-- ALTER TABLE iniziative_popolari RENAME COLUMN sito_web TO sitoweb;

-- Aggiungi indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_quorum ON iniziative_popolari(quorum);
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_datainizio ON iniziative_popolari(datainizio);
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_data_creazione ON iniziative_popolari(data_creazione);

-- Verifica la struttura finale
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'iniziative_popolari' 
ORDER BY ordinal_position;
