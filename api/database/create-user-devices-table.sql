-- Canonical mobile push-device storage.
-- user_devices is authoritative for active FCM tokens; users.fcm_tokens is legacy-only when present.

CREATE TABLE IF NOT EXISTS user_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_active
  ON user_devices(user_id, is_active);

COMMENT ON TABLE user_devices IS 'Canonical device-level FCM token registry for mobile push notifications';
COMMENT ON COLUMN user_devices.fcm_token IS 'Firebase Cloud Messaging registration token; unique across devices';
COMMENT ON COLUMN user_devices.is_active IS 'Whether this token is eligible for push delivery';
COMMENT ON COLUMN user_devices.last_seen_at IS 'Most recent token registration/refresh observed by DEMOS';
