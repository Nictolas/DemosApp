-- Rinomina la colonna da "leva_obbliatoria" a "leva_obbligatoria" nella tabella opinioni_risposte
-- Questo corregge l'errore di ortografia nel nome della colonna

ALTER TABLE opinioni_risposte 
RENAME COLUMN leva_obbliatoria TO leva_obbligatoria;

-- Verifica che la colonna sia stata rinominata correttamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'opinioni_risposte' 
AND column_name = 'leva_obbligatoria';

