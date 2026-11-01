-- Read-only smoke for private Supabase Demos-Staging fixture f12_poe_ci.
-- No user IDs, names or emails are returned; never query production here.
WITH subject AS (
 SELECT u.account_type, u.ruolo, u.status, u.is_admin,u.is_dpo,u.is_activist,
 EXISTS(SELECT 1 FROM f12_poe_ci.political_mandates m
   WHERE m.user_id=u.id AND m.status='ACTIVE'
     AND m.source<>'LEGACY_BACKFILL' AND m.starts_at<=NOW()
     AND (m.ends_at IS NULL OR m.ends_at>NOW())) AS canonical_politician,
 EXISTS(SELECT 1 FROM f12_poe_ci.political_candidacies c
   WHERE c.user_id=u.id AND c.status='ACTIVE'
     AND c.starts_at<=NOW() AND (c.ends_at IS NULL OR c.ends_at>NOW())) AS canonical_candidate
 FROM f12_poe_ci.users u
)
SELECT
 COUNT(*)::integer AS users,
 (COUNT(*)=7) AS correct_count,
 (COUNT(*) FILTER(WHERE account_type='P')=5
  AND COUNT(*) FILTER(WHERE account_type='O')=1
  AND COUNT(*) FILTER(WHERE account_type='E')=1) AS correct_types,
 (COUNT(*) FILTER(WHERE status='a')=7) AS statuses_active,
 (COUNT(*) FILTER(WHERE account_type='E' AND ruolo='I')=1
  AND COUNT(*) FILTER(WHERE account_type='P' AND ruolo='E')=1) AS account_role_domains_distinct,
 (COUNT(*) FILTER(WHERE ruolo IN ('P','CP') AND canonical_politician=false)=2) AS legacy_politicians_not_verified,
 (COUNT(*) FILTER(WHERE ruolo='CP' AND canonical_candidate=true)=1) AS separate_candidacy,
 (COUNT(*) FILTER(WHERE is_admin AND ruolo='AD')=1) AS admin_unchanged,
 (COUNT(*) FILTER(WHERE is_activist AND ruolo='A')=1) AS activist_unchanged
FROM subject;

-- Data API roles are not allowed to use this dedicated schema.
SELECT
 NOT has_schema_privilege('anon','f12_poe_ci','USAGE') AS anon_blocked,
 NOT has_schema_privilege('authenticated','f12_poe_ci','USAGE') AS authenticated_blocked,
 NOT has_schema_privilege('service_role','f12_poe_ci','USAGE') AS service_role_blocked;

-- Keep the default fail-closed status separate from the E Elettore role.
SELECT
 (SELECT column_default LIKE '%''P''%'
    FROM information_schema.columns WHERE table_schema='f12_poe_ci'
      AND table_name='users' AND column_name='account_type') AS type_default_p,
 (SELECT column_default LIKE '%''E''%'
    FROM information_schema.columns WHERE table_schema='f12_poe_ci'
      AND table_name='users' AND column_name='ruolo') AS legacy_role_default_e,
 (SELECT column_default LIKE '%''pending''%'
    FROM information_schema.columns WHERE table_schema='f12_poe_ci'
      AND table_name='users' AND column_name='status') AS status_fail_closed;
