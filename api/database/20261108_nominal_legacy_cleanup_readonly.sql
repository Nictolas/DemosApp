-- PROD-041: READ-ONLY INVENTORY. No DELETE, TRUNCATE, UPDATE or DROP.
-- Execute against an approved replica or production with SELECT-only privileges.
SELECT 'parlamento_voti_nominali' AS legacy_table,
  count(*) AS rows_total, count(distinct uri_politico) AS stable_keys,
  count(*) FILTER (WHERE uri_politico IS NULL OR btrim(uri_politico)='') AS unresolved_keys
FROM public.parlamento_voti_nominali
UNION ALL
SELECT 'parlamento_europeo_voti_nominali',count(*),count(distinct mep_id),
  count(*) FILTER (WHERE mep_id IS NULL OR btrim(mep_id)='')
FROM public.parlamento_europeo_voti_nominali;

-- Diagnostic only: a person can have >1 old nominal snapshots. The timestamp
-- of the sync is NOT the date of the ballot and MUST NOT decide the winner.
SELECT camera, count(*) AS rows_total, count(distinct uri_politico) AS people
FROM public.parlamento_voti_nominali GROUP BY camera ORDER BY camera;

SELECT count(*) AS legacy_camera_rows,
  count(*) FILTER (WHERE data_votazione IS NULL) AS missing_vote_date,
  count(*) FILTER (WHERE voto IS NULL OR btrim(voto)='') AS missing_nominal_status
FROM public.voti_camera;

-- Review dependencies before removal; views/functions/application code may
-- reference old names even when no direct FK exists.
SELECT conrelid::regclass::text AS dependent_table, conname,
       confrelid::regclass::text AS referenced_table
FROM pg_constraint WHERE contype='f'
AND (conrelid::regclass::text LIKE '%parlamento_voti_nominali%'
  OR confrelid::regclass::text LIKE '%parlamento_voti_nominali%'
  OR conrelid::regclass::text LIKE '%voti_camera%'
  OR confrelid::regclass::text LIKE '%voti_camera%'
  OR conrelid::regclass::text LIKE '%parlamento_europeo_voti_nominali%'
  OR confrelid::regclass::text LIKE '%parlamento_europeo_voti_nominali%');
