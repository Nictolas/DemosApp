-- Synthetic-only rows in a disposable PostgreSQL 16 CI fixture.
-- This file MUST NOT run on DEMOS staging or production.
ALTER TABLE public.users ADD COLUMN status text NOT NULL DEFAULT 'a';

CREATE TABLE public.political_mandates (
  user_id uuid NOT NULL REFERENCES public.users(id),
  office_code text NOT NULL,
  status text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz
);
CREATE TABLE public.political_selections (
  user_id uuid NOT NULL REFERENCES public.users(id),
  selected_user_id uuid REFERENCES public.users(id),
  political_office_id text NOT NULL,
  selection_kind text NOT NULL
);

INSERT INTO public.political_mandates
  (user_id,office_code,status,starts_at)
VALUES
  ('00000000-0000-4000-8000-000000000103',
   'E','ACTIVE','2026-01-01T00:00:00Z');

INSERT INTO public.political_selections
  (user_id,selected_user_id,political_office_id,selection_kind)
VALUES
  ('00000000-0000-4000-8000-000000000104',
   '00000000-0000-4000-8000-000000000103',
   'eu.parliament.it','representative');

-- A synthetic reviewer explicitly verifies an invented identity. This does
-- not establish, alter or suggest verification of any real DEMOS person.
UPDATE public.institutional_nominal_identity_links
SET review_state='VERIFIED',
    reviewed_by='00000000-0000-4000-8000-000000000101',
    reviewed_at=now()
WHERE institution='PE'
  AND representative_id='00000000-0000-4000-8000-000000000103'
  AND source_person_id='234567';
