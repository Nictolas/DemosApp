-- PostgreSQL 17 disposable fixture ONLY. Never run against a shared/staging/prod DB.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL DEFAULT 'PERSON',
  ruolo VARCHAR(3) NOT NULL DEFAULT 'E'
);

CREATE TABLE public.political_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  election_event_id UUID,
  office_code TEXT,
  institution_code TEXT,
  jurisdiction JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  source VARCHAR(30) NOT NULL DEFAULT 'DEMOS',
  legacy_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('ACTIVE','ENDED','CANCELLED')),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

INSERT INTO public.users (id, account_type, ruolo) VALUES
 ('11111111-1111-4111-8111-111111111111','PERSON','P'),
 ('22222222-2222-4222-8222-222222222222','PERSON','P'),
 ('33333333-3333-4333-8333-333333333333','ORGANIZATION','O');

-- One fake LEGACY_BACKFILL row whose alleged current role must not block
-- insertion of an independently verified historical mandate.
INSERT INTO public.political_mandates(user_id,office_code,source,status,starts_at)
VALUES ('11111111-1111-4111-8111-111111111111','S','LEGACY_BACKFILL','ACTIVE',
        '2026-10-13T00:00:00Z');
