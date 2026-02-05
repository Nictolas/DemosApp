-- Variante se in opinioni_domande la colonna si chiama gradi_opinione (senza "i").
-- Stessi passi di create-opinioni-proposte-and-migrate.sql con gradi_opinione.

CREATE TABLE IF NOT EXISTS opinioni_proposte (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  approfondimento TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- opinioni_domande può non avere created_at/updated_at: usiamo solo id, text, approfondimento
INSERT INTO opinioni_proposte (id, text, approfondimento, created_at, updated_at)
SELECT o.id, o.text, o.approfondimento, NOW(), NOW()
FROM opinioni_domande o
WHERE o.gradi_opinione::text LIKE '%da approvare%'
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, approfondimento = EXCLUDED.approfondimento, updated_at = NOW();

DELETE FROM opinioni_domande
WHERE gradi_opinione::text LIKE '%da approvare%';
