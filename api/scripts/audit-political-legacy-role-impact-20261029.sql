-- DEMOS POL-014 / POL-015 — READ ONLY aggregate release-impact report.
-- Execute only with authorized DB read-only access. No IDs, names or email output.
-- Not a role-fix migration; do not use it to bulk-update users.ruolo.
WITH role_model AS (
  SELECT
    u.id, u.ruolo, u.account_type, u.is_admin, u.is_activist,
    EXISTS (
      SELECT 1 FROM public.political_mandates pm
      WHERE pm.user_id = u.id AND pm.status = 'ACTIVE'
        AND pm.starts_at <= now() AND (pm.ends_at IS NULL OR pm.ends_at > now())
    ) AS any_active_mandate,
    EXISTS (
      SELECT 1 FROM public.political_mandates pm
      WHERE pm.user_id = u.id AND pm.status = 'ACTIVE'
        AND pm.source <> 'LEGACY_BACKFILL'
        AND pm.starts_at <= now() AND (pm.ends_at IS NULL OR pm.ends_at > now())
    ) AS evidenced_active_mandate,
    EXISTS (
      SELECT 1 FROM public.political_candidacies pc
      WHERE pc.user_id = u.id AND pc.status = 'ACTIVE'
        AND pc.starts_at <= now() AND (pc.ends_at IS NULL OR pc.ends_at > now())
    ) AS active_candidacy
  FROM public.users u
)
SELECT
  COUNT(*)::int AS users_total,
  COUNT(*) FILTER (WHERE ruolo IN ('P','CP'))::int AS legacy_p_cp_total,
  COUNT(*) FILTER (
    WHERE ruolo IN ('P','CP') AND any_active_mandate
      AND NOT evidenced_active_mandate
  )::int AS p_cp_role_depends_only_on_backfill,
  COUNT(*) FILTER (WHERE evidenced_active_mandate)::int AS users_with_evidenced_active_mandate,
  COUNT(*) FILTER (WHERE ruolo IN ('P','CP') AND NOT evidenced_active_mandate)::int
    AS p_cp_requiring_source_review,
  COUNT(*) FILTER (WHERE active_candidacy)::int AS active_candidates,
  (SELECT COUNT(*)::int FROM public.political_mandates
   WHERE source='LEGACY_BACKFILL' AND status='ACTIVE') AS legacy_active_rows
FROM role_model;
