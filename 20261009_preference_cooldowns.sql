-- DEMOS — cooldown canonico delle preferenze correnti.
-- Conserva un solo timestamp per utente + singola preferenza/scope.
-- Nessuna cronologia delle scelte viene mantenuta in questa tabella.

BEGIN;

CREATE TABLE IF NOT EXISTS preference_change_cooldowns (
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_preference_change_cooldowns_last_changed
  ON preference_change_cooldowns(last_changed_at);

COMMENT ON TABLE preference_change_cooldowns IS
  'Timestamp minimo necessario per applicare il cooldown di 24 ore alle singole preferenze correnti DEMOS.';

COMMIT;
