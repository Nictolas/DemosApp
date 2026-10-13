-- DEMOS — notifiche ai sostenitori per cambi di Opinione di Politici/Candidati.
-- Registra soltanto modifiche successive a una posizione già espressa.

BEGIN;

CREATE TABLE IF NOT EXISTS political_opinion_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opinion_id TEXT NOT NULL,
  opinion_text TEXT NOT NULL,
  previous_value TEXT NOT NULL CHECK (previous_value IN ('f', 'c', 'i')),
  new_value TEXT NOT NULL CHECK (new_value IN ('f', 'c', 'i')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (previous_value <> new_value)
);

CREATE INDEX IF NOT EXISTS idx_political_opinion_notifications_recipient_created
  ON political_opinion_notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_political_opinion_notifications_subject_created
  ON political_opinion_notifications(subject_user_id, created_at DESC);

COMMIT;
