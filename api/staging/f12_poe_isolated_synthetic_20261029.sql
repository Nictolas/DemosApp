-- F12-12I: isolated, synthetic-only Supabase Demos-Staging fixture.
-- Not public; no production users, PII, OAuth identities, or auth sessions.
-- Never run against DEMOS production. Dedicated schema not in Data API.
CREATE SCHEMA f12_poe_ci;
REVOKE ALL ON SCHEMA f12_poe_ci FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE f12_poe_ci.users (
  id uuid PRIMARY KEY,
  ruolo varchar(3) NOT NULL DEFAULT 'E',
  status varchar(20) NOT NULL DEFAULT 'pending',
  account_type varchar(20) NOT NULL DEFAULT 'PERSON',
  is_admin boolean NOT NULL DEFAULT false,
  is_dpo boolean NOT NULL DEFAULT false,
  is_activist boolean NOT NULL DEFAULT false,
  CONSTRAINT users_account_type_check CHECK (account_type IN ('PERSON','ORGANIZATION','INSTITUTION'))
);
CREATE TABLE f12_poe_ci.political_mandates (
  user_id uuid NOT NULL REFERENCES f12_poe_ci.users(id),
  status text NOT NULL,
  source text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz
);
CREATE TABLE f12_poe_ci.political_candidacies (
  user_id uuid NOT NULL REFERENCES f12_poe_ci.users(id),
  status text NOT NULL,
  source text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz
);

REVOKE ALL ON ALL TABLES IN SCHEMA f12_poe_ci FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE f12_poe_ci.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE f12_poe_ci.political_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE f12_poe_ci.political_candidacies ENABLE ROW LEVEL SECURITY;

INSERT INTO f12_poe_ci.users (id,ruolo,status,account_type,is_admin,is_dpo,is_activist) VALUES
 ('00000000-0000-4000-8000-100000000001','P','a','PERSON',false,false,false),
 ('00000000-0000-4000-8000-100000000002','CP','a','PERSON',false,false,false),
 ('00000000-0000-4000-8000-100000000003','E','a','PERSON',false,false,false),
 ('00000000-0000-4000-8000-100000000004','O','a','ORGANIZATION',false,false,false),
 ('00000000-0000-4000-8000-100000000005','I','a','INSTITUTION',false,false,false),
 ('00000000-0000-4000-8000-100000000006','AD','a','PERSON',true,false,false),
 ('00000000-0000-4000-8000-100000000007','A','a','PERSON',false,false,true);

INSERT INTO f12_poe_ci.political_mandates(user_id,status,source,starts_at) VALUES
('00000000-0000-4000-8000-100000000001','ACTIVE','LEGACY_BACKFILL',now()-interval '1 year'),
('00000000-0000-4000-8000-100000000002','ACTIVE','LEGACY_BACKFILL',now()-interval '1 year');
INSERT INTO f12_poe_ci.political_candidacies(user_id,status,source,starts_at) VALUES
('00000000-0000-4000-8000-100000000002','ACTIVE','LEGACY_BACKFILL',now()-interval '1 year');

