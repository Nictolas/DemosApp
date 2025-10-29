-- Aggiunge la colonna userid UUID alla tabella iniziative_popolari
ALTER TABLE iniziative_popolari 
ADD COLUMN IF NOT EXISTS userid UUID REFERENCES users(id);

-- Verifica che la colonna sia stata aggiunta
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'iniziative_popolari' 
  AND column_name = 'userid';

