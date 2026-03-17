-- Script per rimuovere le colonne obsolete dalla tabella voti_camera
-- Rimuove: oggetto_voto, esito_voto, legislatura
-- Queste colonne sono state sostituite da: votazione, voto

-- Rimuovi colonna oggetto_voto (sostituita da votazione)
ALTER TABLE voti_camera DROP COLUMN IF EXISTS oggetto_voto;

-- Rimuovi colonna esito_voto (sostituita da voto)
ALTER TABLE voti_camera DROP COLUMN IF EXISTS esito_voto;

-- Rimuovi colonna legislatura (non più necessaria)
ALTER TABLE voti_camera DROP COLUMN IF EXISTS legislatura;

-- Verifica che le colonne siano state rimosse
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'voti_camera' 
ORDER BY ordinal_position;


