-- Tabella per collegare utenti ai provider OAuth (Google, Apple)
-- Un utente può avere più metodi di accesso (passkey + Google, ecc.)
-- GDPR: cancellare da user_providers in caso di cancellazione account

CREATE TABLE IF NOT EXISTS user_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  provider_user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_provider_provider_user_id UNIQUE (provider, provider_user_id),
  CONSTRAINT chk_provider CHECK (provider IN ('google', 'apple'))
);

CREATE INDEX IF NOT EXISTS idx_user_providers_user_id ON user_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_providers_lookup ON user_providers(provider, provider_user_id);

COMMENT ON TABLE user_providers IS 'Collegamento utenti Demos con account OAuth (Google, Apple) per login/registrazione';
