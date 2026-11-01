-- DEMOS: opt-in per le nuove raccolte firme ufficiali (Italia e UE).
-- DRAFT: eseguire manualmente, dopo verifica dello schema e backup.
-- Nessun invio push viene eseguito da questa migrazione.
BEGIN;

ALTER TABLE notifiche_preferenze
  ADD COLUMN IF NOT EXISTS iniziative_popolari BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referendum_abrogativi BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eci BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS civic_new_initiative_notifications (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (
    category IN ('iniziative_popolari', 'referendum_abrogativi', 'eci')
  ),
  official_id TEXT NOT NULL CHECK (length(btrim(official_id)) > 0),
  title TEXT NOT NULL,
  target_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'suppressed', 'dispatching', 'sent', 'failed')
  ),
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  last_error_code TEXT,
  UNIQUE (category, official_id)
);

CREATE INDEX IF NOT EXISTS idx_civic_new_initiative_notifications_pending
  ON civic_new_initiative_notifications (discovered_at, id)
  WHERE status = 'pending';

-- Baseline: gli elementi già presenti non devono provocare notifiche retroattive.
-- La categoria deriva dal tipo ufficiale; nessun titolo è usato come identificativo.
INSERT INTO civic_new_initiative_notifications
  (category, official_id, title, target_path, status)
SELECT
  CASE WHEN lower(m.tipo) LIKE '%referendum%'
    THEN 'referendum_abrogativi'
    ELSE 'iniziative_popolari' END,
  btrim(m.id_ministero::text),
  m.titolo,
  CASE WHEN lower(m.tipo) LIKE '%referendum%'
    THEN '/referendum-abrogativi'
    ELSE '/iniziative-popolari' END,
  'suppressed'
FROM iniziative_ministero AS m
WHERE m.id_ministero IS NOT NULL
  AND btrim(m.id_ministero::text) <> ''
  AND m.titolo IS NOT NULL
  AND (lower(m.tipo) LIKE '%referendum%'
    OR lower(m.tipo) LIKE '%iniziativa%')
ON CONFLICT (category, official_id) DO NOTHING;

INSERT INTO civic_new_initiative_notifications
  (category, official_id, title, target_path, status)
SELECT 'eci', btrim(e.id::text), e.title, '/eci', 'suppressed'
FROM eci AS e
WHERE e.id IS NOT NULL
  AND btrim(e.id::text) <> ''
  AND e.title IS NOT NULL
ON CONFLICT (category, official_id) DO NOTHING;

COMMIT;
