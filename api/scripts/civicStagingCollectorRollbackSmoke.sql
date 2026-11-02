-- DEMOS civic staging SQL-only synthetic smoke. NO FIREBASE, NO REAL USERS.
-- Runs against the exactly-two-user staging fixture or disposable civic_ci.
-- Changes are ALWAYS rolled back, even when assertions pass.
-- Execute only in the verified Demos-Staging project or civic_ci test DB.
BEGIN;
DO $civic_safety$
BEGIN
  IF (SELECT COUNT(*) FROM public.users) <> 2
    OR (SELECT COUNT(*) FROM public.users
        WHERE id IN (
          '00000000-0000-4000-8000-000000000301'::uuid,
          '00000000-0000-4000-8000-000000000302'::uuid)
        AND status = 'pending') <> 2
    OR EXISTS (SELECT 1 FROM public.user_devices)
    OR EXISTS (SELECT 1 FROM public.eci)
    OR EXISTS (SELECT 1 FROM public.iniziative_ministero)
    OR EXISTS (SELECT 1 FROM public.notifiche_preferenze)
    OR EXISTS (SELECT 1 FROM public.civic_new_initiative_notifications)
    OR NOT EXISTS (SELECT 1 FROM public.civic_push_delivery_guard
                   WHERE id=1 AND blocked IS TRUE)
    OR EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE event_object_schema='public'
        AND event_object_table IN
          ('eci','iniziative_ministero','civic_new_initiative_notifications')
    )
  THEN RAISE EXCEPTION 'CIVIC_STAGING_COLLECTOR_SMOKE_REFUSED'; END IF;
END $civic_safety$;

-- One initiative, one abrogative referendum, one deliberately ineligible item.
INSERT INTO public.iniziative_ministero
  (id,id_ministero,titolo,tipo,stato,data_fine)
VALUES
  ('synthetic-min-1','__civic_stage_synthetic_min_1','Synthetic popular initiative',
   'Iniziativa popolare','in_corso',CURRENT_DATE+12),
  ('synthetic-min-2','__civic_stage_synthetic_min_2','Synthetic referendum',
   'Referendum  abrogativo','in_corso',CURRENT_DATE+12),
  ('synthetic-min-3','__civic_stage_synthetic_min_3','Synthetic constitutional referendum',
   'Referendum costituzionale','in_corso',CURRENT_DATE+12);

INSERT INTO public.eci(id,title,status)
VALUES ('__civic_stage_synthetic_eci_1','Synthetic European initiative','ONGOING');

-- Mirrors the Ministero collector's INSERT SELECT and guard-lock semantics.
INSERT INTO public.civic_new_initiative_notifications
  (category, official_id, title, target_path, status)
SELECT DISTINCT ON (category, official_id)
  category, official_id, title, target_path,
  CASE WHEN guard.blocked = TRUE OR guard.reason_code = 'EMERGENCY_STOP'
    THEN 'suppressed' ELSE 'pending' END
FROM (
  SELECT
    CASE WHEN lower(regexp_replace(btrim(m.tipo), '[[:space:]]+', ' ', 'g')) =
       'referendum abrogativo' THEN 'referendum_abrogativi'
       ELSE 'iniziative_popolari' END AS category,
    btrim(m.id_ministero::text) AS official_id,
    m.titolo AS title,
    CASE WHEN lower(m.tipo) LIKE '%referendum%'
      THEN '/referendum-abrogativi'
      ELSE '/iniziative-popolari' END AS target_path
  FROM public.iniziative_ministero AS m
  WHERE m.id_ministero IS NOT NULL AND btrim(m.id_ministero::text) <> ''
    AND m.titolo IS NOT NULL AND btrim(m.titolo) <> ''
    AND lower(m.stato) = 'in_corso'
    AND (m.data_fine IS NULL OR m.data_fine >= CURRENT_DATE)
    AND lower(regexp_replace(btrim(m.tipo), '[[:space:]]+', ' ', 'g')) IN (
      'referendum abrogativo','legge di iniziativa popolare',
      'iniziativa popolare'
    )
) AS valid_items
CROSS JOIN (
  SELECT blocked,reason_code FROM public.civic_push_delivery_guard
  WHERE id=1 FOR SHARE
) AS guard
ORDER BY category,official_id,title
ON CONFLICT(category,official_id) DO NOTHING;

-- Mirrors the ECI sync's new-id upsert while the delivery barrier is blocked.
INSERT INTO public.civic_new_initiative_notifications
  (category,official_id,title,target_path,status)
SELECT 'eci',btrim(e.id::text),e.title,'/eci',
  CASE WHEN guard.blocked IS TRUE OR guard.reason_code='EMERGENCY_STOP'
    THEN 'suppressed' ELSE 'pending' END
FROM public.eci AS e
CROSS JOIN (
  SELECT blocked,reason_code FROM public.civic_push_delivery_guard
  WHERE id=1 FOR SHARE
) AS guard
WHERE e.id LIKE '__civic_stage_synthetic_%'
ON CONFLICT(category,official_id) DO NOTHING;

-- Re-seeing an already discovered official ID must not add a second event.
INSERT INTO public.civic_new_initiative_notifications
  (category,official_id,title,target_path,status)
SELECT category,official_id,title,target_path,status
FROM public.civic_new_initiative_notifications
WHERE official_id LIKE '__civic_stage_synthetic_%'
ON CONFLICT(category,official_id) DO NOTHING;

DO $verify$
BEGIN
 IF (SELECT COUNT(*) FROM public.civic_new_initiative_notifications) <> 3
 OR (SELECT COUNT(*) FROM public.civic_new_initiative_notifications
     WHERE status='suppressed') <> 3
 OR (SELECT COUNT(*) FROM public.civic_new_initiative_notifications
     WHERE status IN ('pending','dispatching','sent')) <> 0
 OR (SELECT COUNT(*) FROM public.civic_new_initiative_notifications
     WHERE category='iniziative_popolari'
       AND target_path='/iniziative-popolari') <> 1
 OR (SELECT COUNT(*) FROM public.civic_new_initiative_notifications
     WHERE category='referendum_abrogativi'
       AND target_path='/referendum-abrogativi') <> 1
 OR (SELECT COUNT(*) FROM public.civic_new_initiative_notifications
     WHERE category='eci' AND target_path='/eci') <> 1
 OR (SELECT COUNT(*) FROM public.civic_new_initiative_notifications
     WHERE official_id='__civic_stage_synthetic_min_3') <> 0
 THEN RAISE EXCEPTION 'CIVIC_STAGING_COLLECTOR_SMOKE_FAILED'; END IF;
END $verify$;

ROLLBACK;
-- Zero-residue proof; no sensitive data returned.
SELECT
  (SELECT COUNT(*) FROM public.eci) AS eci_after,
  (SELECT COUNT(*) FROM public.iniziative_ministero) AS ministero_after,
  (SELECT COUNT(*) FROM public.civic_new_initiative_notifications) AS outbox_after,
  (SELECT COUNT(*) FROM public.notifiche_preferenze) AS preferences_after,
  (SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1) AS guard_blocked;
