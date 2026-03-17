-- Un solo account passkey per dispositivo: identifica il dispositivo con un ID (client lo invia)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS webauthn_device_id TEXT;

-- Un device_id può essere associato a un solo utente
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_webauthn_device_id
ON users (webauthn_device_id) WHERE webauthn_device_id IS NOT NULL;
