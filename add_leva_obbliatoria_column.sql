-- Aggiungi la colonna leva_obbliatoria alla tabella opinioni_risposte
-- Questa colonna è necessaria per salvare le risposte degli utenti per l'opinione "leva_obbliatoria"

ALTER TABLE opinioni_risposte 
ADD COLUMN IF NOT EXISTS leva_obbliatoria TEXT;

-- Verifica che la colonna sia stata aggiunta correttamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'opinioni_risposte' 
AND column_name = 'leva_obbliatoria';

