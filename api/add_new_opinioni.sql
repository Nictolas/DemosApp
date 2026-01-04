-- Aggiunta nuove opinioni in opinioni_domande e colonne corrispondenti in opinioni_risposte

-- Inserimento nuove righe in opinioni_domande
INSERT INTO opinioni_domande (id, text, gradi_opinione, approfondimento)
VALUES 
  ('potenziare_rinnovabili', 'Potenziare Rinnovabili', ARRAY['N'], '## Proposta Nazionale

Potenziare Rinnovabili'),
  
  ('multe_in_base_al_reddito', 'Multe in base al Reddito', ARRAY['N'], '## Proposta Nazionale

Multe in base al Reddito'),
  
  ('test_antidroga_per_politici', 'Test Antidroga per Politici', ARRAY['N'], '## Proposta Nazionale

Test Antidroga per Politici'),
  
  ('test_psichiatrico_per_politici', 'Test Psichiatrico per Politici', ARRAY['N'], '## Proposta Nazionale

Test Psichiatrico per Politici'),
  
  ('fuochi_d_artificio', 'Fuochi d''Artificio', ARRAY['CO'], '## Proposta Comunale

Fuochi d''Artificio'),
  
  ('rilascio_di_palloncini', 'Rilascio di Palloncini', ARRAY['CO'], '## Proposta Comunale

Rilascio di Palloncini'),
  
  ('sionismo', 'Sionismo', ARRAY['N'], '## Proposta Nazionale

Sionismo'),
  
  ('antifascismo', 'Antifascismo', ARRAY['N'], '## Proposta Nazionale

Antifascismo'),
  
  ('abolizione_contante', 'Abolizione Contante', ARRAY['N'], '## Proposta Nazionale

Abolizione Contante'),
  
  ('metabo_law', 'Metabo Law', ARRAY['N'], '## Proposta Nazionale

Metabo Law')
ON CONFLICT (id) DO UPDATE SET
  text = EXCLUDED.text,
  gradi_opinione = EXCLUDED.gradi_opinione,
  approfondimento = EXCLUDED.approfondimento;

-- Aggiunta colonne corrispondenti in opinioni_risposte
ALTER TABLE opinioni_risposte 
  ADD COLUMN IF NOT EXISTS "potenziare_rinnovabili" TEXT,
  ADD COLUMN IF NOT EXISTS "multe_in_base_al_reddito" TEXT,
  ADD COLUMN IF NOT EXISTS "test_antidroga_per_politici" TEXT,
  ADD COLUMN IF NOT EXISTS "test_psichiatrico_per_politici" TEXT,
  ADD COLUMN IF NOT EXISTS "fuochi_d_artificio" TEXT,
  ADD COLUMN IF NOT EXISTS "rilascio_di_palloncini" TEXT,
  ADD COLUMN IF NOT EXISTS "sionismo" TEXT,
  ADD COLUMN IF NOT EXISTS "antifascismo" TEXT,
  ADD COLUMN IF NOT EXISTS "abolizione_contante" TEXT,
  ADD COLUMN IF NOT EXISTS "metabo_law" TEXT;

