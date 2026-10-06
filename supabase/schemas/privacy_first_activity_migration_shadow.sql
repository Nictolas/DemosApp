-- SHADOW ONLY. Do not apply without explicit migration approval.
-- Phase 1: backfill durable lifecycle activity from the best legacy evidence.
INSERT INTO identity.account_activity (account_id,last_activity_at,updated_at)
SELECT u.id, COALESCE(MAX(s.last_activity),u.created_at), NOW()
FROM public.users u
LEFT JOIN active_sessions s ON s.user_id::text=u.id::text
GROUP BY u.id,u.created_at
ON CONFLICT (account_id) DO UPDATE
SET last_activity_at=GREATEST(identity.account_activity.last_activity_at,EXCLUDED.last_activity_at),
    updated_at=NOW();

-- Validation before cutover: must return zero rows.
SELECT u.id
FROM public.users u
LEFT JOIN identity.account_activity a ON a.account_id=u.id
WHERE a.account_id IS NULL;

-- Validation: durable source must never lag known session activity. Must return zero rows.
SELECT a.account_id
FROM identity.account_activity a
JOIN active_sessions s ON s.user_id::text=a.account_id::text
GROUP BY a.account_id,a.last_activity_at
HAVING a.last_activity_at < MAX(s.last_activity);

-- Rollback is application-only: keep reading active_sessions. Do not delete account_activity during rollback.
