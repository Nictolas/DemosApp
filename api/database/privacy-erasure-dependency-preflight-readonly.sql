-- DEMOS GDPR erasure dependency preflight (PostgreSQL 17).
-- READ ONLY. No personal IDs, tokens, text payloads or record contents returned.
-- Snapshot counts change over time. Never use this to authorize deletion.
WITH account_fks AS (
 SELECT c.conrelid::regclass::text AS child_table,c.confdeltype AS delete_action
 FROM pg_constraint c
 WHERE c.contype='f' AND c.confrelid='public.users'::regclass
), fk_summary AS (
 SELECT count(*) AS total,
        count(*) FILTER(WHERE delete_action='c') AS cascade,
        count(*) FILTER(WHERE delete_action='n') AS set_null,
        count(*) FILTER(WHERE delete_action IN('a','r')) AS restrictive,
        count(DISTINCT child_table) AS tables_covered,
        string_agg(DISTINCT child_table, ', ' ORDER BY child_table)
          FILTER(WHERE delete_action IN('a','r')) AS restrict_table_names
 FROM account_fks
)
SELECT fk_summary.*,
 (SELECT count(*) FROM public.candidati WHERE user_id IS NOT NULL) AS candidate_links,
 (SELECT count(*) FROM public.active_sessions a WHERE a.user_id IS NOT NULL) AS session_rows,
 (SELECT count(*) FROM public.active_sessions a WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text=a.user_id)) AS orphan_sessions,
 (SELECT count(*) FROM public.active_sessions a WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text=a.user_id) AND a.is_active AND (a.expires_at IS NULL OR a.expires_at>now())) AS potentially_valid_orphan_sessions,
 (SELECT count(*) FROM public.political_programs WHERE user_id IS NOT NULL) AS political_programs_with_user,
 (SELECT count(*) FROM public.user_rights_requests WHERE user_id IS NOT NULL) AS rights_requests,
 (SELECT count(*) FROM public.user_rights_requests a WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text=a.user_id)) AS rights_requests_without_user,
 (SELECT count(*) FROM public.privacy_erasure_ledger WHERE event_type='account_deleted') AS ledger_account_deletion_events
FROM fk_summary;
