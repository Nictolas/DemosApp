-- RESEARCH ONLY - NOT AUTHORIZED FOR PRODUCTION.
-- Apply only after manual approval and fresh, read-only schema preflight.
-- There is deliberately no DROP COLUMN, COPY, UPDATE, DELETE or backfill.
-- PostgreSQL DDL takes a brief table lock; a production operator must set
-- an appropriate short lock_timeout and retry off-peak if necessary.
-- Old 94 TEXT answers, user_id and fonti_opinioni remain unchanged.
ALTER TABLE public.opinioni_risposte
  ADD COLUMN IF NOT EXISTS answers_extra jsonb;
