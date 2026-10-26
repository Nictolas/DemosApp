-- DEMOS / FCM — historical invalid-token cleanup retired.
-- READ-ONLY aggregated diagnostics, with no account identifiers or token
-- strings in query results. Legacy arrays MUST NOT be cleared manually:
-- canonical tombstones can override old copies and owners can change.
-- Execute only on an explicitly authorized test/staging environment.
-- For changes, use the locked FCM API / shared invalidation service.
BEGIN READ ONLY;
SELECT COUNT(*)::bigint AS device_records,
       COUNT(*) FILTER (WHERE is_active IS TRUE)::bigint AS active_records,
       COUNT(*) FILTER (WHERE is_active IS FALSE)::bigint AS inactive_records
FROM public.user_devices;
SELECT COUNT(*)::bigint AS normalized_tokens_with_multiple_canonical_rows
FROM (
  SELECT btrim(fcm_token) AS token_key
  FROM public.user_devices
  GROUP BY btrim(fcm_token)
  HAVING COUNT(*) > 1
) duplicate_normalized;
ROLLBACK;
