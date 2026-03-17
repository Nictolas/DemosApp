-- Aggiunta "Esercito Comune Europeo" in opinioni_domande e colonna in opinioni_risposte
-- Esegui questo script se la barra statistiche non appare per questa opinione

-- Inserimento in opinioni_domande (id usato dal frontend)
INSERT INTO opinioni_domande (id, text, gradi_opinione, approfondimento)
VALUES 
  ('esercito_comune_europeo', 'Esercito Comune Europeo', ARRAY['N'], '## Proposta Nazionale

Esercito Comune Europeo')
ON CONFLICT (id) DO UPDATE SET
  text = EXCLUDED.text,
  gradi_opinione = EXCLUDED.gradi_opinione,
  approfondimento = EXCLUDED.approfondimento;

-- Colonna in opinioni_risposte (deve avere lo stesso nome dell'id)
ALTER TABLE opinioni_risposte 
  ADD COLUMN IF NOT EXISTS "esercito_comune_europeo" TEXT;

-- Colonna con id effettivo usato in opinioni_domande
ALTER TABLE opinioni_risposte 
  ADD COLUMN IF NOT EXISTS "esercito_europeo" TEXT;

-- Varianti id/colonna per compatibilità
ALTER TABLE opinioni_risposte 
  ADD COLUMN IF NOT EXISTS "esercito_comune_ue" TEXT,
  ADD COLUMN IF NOT EXISTS "esercito_ue" TEXT;
