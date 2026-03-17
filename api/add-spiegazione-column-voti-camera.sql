-- Aggiunge la colonna "spiegazione" alla tabella voti_camera
-- Questa colonna conterrà spiegazioni AI delle votazioni

ALTER TABLE voti_camera 
ADD COLUMN IF NOT EXISTS spiegazione TEXT;

-- Indice per migliorare le performance delle query che filtrano per spiegazione
CREATE INDEX IF NOT EXISTS idx_voti_camera_spiegazione ON voti_camera(spiegazione) WHERE spiegazione IS NOT NULL;

-- Commento per documentazione
COMMENT ON COLUMN voti_camera.spiegazione IS 'Spiegazione AI della votazione generata automaticamente';
