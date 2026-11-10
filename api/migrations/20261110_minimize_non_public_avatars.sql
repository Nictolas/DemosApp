-- One-time privacy minimization after deploying avatar authorization checks.
-- Run on staging first and take a database backup before applying to production.
-- This affects only the avatar_config columns; it does not delete user profiles.
-- Legacy political role codes are preserved as a conservative compatibility guard.
BEGIN;

CREATE TEMP TABLE avatar_cleanup_ineligible_users ON COMMIT DROP AS
SELECT u.id
FROM users u
WHERE (
  COALESCE((to_jsonb(u)->>'is_dpo')::boolean, FALSE) = TRUE
  OR (
    COALESCE(u.is_admin, FALSE) = FALSE
    AND COALESCE(u.ruolo, 'E') NOT IN
      ('AD', 'Admin', 'P', 'Politico', 'C', 'Candidato', 'CP', 'Candidato Politico')
  AND NOT EXISTS (
    SELECT 1 FROM political_mandates pm
    WHERE pm.user_id = u.id
      AND pm.status = 'ACTIVE'
      AND pm.starts_at <= NOW()
      AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
  )
  AND NOT EXISTS (
    SELECT 1 FROM political_candidacies pc
    WHERE pc.user_id = u.id
      AND pc.status = 'ACTIVE'
      AND pc.starts_at <= NOW()
      AND (pc.ends_at IS NULL OR pc.ends_at > NOW())
    )
  )
);

-- Keep the two duplicated legacy avatar columns consistent.
UPDATE user_profile up
SET avatar_config = NULL
FROM avatar_cleanup_ineligible_users i
WHERE up.user_id = i.id
  AND up.avatar_config IS NOT NULL;

-- Some staging schemas do not have users.avatar_config.
DO $cleanup$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='avatar_config'
  ) THEN
    EXECUTE '
      UPDATE public.users u
      SET avatar_config = NULL
      FROM avatar_cleanup_ineligible_users i
      WHERE u.id = i.id AND u.avatar_config IS NOT NULL
    ';
  END IF;
END
$cleanup$;

COMMIT;
