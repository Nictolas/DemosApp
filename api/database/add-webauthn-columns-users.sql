ALTER TABLE users
ADD COLUMN IF NOT EXISTS webauthn_user_handle TEXT,
ADD COLUMN IF NOT EXISTS webauthn_credential_id TEXT,
ADD COLUMN IF NOT EXISTS webauthn_public_key TEXT,
ADD COLUMN IF NOT EXISTS webauthn_sign_count INTEGER;

