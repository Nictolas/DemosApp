-- Aggiunge a users le colonne per login OAuth (Google, Apple)
-- Nessuna tabella user_providers: tutto in users.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_sub TEXT,
  ADD COLUMN IF NOT EXISTS apple_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_user_id ON users(apple_user_id) WHERE apple_user_id IS NOT NULL;

COMMENT ON COLUMN users.google_sub IS 'ID univoco utente Google (claim sub del token)';
COMMENT ON COLUMN users.apple_user_id IS 'ID univoco utente Apple (claim sub del token)';
