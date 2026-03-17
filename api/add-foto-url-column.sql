-- Aggiungi colonna foto_url alla tabella voti_camera
ALTER TABLE voti_camera 
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Aggiungi indice per migliorare le query
CREATE INDEX IF NOT EXISTS idx_voti_camera_foto_url 
ON voti_camera(foto_url) 
WHERE foto_url IS NOT NULL;

-- Commento per documentazione
COMMENT ON COLUMN voti_camera.foto_url IS 'URL della foto del politico da Openpolis (es: https://opdm-service-data.s3.amazonaws.com/images/persons/822378.jpeg)';
