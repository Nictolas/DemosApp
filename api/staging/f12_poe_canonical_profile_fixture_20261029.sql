-- Synthetic-only canonical /auth/me SQL schema for DEMOS staging F12-12I.
-- Applies ONLY on fkeayjzvtuvzesljhjbc (Demos-Staging), NEVER on production.
-- Existing public schema and other testing schemas are not modified.
-- No names, emails, auth identities, credentials or personal data are inserted.
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='f12_poe_ci') OR
     (SELECT COUNT(*) FROM f12_poe_ci.users) <> 7 THEN
    RAISE EXCEPTION 'Missing isolated F12-12I staging fixture: refuse execution';
  END IF;
  IF has_schema_privilege('anon','f12_poe_ci','USAGE') OR
     has_schema_privilege('authenticated','f12_poe_ci','USAGE') OR
     has_schema_privilege('service_role','f12_poe_ci','USAGE') THEN
    RAISE EXCEPTION 'Private schema exposed unexpectedly';
  END IF;
END $guard$;

ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS nome TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS cognome TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS genere TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS data_nascita DATE;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS cittadinanza TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS paese_residenza TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS regione_residenza TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS provincia_residenza TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS comune_residenza TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS paese_elezione TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS regione_elezione TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS provincia_elezione TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS comune_elezione TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS paese_candidatura TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS regione_candidatura TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS provincia_candidatura TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS comune_candidatura TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS grado_elezione TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS grado_candidatura TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS rappresentante_europeo TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS rappresentante_camera TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS rappresentante_senato TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS rappresentante_regionale TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS rappresentante_comune TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS candidato_europeo TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS candidato_camera TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS candidato_senato TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS candidato_regionale TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS candidato_comune TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS telegram_url TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS twitch_url TEXT;
ALTER TABLE f12_poe_ci.users ADD COLUMN IF NOT EXISTS youtube_url TEXT;

CREATE TABLE f12_poe_ci.user_profile (
  user_id UUID PRIMARY KEY REFERENCES f12_poe_ci.users(id),
  genere TEXT,
  data_nascita DATE,
  cittadinanza TEXT,
  paese_residenza TEXT,
  regione_residenza TEXT,
  provincia_residenza TEXT,
  comune_residenza TEXT,
  paese_elezione TEXT,
  regione_elezione TEXT,
  provincia_elezione TEXT,
  comune_elezione TEXT,
  paese_candidatura TEXT,
  regione_candidatura TEXT,
  provincia_candidatura TEXT,
  comune_candidatura TEXT,
  grado_elezione TEXT,
  grado_candidatura TEXT,
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,
  telegram_url TEXT,
  website_url TEXT,
  twitch_url TEXT,
  youtube_url TEXT
);
CREATE TABLE f12_poe_ci.user_representatives (
  user_id UUID PRIMARY KEY REFERENCES f12_poe_ci.users(id),
  rappresentante_europeo TEXT,
  rappresentante_camera TEXT,
  rappresentante_senato TEXT,
  rappresentante_regionale TEXT,
  rappresentante_comune TEXT,
  candidato_europeo TEXT,
  candidato_camera TEXT,
  candidato_senato TEXT,
  candidato_regionale TEXT,
  candidato_comune TEXT
);
REVOKE ALL ON ALL TABLES IN SCHEMA f12_poe_ci FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE f12_poe_ci.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE f12_poe_ci.user_representatives ENABLE ROW LEVEL SECURITY;
INSERT INTO f12_poe_ci.user_profile(user_id,genere,regione_residenza)
VALUES ('00000000-0000-4000-8000-100000000005','M','Toscana');
INSERT INTO f12_poe_ci.user_representatives(user_id,rappresentante_camera)
VALUES ('00000000-0000-4000-8000-100000000005','synthetic-choice');
UPDATE f12_poe_ci.users SET is_dpo=true
WHERE id='00000000-0000-4000-8000-100000000003' AND ruolo='E' AND is_admin=false;

DO $verify$
BEGIN
 IF NOT EXISTS (
 SELECT 1 FROM f12_poe_ci.users u
 LEFT JOIN f12_poe_ci.user_profile up ON up.user_id=u.id
 LEFT JOIN f12_poe_ci.user_representatives ur ON ur.user_id=u.id
 WHERE u.id='00000000-0000-4000-8000-100000000005'
   AND u.account_type='E' AND u.ruolo='I' AND u.status='a'
   AND COALESCE(up.regione_residenza,u.regione_residenza)='Toscana'
   AND COALESCE(ur.rappresentante_camera,u.rappresentante_camera)='synthetic-choice'
 ) THEN RAISE EXCEPTION 'Private staging canonical profile join failed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM f12_poe_ci.users
 WHERE id='00000000-0000-4000-8000-100000000003'
 AND is_dpo=true AND is_admin=false AND ruolo='E') THEN
  RAISE EXCEPTION 'Private staging DPO separation failed'; END IF;
END $verify$;
