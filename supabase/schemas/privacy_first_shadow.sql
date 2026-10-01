-- DEMOS privacy-first shadow schema
-- STATUS: DESIGN / SHADOW ONLY. Do not apply automatically to production.
--
-- Invariant: no persistent account_id/user_id/email/name mapping may exist
-- from Identity to research.participants.participant_id.

create schema if not exists identity;
create schema if not exists research;
create schema if not exists content;
create schema if not exists politics;
create schema if not exists audit;

revoke all on schema identity from public, anon, authenticated;
revoke all on schema research from public, anon, authenticated;
revoke all on schema content from public, anon, authenticated;
revoke all on schema politics from public, anon, authenticated;
revoke all on schema audit from public, anon, authenticated;

create table if not exists identity.participation_eligibility (
  account_id uuid primary key references public.users(id) on delete cascade,
  eligible boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Identity records issuance eligibility, never the final token or participant_id.
create table if not exists identity.credential_issuances (
  issuance_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.users(id) on delete cascade,
  purpose text not null check (purpose in ('enroll', 'renew')),
  epoch text not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (account_id, purpose, epoch)
);

create table if not exists content.opinion_questions (
  question_id text primary key,
  question_text text not null,
  domain text not null default 'politics',
  level text,
  category text,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  methodology_notes text,
  check (valid_to is null or valid_to > valid_from)
);

-- No direct account/auth identifiers are allowed in the research schema.
create table if not exists research.participants (
  participant_id uuid primary key default gen_random_uuid(),
  participant_public_key bytea not null unique,
  key_algorithm text not null default 'ed25519',
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  credential_version integer not null default 1 check (credential_version > 0),
  created_at timestamptz not null default now(),
  last_confirmed_at timestamptz,
  expires_at timestamptz,
  check (expires_at is null or expires_at > created_at)
);

-- Anti-replay set. Deliberately no participant_id.
create table if not exists research.spent_credentials (
  credential_digest bytea primary key,
  purpose text not null check (purpose in ('enroll', 'renew')),
  epoch text not null,
  redeemed_at timestamptz not null default now()
);

create table if not exists research.proof_challenges (
  challenge_digest bytea primary key,
  purpose text not null check (purpose = 'read-opinions-v1'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > issued_at)
);

create index if not exists idx_research_proof_challenges_expiry
  on research.proof_challenges (expires_at);

create table if not exists research.participant_dimensions (
  participant_id uuid primary key
    references research.participants(participant_id) on delete cascade,
  country_code char(2),
  region_code text,
  province_code text,
  municipality_code text,
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2100),
  gender text,
  valid_from timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists research.opinion_response_events (
  response_event_id uuid primary key default gen_random_uuid(),
  participant_id uuid not null
    references research.participants(participant_id) on delete cascade,
  question_id text not null
    references content.opinion_questions(question_id) on delete restrict,
  answer_code text not null check (answer_code in ('f', 'c', 'i')),
  questionnaire_version integer not null default 1 check (questionnaire_version > 0),
  source text not null default 'self' check (source = 'self'),
  recorded_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  valid_until timestamptz,
  check (valid_until is null or valid_until > confirmed_at)
);

create index if not exists idx_research_opinion_current
  on research.opinion_response_events (participant_id, question_id, recorded_at desc);

create index if not exists idx_research_opinion_question_validity
  on research.opinion_response_events (question_id, valid_until);

create or replace view research.current_opinion_responses
with (security_invoker = true)
as
select distinct on (e.participant_id, e.question_id)
  e.participant_id,
  e.question_id,
  e.answer_code,
  e.questionnaire_version,
  e.recorded_at,
  e.confirmed_at,
  e.valid_until
from research.opinion_response_events e
join research.participants p on p.participant_id = e.participant_id
where p.status = 'active'
  and (p.expires_at is null or p.expires_at > now())
  and (e.valid_until is null or e.valid_until > now())
order by e.participant_id, e.question_id, e.recorded_at desc;

create table if not exists politics.public_figures (
  figure_id uuid primary key default gen_random_uuid(),
  public_slug text unique,
  first_name text not null,
  last_name text not null,
  figure_type text not null check (figure_type in ('politician', 'candidate')),
  office_or_candidacy text,
  country_code char(2),
  region_code text,
  province_code text,
  municipality_code text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists politics.position_sources (
  source_id uuid primary key default gen_random_uuid(),
  source_url text,
  publisher text,
  title text,
  source_type text not null,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  notes text
);

create table if not exists politics.figure_positions (
  position_id uuid primary key default gen_random_uuid(),
  figure_id uuid not null references politics.public_figures(figure_id) on delete cascade,
  question_id text not null references content.opinion_questions(question_id) on delete restrict,
  answer_code text not null check (answer_code in ('f', 'c', 'i')),
  source_id uuid references politics.position_sources(source_id) on delete set null,
  provenance_type text not null
    check (provenance_type in ('public_source', 'self_declared', 'admin_verified')),
  observed_at timestamptz not null default now(),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  check (valid_to is null or valid_to > valid_from)
);

create index if not exists idx_politics_positions_figure_question
  on politics.figure_positions (figure_id, question_id, observed_at desc);

-- Audit deliberately has no participant_id and no opinion payload.
create table if not exists audit.security_events (
  event_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid references public.users(id) on delete set null,
  event_type text not null,
  resource_type text,
  outcome text not null,
  request_id text,
  created_at timestamptz not null default now()
);

alter table identity.participation_eligibility enable row level security;
alter table identity.participation_eligibility force row level security;
alter table identity.credential_issuances enable row level security;
alter table identity.credential_issuances force row level security;
alter table content.opinion_questions enable row level security;
alter table content.opinion_questions force row level security;
alter table research.participants enable row level security;
alter table research.participants force row level security;
alter table research.spent_credentials enable row level security;
alter table research.spent_credentials force row level security;
alter table research.proof_challenges enable row level security;
alter table research.proof_challenges force row level security;
alter table research.participant_dimensions enable row level security;
alter table research.participant_dimensions force row level security;
alter table research.opinion_response_events enable row level security;
alter table research.opinion_response_events force row level security;
alter table politics.public_figures enable row level security;
alter table politics.public_figures force row level security;
alter table politics.position_sources enable row level security;
alter table politics.position_sources force row level security;
alter table politics.figure_positions enable row level security;
alter table politics.figure_positions force row level security;
alter table audit.security_events enable row level security;
alter table audit.security_events force row level security;

revoke all on all tables in schema identity from public, anon, authenticated;
revoke all on all tables in schema research from public, anon, authenticated;
revoke all on all tables in schema content from public, anon, authenticated;
revoke all on all tables in schema politics from public, anon, authenticated;
revoke all on all tables in schema audit from public, anon, authenticated;

revoke all on all sequences in schema identity from public, anon, authenticated;
revoke all on all sequences in schema research from public, anon, authenticated;
revoke all on all sequences in schema content from public, anon, authenticated;
revoke all on all sequences in schema politics from public, anon, authenticated;
revoke all on all sequences in schema audit from public, anon, authenticated;

revoke all on research.current_opinion_responses from public, anon, authenticated;

comment on schema research is
  'Private pseudonymous research domain. Must never contain direct account identifiers.';
