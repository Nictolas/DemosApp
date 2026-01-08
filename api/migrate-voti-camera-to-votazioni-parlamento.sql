-- Script di migrazione: aggiunge votazione_id a voti_camera e migra i dati a votazioni_parlamento
-- IMPORTANTE: Esegui questo script DOPO aver creato la tabella votazioni_parlamento

-- Step 1: Aggiungi colonna votazione_id a voti_camera
ALTER TABLE voti_camera 
ADD COLUMN IF NOT EXISTS votazione_id INTEGER REFERENCES votazioni_parlamento(id) ON DELETE SET NULL;

-- Step 2: Crea votazioni_parlamento dai dati esistenti in voti_camera
-- Usa DISTINCT per evitare duplicati (stessa votazione votata da più politici)
INSERT INTO votazioni_parlamento (titolo_votazione, descrizione_votazione, camera, data_votazione, spiegazione, votazione_hash)
SELECT DISTINCT ON (votazione, camera, data_votazione)
  votazione as titolo_votazione,
  descrizione_votazione,
  camera,
  data_votazione,
  spiegazione,
  -- Genera hash univoco: titolo + camera + data (o solo titolo + camera se data è NULL)
  MD5(
    COALESCE(votazione, '') || '|' || 
    COALESCE(camera, '') || '|' || 
    COALESCE(data_votazione::text, '')
  ) as votazione_hash
FROM voti_camera
WHERE votazione IS NOT NULL 
  AND votazione != ''
ON CONFLICT (votazione_hash) DO NOTHING;

-- Step 3: Aggiorna voti_camera con i votazione_id corrispondenti
UPDATE voti_camera vc
SET votazione_id = vp.id
FROM votazioni_parlamento vp
WHERE vc.votazione = vp.titolo_votazione
  AND COALESCE(vc.camera, 'Camera') = vp.camera
  AND (
    (vc.data_votazione IS NULL AND vp.data_votazione IS NULL) OR
    (vc.data_votazione = vp.data_votazione)
  )
  AND vc.votazione_id IS NULL;

-- Step 4: Crea indice per migliorare le join
CREATE INDEX IF NOT EXISTS idx_voti_camera_votazione_id ON voti_camera(votazione_id);

-- Step 5: Commenti per documentazione
COMMENT ON COLUMN voti_camera.votazione_id IS 'Riferimento alla votazione in votazioni_parlamento (FK)';
