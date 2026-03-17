-- Aggiunta di "Ponte sullo Stretto" in opinioni_domande e colonna corrispondente in opinioni_risposte

-- Inserimento nuova riga in opinioni_domande
INSERT INTO opinioni_domande (id, text, gradi_opinione, approfondimento)
VALUES 
  ('ponte_sullo_stretto', 'Ponte sullo Stretto', ARRAY['N'], '## Proposta Nazionale

Ponte sullo Stretto')
ON CONFLICT (id) DO UPDATE SET
  text = EXCLUDED.text,
  gradi_opinione = EXCLUDED.gradi_opinione,
  approfondimento = EXCLUDED.approfondimento;

-- Aggiunta colonna corrispondente in opinioni_risposte
ALTER TABLE opinioni_risposte 
  ADD COLUMN IF NOT EXISTS "ponte_sullo_stretto" TEXT;




