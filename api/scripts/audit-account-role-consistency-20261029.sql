-- F12-12B: read-only, aggregate-only account-model compatibility audit.
-- No user_id, email, names, individual political records or data mutations.
-- Run against a dedicated read-only connection. Counts are diagnostic, not
-- authorization to change status, ruolo, source, or political mandates.

SELECT
  COUNT(*)::integer AS total_users,
  COUNT(*) FILTER (
    WHERE (account_type = 'PERSON' AND ruolo IN ('O', 'I'))
       OR (account_type = 'ORGANIZATION' AND ruolo <> 'O')
       OR (account_type = 'INSTITUTION' AND ruolo <> 'I')
  )::integer AS account_type_legacy_role_mismatch,
  COUNT(*) FILTER (WHERE is_admin IS DISTINCT FROM (ruolo = 'AD'))::integer AS admin_role_mismatch,
  COUNT(*) FILTER (WHERE is_activist IS DISTINCT FROM (ruolo = 'A'))::integer AS activist_role_mismatch,
  COUNT(*) FILTER (WHERE status = 'a')::integer AS status_a,
  COUNT(*) FILTER (WHERE status = 'active')::integer AS status_active,
  COUNT(*) FILTER (WHERE ruolo IN ('P', 'CP'))::integer AS role_p_cp,
  COUNT(*) FILTER (
    WHERE ruolo IN ('P', 'CP') AND NOT EXISTS (
      SELECT 1 FROM public.political_mandates pm
      WHERE pm.user_id = u.id
        AND pm.status = 'ACTIVE'
        AND pm.source <> 'LEGACY_BACKFILL'
        AND pm.starts_at <= NOW()
        AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
    )
  )::integer AS role_p_cp_no_current_nonlegacy_mandate,
  COUNT(*) FILTER (
    WHERE ruolo NOT IN ('P', 'CP') AND EXISTS (
      SELECT 1 FROM public.political_mandates pm
      WHERE pm.user_id = u.id
        AND pm.status = 'ACTIVE'
        AND pm.source <> 'LEGACY_BACKFILL'
        AND pm.starts_at <= NOW()
        AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
    )
  )::integer AS non_p_cp_with_current_nonlegacy_mandate
FROM public.users u;

-- A status called 'active' is not accepted by the existing OAuth/passkey gate
-- (which checks exactly 'a'). Review these rows via an authorized workflow;
-- this diagnostic deliberately does not return identities or modify them.
SELECT status, COUNT(*)::integer AS accounts
FROM public.users
GROUP BY status
ORDER BY accounts DESC;

-- Provenance matters. LEGACY_BACKFILL/ACTIVE is NOT a verified political mandate.
SELECT source, status, COUNT(*)::integer AS records
FROM public.political_mandates
GROUP BY source, status
ORDER BY records DESC;
