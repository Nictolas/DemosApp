BEGIN;

CREATE TABLE IF NOT EXISTS user_profile (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  genere TEXT,
  data_nascita DATE,
  cittadinanza TEXT,
  paese_residenza TEXT,
  regione_residenza TEXT,
  provincia_residenza TEXT,
  comune_residenza TEXT,
  grado_elezione TEXT,
  paese_elezione TEXT,
  regione_elezione TEXT,
  provincia_elezione TEXT,
  comune_elezione TEXT,
  grado_candidatura TEXT,
  paese_candidatura TEXT,
  regione_candidatura TEXT,
  provincia_candidatura TEXT,
  comune_candidatura TEXT,
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,
  telegram_url TEXT,
  website_url TEXT,
  twitch_url TEXT,
  youtube_url TEXT,
  avatar_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_consents (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  privacy_policy_consent BOOLEAN NOT NULL DEFAULT FALSE,
  terms_of_service_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  political_opinions_consent BOOLEAN NOT NULL DEFAULT FALSE,
  political_opinions_consent_timestamp TIMESTAMPTZ,
  political_opinions_consent_ip_address TEXT,
  political_opinions_consent_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profile IS
  'Normalized user profile fields. Legacy users columns remain readable during the compatibility migration window.';

COMMENT ON TABLE user_consents IS
  'Normalized registration and political-opinion consent state. Legacy users columns remain readable during the compatibility migration window.';

COMMIT;
