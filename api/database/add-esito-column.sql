-- Aggiunge la colonna "esito" alla tabella iniziative_ministero
-- 
-- NOTA: "stato" e "esito" sono due cose diverse:
-- - "stato" = stato della raccolta firme (in_corso, conclusa, etc.)
-- - "esito" = risultato DOPO la conclusione della raccolta firme (approvata, rifiutata, etc.)
--
-- Questa colonna mantiene compatibilità con le tabelle vecchie (iniziative_popolari e referendum_abrogativi)

ALTER TABLE iniziative_ministero 
ADD COLUMN IF NOT EXISTS esito VARCHAR(100);

-- Crea un indice per migliorare le performance delle query che filtrano per esito
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_esito ON iniziative_ministero(esito);

-- Commento per documentazione
COMMENT ON COLUMN iniziative_ministero.esito IS 'Esito dell\'iniziativa/referendum DOPO la conclusione della raccolta firme (Approvata, Rifiutata, etc.). Diverso da "stato" che indica lo stato della raccolta firme.';

