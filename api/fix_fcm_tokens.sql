-- DEMOS / FCM — archived manual duplicate-token maintenance.
-- READ-ONLY aggregated diagnostics; no device token, account identifier,
-- email or other personal data may be retrieved by this file.
-- Do not interpret the last legacy-array element as the newest device.
-- Canonical user_devices is authoritative even for inactive registrations.
-- Execute only on an explicitly authorized test/staging environment.
-- Registration / revocation must use the account-locked application path.
BEGIN READ ONLY;
SELECT COUNT(*)::bigint AS canonical_device_records,
       COUNT(*) FILTER (WHERE is_active IS TRUE)::bigint AS active_device_records,
       COUNT(*) FILTER (WHERE is_active IS FALSE)::bigint AS inactive_device_records
FROM public.user_devices;
SELECT COUNT(*)::bigint AS accounts_with_multiple_active_devices
FROM (
  SELECT user_id
  FROM public.user_devices
  WHERE is_active IS TRUE
  GROUP BY user_id
  HAVING COUNT(*) > 1
) multiple_active;
ROLLBACK;
