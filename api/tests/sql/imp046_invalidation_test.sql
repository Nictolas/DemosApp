-- Runs on an ephemeral CI PostgreSQL only. Never run this fixture in production.
\set ON_ERROR_STOP on
CREATE TABLE public.users (
 id uuid PRIMARY KEY,
 rappresentante_europeo text, rappresentante_camera text, rappresentante_senato text,
 rappresentante_regionale text, rappresentante_comune text,
 candidato_europeo text, candidato_camera text, candidato_senato text,
 candidato_regionale text, candidato_comune text,
 updated_at timestamptz
);
CREATE TABLE public.user_representatives (user_id uuid PRIMARY KEY,
 rappresentante_europeo text, rappresentante_camera text, rappresentante_senato text,
 rappresentante_regionale text, rappresentante_comune text,
 candidato_europeo text, candidato_camera text, candidato_senato text,
 candidato_regionale text, candidato_comune text,
 updated_at timestamptz);
CREATE TABLE public.political_mandates (
 id uuid PRIMARY KEY, user_id uuid, office_code text, status text,
 ends_at timestamptz);
CREATE TABLE public.political_candidacies (
 id uuid PRIMARY KEY, user_id uuid, jurisdiction jsonb, status text,
 ends_at timestamptz);
CREATE TABLE public.political_selections (
 user_id uuid, selected_user_id uuid, selection_kind text,
 political_office_id text, selected_mandate_id uuid, selected_candidacy_id uuid
);
\ir ../../migrations/20261018_imp046_invalidate_political_selections.sql

INSERT INTO users (id,rappresentante_regionale,rappresentante_europeo,candidato_regionale)
VALUES ('00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002');
INSERT INTO user_representatives(user_id,rappresentante_regionale,rappresentante_europeo,candidato_regionale)
SELECT id,rappresentante_regionale,rappresentante_europeo,candidato_regionale FROM users;
INSERT INTO political_mandates (id,user_id,office_code,status)
VALUES ('00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000002','R','ACTIVE'),
       ('00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000002','E','ACTIVE');
INSERT INTO political_candidacies (id,user_id,jurisdiction,status)
VALUES ('00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-000000000002','{"level":"R"}','ACTIVE');
INSERT INTO political_selections(user_id,selected_user_id,selection_kind,political_office_id,selected_mandate_id,selected_candidacy_id)
VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','representative','it.regional','00000000-0000-0000-0000-000000000010',NULL),
       ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','representative','eu.parliament.it','00000000-0000-0000-0000-000000000011',NULL),
       ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','candidate','it.regional',NULL,'00000000-0000-0000-0000-000000000020');

-- First retire the regional mandate: current regional representative disappears,
-- European representative and regional candidate survive.
UPDATE political_mandates SET status='CANCELLED',ends_at=now()
WHERE id='00000000-0000-0000-0000-000000000010';
DO $$
BEGIN
 IF (SELECT count(*) FROM political_selections) <> 2 THEN RAISE EXCEPTION 'Unexpected rows after regional mandate ended'; END IF;
 IF EXISTS (SELECT 1 FROM political_selections WHERE selection_kind='representative' AND political_office_id='it.regional')
    THEN RAISE EXCEPTION 'Regional representative selection not cleared'; END IF;
 IF EXISTS (SELECT 1 FROM users WHERE rappresentante_regionale IS NOT NULL OR rappresentante_europeo IS NULL OR candidato_regionale IS NULL)
    THEN RAISE EXCEPTION 'Legacy user projection invalidation failed'; END IF;
 IF EXISTS (SELECT 1 FROM user_representatives WHERE rappresentante_regionale IS NOT NULL OR rappresentante_europeo IS NULL OR candidato_regionale IS NULL)
    THEN RAISE EXCEPTION 'Legacy mirror projection invalidation failed'; END IF;
END $$;

-- Then end the candidate; don't touch the European representative.
UPDATE political_candidacies SET status='ENDED',ends_at=now()
WHERE id='00000000-0000-0000-0000-000000000020';
DO $$
BEGIN
 IF (SELECT count(*) FROM political_selections) <> 1 THEN RAISE EXCEPTION 'Unexpected selections after ending candidacy'; END IF;
 IF EXISTS (SELECT 1 FROM political_selections WHERE selection_kind='candidate') THEN RAISE EXCEPTION 'Candidate choice not cleared'; END IF;
 IF EXISTS (SELECT 1 FROM users WHERE candidato_regionale IS NOT NULL OR rappresentante_europeo IS NULL)
   THEN RAISE EXCEPTION 'Wrong legacy fields modified'; END IF;
 IF EXISTS (SELECT 1 FROM user_representatives WHERE candidato_regionale IS NOT NULL OR rappresentante_europeo IS NULL)
   THEN RAISE EXCEPTION 'Wrong mirror fields modified'; END IF;
END $$;
SELECT 'IMP-046 SQL regression PASS' AS result;


-- Regression: same politician with TWO currently active Camera capabilities.
-- A selection tied to the ended capability must be cleared, but an unbound
-- legacy-only selection must be preserved until ALL same-office capabilities end.
INSERT INTO public.users(id,rappresentante_camera)
VALUES
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004');
INSERT INTO public.user_representatives(user_id,rappresentante_camera)
VALUES
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004');
INSERT INTO public.political_mandates(id,user_id,office_code,status)
VALUES
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000004','C','ACTIVE'),
 ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000004','C','ACTIVE');
INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind,political_office_id,selected_mandate_id)
VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','representative','it.camera','00000000-0000-0000-0000-000000000021');
UPDATE public.political_mandates SET status='CANCELLED'
WHERE id='00000000-0000-0000-0000-000000000021';
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.political_selections WHERE user_id='00000000-0000-0000-0000-000000000003')
    THEN RAISE EXCEPTION 'Bound old mandate was not removed'; END IF;
 IF EXISTS (SELECT 1 FROM public.users WHERE id='00000000-0000-0000-0000-000000000003' AND rappresentante_camera IS NOT NULL)
    THEN RAISE EXCEPTION 'Bound old mandate left stale legacy projection'; END IF;
 IF EXISTS (SELECT 1 FROM public.user_representatives WHERE user_id='00000000-0000-0000-0000-000000000003' AND rappresentante_camera IS NOT NULL)
    THEN RAISE EXCEPTION 'Bound old mandate left stale legacy mirror'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.users WHERE id='00000000-0000-0000-0000-000000000005' AND rappresentante_camera IS NOT NULL)
    THEN RAISE EXCEPTION 'Unbound legacy choice cleared despite second active mandate'; END IF;
END $$;
UPDATE public.political_mandates SET status='CANCELLED'
WHERE id='00000000-0000-0000-0000-000000000022';
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.users WHERE id='00000000-0000-0000-0000-000000000005' AND rappresentante_camera IS NOT NULL)
    THEN RAISE EXCEPTION 'Last mandate ending left a stale legacy-only choice'; END IF;
END $$;
SELECT 'IMP-046 duplicate-office capability regression PASS' AS result;
