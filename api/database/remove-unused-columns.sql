-- Rimuove le colonne non necessarie dalla tabella iniziative_ministero
-- Colonne da rimuovere: quorum, documento, promotore

-- Rimuovi colonna quorum
ALTER TABLE iniziative_ministero 
DROP COLUMN IF EXISTS quorum;

-- Rimuovi colonna documento
ALTER TABLE iniziative_ministero 
DROP COLUMN IF EXISTS documento;

-- Rimuovi colonna promotore
ALTER TABLE iniziative_ministero 
DROP COLUMN IF EXISTS promotore;

-- Verifica che le colonne siano state rimosse
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'iniziative_ministero'
ORDER BY ordinal_position;

