-- Script SQL per aggiungere colonna fiscal_number alla tabella users
-- Necessaria per l'autenticazione CIE tramite OIDC

-- Aggiungi colonna fiscal_number (se non esiste già)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS fiscal_number VARCHAR(20);

-- Aggiungi constraint UNIQUE per fiscal_number
-- Nota: Rimuovi il commento se vuoi che fiscal_number sia univoco
-- ALTER TABLE users ADD CONSTRAINT unique_fiscal_number UNIQUE (fiscal_number);

-- Crea indice per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_users_fiscal_number 
ON users(fiscal_number);

-- Verifica che la colonna sia stata aggiunta
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'fiscal_number';

