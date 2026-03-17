-- Aggiunge la colonna "descrizione_votazione" alla tabella voti_camera
-- Questa colonna conterrà la descrizione completa della votazione scrapata da Openpolis

ALTER TABLE voti_camera 
ADD COLUMN IF NOT EXISTS descrizione_votazione TEXT;

-- Indice per migliorare le performance delle query che filtrano per descrizione
CREATE INDEX IF NOT EXISTS idx_voti_camera_descrizione_votazione ON voti_camera(descrizione_votazione) WHERE descrizione_votazione IS NOT NULL;

-- Commento per documentazione
COMMENT ON COLUMN voti_camera.descrizione_votazione IS 'Descrizione completa della votazione scrapata da Openpolis per generare spiegazioni AI più accurate';
