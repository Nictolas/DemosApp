-- DRAFT ONLY. Apply after a reviewed migration plan and explicit release GO.
-- This table stores one shared latest final vote per selected MP and chamber,
-- never one copy per follower. Existing rows are preserved or migration fails.
BEGIN;
LOCK TABLE public.notifiche_voti_parlamento IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notifiche_voti_parlamento
    GROUP BY id_utente, camera HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PARLIAMENT_LATEST_DUPLICATES_REQUIRE_REVIEW';
  END IF;
  IF EXISTS (SELECT 1 FROM public.notifiche_voti_parlamento WHERE id_utente IS NULL) THEN
    RAISE EXCEPTION 'PARLIAMENT_LATEST_NULL_REPRESENTATIVE_REQUIRES_REVIEW';
  END IF;
END $$;

ALTER TABLE public.notifiche_voti_parlamento
  ADD COLUMN IF NOT EXISTS openpolis_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vote_order BIGINT;

ALTER TABLE public.notifiche_voti_parlamento
  ALTER COLUMN id_utente SET NOT NULL;

-- Preserve exact published roll-call statuses: absence is NOT a contrary vote.
ALTER TABLE public.notifiche_voti_parlamento
  DROP CONSTRAINT IF EXISTS notifiche_voti_parlamento_voto_check;
ALTER TABLE public.notifiche_voti_parlamento
  ADD CONSTRAINT notifiche_voti_parlamento_voto_check
  CHECK (voto IN (
    'Favorevole','Contrario','Astensione','Astenuto','Astenuto R',
    'Assente','In missione','In congedo','Non ha partecipato',
    'Presente non votante','Presidente di turno'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS notifiche_voti_parlamento_latest_rep_camera
  ON public.notifiche_voti_parlamento (id_utente, camera);
CREATE INDEX IF NOT EXISTS notifiche_voti_parlamento_openpolis_id_idx
  ON public.notifiche_voti_parlamento (openpolis_id);

COMMIT;

-- Release gate: PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED stays false until
-- migration + authenticated HTTP QA + Android notification UI tests pass.
-- No FCM push dispatch is enabled by this migration.
