-- =============================================================================
-- Crea la tabella opinioni_proposte e sposta qui le proposte "da approvare"
-- che oggi sono in opinioni_domande (colonna gradi_opinioni come in Neon).
-- Eseguire in Neon SQL Editor.
--
-- Se in opinioni_domande la colonna si chiama gradi_opinione (senza "i"),
-- sostituisci gradi_opinioni con gradi_opinione nelle tre query sotto.
-- =============================================================================

-- 1) Crea la tabella opinioni_proposte
CREATE TABLE IF NOT EXISTS opinioni_proposte (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  approfondimento TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE opinioni_proposte IS 'Proposte di opinione in attesa di approvazione (migrate da opinioni_domande dove gradi_opinioni conteneva "da approvare")';

-- 2) Copia in opinioni_proposte le righe con "da approvare" (stesso id per collegare i voti in voti_opinioni_proposte)
-- opinioni_domande può non avere created_at/updated_at: usiamo solo id, text, approfondimento
INSERT INTO opinioni_proposte (id, text, approfondimento, created_at, updated_at)
SELECT 
  o.id,
  o.text,
  o.approfondimento,
  NOW(),
  NOW()
FROM opinioni_domande o
WHERE o.gradi_opinioni::text LIKE '%da approvare%'
ON CONFLICT (id) DO UPDATE SET
  text = EXCLUDED.text,
  approfondimento = EXCLUDED.approfondimento,
  updated_at = NOW();

-- 3) Rimuovi da opinioni_domande le righe migrate (spostamento completo)
DELETE FROM opinioni_domande
WHERE gradi_opinioni::text LIKE '%da approvare%';

-- 4) Verifica (decommenta per controllare)
-- SELECT COUNT(*) AS proposte_in_nuova_tabella FROM opinioni_proposte;
-- SELECT * FROM opinioni_proposte ORDER BY text LIMIT 20;
