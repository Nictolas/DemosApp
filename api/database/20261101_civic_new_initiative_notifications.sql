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

-- Nessun client web deve poter leggere la coda o forzare un evento push.
-- L'API usa il collegamento DB server-side e conserva gli stessi principi RLS
-- già attivi sulle tabelle notifiche_preferenze e user_devices in produzione.
ALTER TABLE civic_new_initiative_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE civic_new_initiative_notifications FROM PUBLIC;
REVOKE ALL ON SEQUENCE civic_new_initiative_notifications_id_seq FROM PUBLIC;

-- Barriera di sicurezza globale: nessun invio è consentito fino a un
-- sblocco manuale esplicito dopo baseline, iscrizioni e test.
-- Se la revoca dei topic non riesce durante la cancellazione di un account,
-- il sistema rimane bloccato senza conservare il vecchio token dell'utente.
CREATE TABLE IF NOT EXISTS civic_push_delivery_guard (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  blocked BOOLEAN NOT NULL DEFAULT TRUE,
  reason_code TEXT NOT NULL DEFAULT 'ROLLOUT_NOT_APPROVED',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO civic_push_delivery_guard (id, blocked, reason_code)
VALUES (1, TRUE, 'ROLLOUT_NOT_APPROVED')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE civic_push_delivery_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON civic_push_delivery_guard FROM PUBLIC;

-- Identità casuale creata UNA SOLA VOLTA nel database effettivo.
-- GitHub Actions ECI e backend devono verificarne la stessa UUID prima
-- di raccogliere o inviare notifiche. Un database differente crea una UUID
-- distinta; NON esporre il valore nei log o nell'API pubblica.
CREATE TABLE IF NOT EXISTS civic_runtime_identity (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  db_identity UUID NOT NULL DEFAULT gen_random_uuid()
);
INSERT INTO civic_runtime_identity (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE civic_runtime_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE civic_runtime_identity FROM PUBLIC;

-- Baseline: gli elementi già presenti non devono provocare notifiche retroattive.
-- La categoria deriva dal tipo ufficiale; nessun titolo è usato come identificativo.
INSERT INTO civic_new_initiative_notifications
  (category, official_id, title, target_path, status)
SELECT
  CASE WHEN lower(regexp_replace(btrim(m.tipo), '[[:space:]]+', ' ', 'g')) = 'referendum abrogativo'
    THEN 'referendum_abrogativi'
    ELSE 'iniziative_popolari' END,
  btrim(m.id_ministero::text),
  m.titolo,
  CASE WHEN lower(regexp_replace(btrim(m.tipo), '[[:space:]]+', ' ', 'g')) = 'referendum abrogativo'
    THEN '/referendum-abrogativi'
    ELSE '/iniziative-popolari' END,
  'suppressed'
FROM iniziative_ministero AS m
WHERE m.id_ministero IS NOT NULL
  AND btrim(m.id_ministero::text) <> ''
  AND m.titolo IS NOT NULL
  AND lower(regexp_replace(btrim(m.tipo), '[[:space:]]+', ' ', 'g')) IN (
    'referendum abrogativo',
    'legge di iniziativa popolare',
    'iniziativa popolare'
  )
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