CREATE FUNCTION f12_poe_ci.refresh_users_legacy_role(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,f12_poe_ci
AS $fn$
DECLARE
  v_type varchar(20);
  v_admin boolean;
  v_activist boolean;
  v_old varchar(3);
  v_pol boolean;
  v_candidate boolean;
  v_role varchar(3);
BEGIN
  SELECT account_type,is_admin,is_activist,ruolo
  INTO v_type,v_admin,v_activist,v_old
  FROM f12_poe_ci.users WHERE id=p_user_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM f12_poe_ci.political_mandates m
    WHERE m.user_id=p_user_id AND m.status='ACTIVE' AND m.source<>'LEGACY_BACKFILL'
      AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now())
  ) INTO v_pol;
  SELECT EXISTS (
    SELECT 1 FROM f12_poe_ci.political_candidacies c
    WHERE c.user_id=p_user_id AND c.status='ACTIVE'
      AND c.starts_at<=now() AND (c.ends_at IS NULL OR c.ends_at>now())
  ) INTO v_candidate;
  v_role := CASE
    WHEN v_type IN ('E','INSTITUTION') THEN 'I'
    WHEN v_type IN ('O','ORGANIZATION') THEN 'O'
    WHEN v_admin THEN 'AD'
    WHEN v_old='CP' AND NOT (v_pol AND v_candidate) THEN 'CP'
    WHEN v_old='P' AND NOT v_pol THEN 'P'
    WHEN v_pol AND v_candidate THEN 'CP'
    WHEN v_pol THEN 'P'
    WHEN v_candidate THEN 'C'
    WHEN v_activist THEN 'A'
    ELSE 'E' END;
  UPDATE f12_poe_ci.users SET ruolo=v_role
  WHERE id=p_user_id AND ruolo IS DISTINCT FROM v_role;
END;
$fn$;
REVOKE ALL ON FUNCTION f12_poe_ci.refresh_users_legacy_role(uuid)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION f12_poe_ci.trg_users_role()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,f12_poe_ci
AS $fn$
BEGIN
  PERFORM f12_poe_ci.refresh_users_legacy_role(NEW.id);
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION f12_poe_ci.trg_users_role()
 FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER users_capabilities_refresh_legacy_role
AFTER UPDATE OF account_type,is_admin,is_activist
ON f12_poe_ci.users
FOR EACH ROW EXECUTE FUNCTION f12_poe_ci.trg_users_role();

-- Convert the synthetic fixture. Historical P/CP must survive intact.
CREATE TEMP TABLE f12_poe_role_snapshot ON COMMIT DROP
AS SELECT id,ruolo FROM f12_poe_ci.users;
ALTER TABLE f12_poe_ci.users DISABLE TRIGGER users_capabilities_refresh_legacy_role;
ALTER TABLE f12_poe_ci.users DROP CONSTRAINT users_account_type_check;
UPDATE f12_poe_ci.users SET account_type=CASE account_type
 WHEN 'PERSON' THEN 'P' WHEN 'ORGANIZATION' THEN 'O'
 WHEN 'INSTITUTION' THEN 'E' ELSE account_type END;
ALTER TABLE f12_poe_ci.users
 ADD CONSTRAINT users_account_type_check CHECK(account_type IN ('P','O','E'));
ALTER TABLE f12_poe_ci.users ALTER COLUMN account_type SET DEFAULT 'P';
ALTER TABLE f12_poe_ci.users ENABLE TRIGGER users_capabilities_refresh_legacy_role;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM f12_poe_ci.users)<>7 THEN
  RAISE EXCEPTION 'Synthetic fixture count drift'; END IF;
 IF EXISTS (SELECT 1 FROM f12_poe_ci.users u
  JOIN f12_poe_role_snapshot s USING(id) WHERE u.ruolo<>s.ruolo) THEN
  RAISE EXCEPTION 'Legacy roles changed during conversion'; END IF;
 IF (SELECT count(*) FROM f12_poe_ci.users WHERE account_type='P')<>5 OR
    (SELECT count(*) FROM f12_poe_ci.users WHERE account_type='O')<>1 OR
    (SELECT count(*) FROM f12_poe_ci.users WHERE account_type='E')<>1 THEN
  RAISE EXCEPTION 'Wrong compact account distribution'; END IF;
 IF has_schema_privilege('anon','f12_poe_ci','USAGE') OR
    has_schema_privilege('authenticated','f12_poe_ci','USAGE') OR
    has_schema_privilege('service_role','f12_poe_ci','USAGE') THEN
  RAISE EXCEPTION 'Isolated schema exposed'; END IF;
END $verify$;
-- Test transactions and account role refresh via read-only smoke queries.
