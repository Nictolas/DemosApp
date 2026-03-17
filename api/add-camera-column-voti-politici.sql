-- Script per aggiungere supporto Camera e Senato alla tabella voti_politici
-- Aggiunge la colonna 'camera' per distinguere tra votazioni Camera e Senato

-- Step 1: Aggiungi colonna camera con constraint
ALTER TABLE voti_politici 
ADD COLUMN IF NOT EXISTS camera VARCHAR(50);

-- Step 2: Aggiungi constraint CHECK (dopo aver aggiunto la colonna)
DO $$
BEGIN
  -- Rimuovi constraint esistente se presente
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'voti_politici_camera_check'
  ) THEN
    ALTER TABLE voti_politici DROP CONSTRAINT voti_politici_camera_check;
  END IF;
  
  -- Aggiungi nuovo constraint
  ALTER TABLE voti_politici 
  ADD CONSTRAINT voti_politici_camera_check 
  CHECK (camera IN ('Camera', 'Senato'));
END $$;

-- Step 3: Aggiorna i record esistenti (tutti sono della Camera)
UPDATE voti_politici 
SET camera = 'Camera' 
WHERE camera IS NULL;

-- Step 4: Rendi la colonna NOT NULL dopo aver popolato i valori
ALTER TABLE voti_politici 
ALTER COLUMN camera SET NOT NULL;

-- Step 5: Aggiungi indice per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_voti_politici_camera 
ON voti_politici(camera);

-- Step 6: Aggiorna il commento della tabella
COMMENT ON TABLE voti_politici IS 'Votazioni parlamentari (Camera e Senato) recuperate dagli endpoint SPARQL';
COMMENT ON COLUMN voti_politici.camera IS 'Camera o Senato: indica da quale assemblea proviene la votazione';

-- Verifica: Conta i record per camera
SELECT 
  camera, 
  COUNT(*) as totale_votazioni,
  MIN(data_votazione) as prima_votazione,
  MAX(data_votazione) as ultima_votazione
FROM voti_politici
GROUP BY camera;
