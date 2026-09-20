-- DEMOS - Identita verificata / CIE
-- Non memorizza codice fiscale in chiaro.
-- person_key e' una pseudonimizzazione HMAC derivata dal fiscal_number.

CREATE TABLE IF NOT EXISTS identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- L'account puo' essere scollegato/cancellato senza perdere subito la chiave anti-duplicazione.
  -- La retention della riga dopo la cancellazione account va definita nella DPIA prima del lancio.
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,

  person_key VARCHAR(64) NOT NULL UNIQUE
    CHECK (length(person_key) = 64 AND person_key ~ '^[a-f0-9]{64}$'),

  provider VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'verified'
    CHECK (status IN ('verified', 'revoked')),

  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detached_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_user_id
  ON identity_verifications(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_identity_verifications_provider_status
  ON identity_verifications(provider, status);

COMMENT ON TABLE identity_verifications IS
  'Verifiche di identita DEMOS. Non contiene codice fiscale in chiaro; person_key e pseudonima e univoca.';

COMMENT ON COLUMN identity_verifications.person_key IS
  'HMAC-SHA256 versionato derivato dal fiscal_number; non esporre al frontend e non registrare nei log.';

COMMENT ON COLUMN identity_verifications.retention_until IS
  'Da valorizzare secondo la retention approvata nella DPIA quando un account viene scollegato/cancellato.';
