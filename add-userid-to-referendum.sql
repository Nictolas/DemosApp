-- Aggiunge la colonna userid alla tabella referendum_abrogativi
-- La colonna sarà di tipo UUID e nullable (perché viene azzerata quando approvata)

ALTER TABLE referendum_abrogativi 
  ADD COLUMN IF NOT EXISTS userid UUID REFERENCES users(id);

-- Crea un indice per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_referendum_abrogativi_userid ON referendum_abrogativi(userid);

-- Verifica che la colonna sia stata aggiunta
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'referendum_abrogativi' 
  AND column_name = 'userid';

