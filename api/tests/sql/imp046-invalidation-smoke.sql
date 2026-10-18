\set ON_ERROR_STOP on
-- Isolated scratch database for IMP-046. Never run these CREATE/DROP statements
-- against DEMOS production.
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  updated_at timestamptz DEFAULT now(),
  rappresentante_europeo uuid, rappresentante_camera uuid,
  rappresentante_senato uuid, rappresentante_regionale uuid, rappresentante_comune uuid,
  candidato_europeo uuid, candidato_camera uuid, candidato_senato uuid,
  candidato_regionale uuid, candidato_comune uuid
);
CREATE TABLE public.user_representatives (
  user_id uuid PRIMARY KEY,
  updated_at timestamptz DEFAULT now(),
  rappresentante_europeo uuid, rappresentante_camera uuid,
  rappresentante_senato uuid, rappresentante_regionale uuid, rappresentante_comune uuid,
  candidato_europeo uuid, candidato_camera uuid, candidato_senato uuid,
  candidato_regionale uuid, candidato_comune uuid
);
CREATE TABLE public.political_mandates (
  id uuid PRIMARY KEY, user_id uuid NOT NULL,
  office_code text, status text, ends_at timestamptz, updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.political_candidacies (
  id uuid PRIMARY KEY, user_id uuid NOT NULL,
  jurisdiction jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text, ends_at timestamptz, updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.political_selections (
  user_id uuid NOT NULL, selection_kind text NOT NULL,
  political_office_id text NOT NULL, selected_user_id uuid NOT NULL,
  selected_mandate_id uuid, selected_candidacy_id uuid
);
\i api/migrations/20261018_imp046_invalidate_political_selections.sql

INSERT INTO public.users (
  id, rappresentante_camera, rappresentante_regionale, candidato_regionale
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
INSERT INTO public.user_representatives (
  user_id, rappresentante_camera, rappresentante_regionale, candidato_regionale
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
INSERT INTO public.political_mandates (id,user_id,office_code,status) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','C','ACTIVE'),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','R','ACTIVE');
INSERT INTO public.political_candidacies (id,user_id,jurisdiction,status) VALUES
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"level":"R","region":"TO"}','ACTIVE');
INSERT INTO public.political_selections
 (user_id,selection_kind,political_office_id,selected_user_id,selected_mandate_id,selected_candidacy_id)
 VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','representative','it.camera','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',NULL),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','representative','it.regional','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',NULL),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','candidate','it.regional','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,'33333333-3333-4333-8333-333333333333');

-- Closing Camera must not remove the same person's regional representation
-- or candidacy, and must clear all three representations of the Camera choice.
UPDATE public.political_mandates SET status='CANCELLED'
 WHERE id='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.political_selections WHERE political_office_id='it.camera') OR
     NOT EXISTS(SELECT 1 FROM public.political_selections WHERE political_office_id='it.regional' AND selection_kind='representative') OR
     NOT EXISTS(SELECT 1 FROM public.political_selections WHERE political_office_id='it.regional' AND selection_kind='candidate') OR
     EXISTS(SELECT 1 FROM public.users WHERE rappresentante_camera IS NOT NULL) OR
     EXISTS(SELECT 1 FROM public.user_representatives WHERE rappresentante_camera IS NOT NULL) OR
     EXISTS(SELECT 1 FROM public.users WHERE rappresentante_regionale IS NULL OR candidato_regionale IS NULL) THEN
    RAISE EXCEPTION 'Camera expiry erased another office or did not clear mirrors';
  END IF;
END $$;

-- Ending candidacy removes candidate selection, not representative selection.
UPDATE public.political_candidacies SET status='ENDED'
 WHERE id='33333333-3333-4333-8333-333333333333';
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.political_selections WHERE selection_kind='candidate') OR
     EXISTS(SELECT 1 FROM public.users WHERE candidato_regionale IS NOT NULL) OR
     EXISTS(SELECT 1 FROM public.user_representatives WHERE candidato_regionale IS NOT NULL) OR
     NOT EXISTS(SELECT 1 FROM public.political_selections WHERE political_office_id='it.regional' AND selection_kind='representative') THEN
    RAISE EXCEPTION 'Candidate expiry erased regional representative or left candidate mirror';
  END IF;
END $$;

-- Scheduling a future end must not clear any selection yet.
UPDATE public.political_mandates SET ends_at=now()+interval '1 day'
 WHERE id='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.political_selections WHERE political_office_id='it.regional') THEN
    RAISE EXCEPTION 'Future scheduled end cleared early';
  END IF;
END $$;

-- Passing an end date through an UPDATE invalidates it immediately.
UPDATE public.political_mandates SET ends_at=now()-interval '1 minute'
 WHERE id='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.political_selections) OR
     EXISTS(SELECT 1 FROM public.users WHERE rappresentante_regionale IS NOT NULL) OR
     EXISTS(SELECT 1 FROM public.user_representatives WHERE rappresentante_regionale IS NOT NULL) THEN
    RAISE EXCEPTION 'Mandate expiry failed to clear regional selection';
  END IF;
END $$;
