-- Identificatore UX dell'installazione/browser (client lo invia da localStorage).
-- Non identifica in modo sicuro un dispositivo fisico e non è una misura anti-multiaccount.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS webauthn_device_id TEXT;

-- Mantiene coerenza: lo stesso identificatore browser non viene associato a più utenti.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_webauthn_device_id
ON users (webauthn_device_id) WHERE webauthn_device_id IS NOT NULL;
