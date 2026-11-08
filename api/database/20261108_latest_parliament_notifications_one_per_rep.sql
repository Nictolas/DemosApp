-- PROD-041: DRAFT ONLY, apply after 20261103_latest_parliament_votes.sql.
-- This table contains the last shared notification per representative, not
-- one row per chamber that could retain an older person's nominal vote.
-- NO legacy rows are deleted or reconciled implicitly.
BEGIN;
LOCK TABLE public.notifiche_voti_parlamento IN SHARE ROW EXCLUSIVE MODE;
DO $prod041_notifications$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notifiche_voti_parlamento
    GROUP BY id_utente HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PROD041_NOTIFICATIONS_CROSS_CHAMBER_DUPLICATES_REQUIRE_REVIEW';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notifiche_voti_parlamento WHERE id_utente IS NULL
  ) THEN
    RAISE EXCEPTION 'PROD041_NOTIFICATIONS_NULL_PERSON_REQUIRES_REVIEW';
  END IF;
END $prod041_notifications$;
CREATE UNIQUE INDEX IF NOT EXISTS notifiche_voti_parlamento_latest_rep
  ON public.notifiche_voti_parlamento(id_utente);
COMMIT;
