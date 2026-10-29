#!/usr/bin/env bash
set -euo pipefail

# Run against an isolated disposable Postgres container, never production.
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=postgres PGPASSWORD=postgres

node - <<'NODE'
const fs = require('fs');
const source = fs.readFileSync('api/database/create-account-capabilities-model.sql', 'utf8');
const match = source.match(/DO \$unverified_mandate_guard\$[\s\S]*?\$unverified_mandate_guard\$;/);
if (!match) throw new Error('Missing guard in SQL migration');
fs.writeFileSync('/tmp/demos-mandate-guard-test.sql', match[0] + '\n');
NODE

psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.users (id INTEGER PRIMARY KEY, account_type TEXT, ruolo TEXT);
CREATE TABLE public.political_mandates (
  user_id INTEGER NOT NULL, status TEXT, source TEXT,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ
);
SQL

scenario() {
  local label="$1" seed="$2" expected="$3"
  psql -X -v ON_ERROR_STOP=1 -c "TRUNCATE public.political_mandates, public.users;"
  psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO public.users VALUES (1, 'PERSON', 'P');"
  if [[ -n "$seed" ]]; then
    psql -X -v ON_ERROR_STOP=1 -c "$seed"
  fi
  if psql -X -v ON_ERROR_STOP=1 -f /tmp/demos-mandate-guard-test.sql > /tmp/demos-guard.log 2>&1; then
    if [[ "$expected" != "success" ]]; then
      echo "FAIL: $label incorrectly accepted a historic record"
      cat /tmp/demos-guard.log; exit 1
    fi
  else
    if [[ "$expected" != "failure" ]]; then
      echo "FAIL: $label incorrectly rejected a verified mandate"
      cat /tmp/demos-guard.log; exit 1
    fi
    if ! grep -q 'Unverified legacy politician mandates:' /tmp/demos-guard.log; then
      echo "FAIL: $label failed for an unexpected SQL reason"
      cat /tmp/demos-guard.log; exit 1
    fi
  fi
  echo "PASS: $label ($expected)"
}

scenario "no mandate" "" failure
scenario "fake ACTIVE migration" "INSERT INTO political_mandates VALUES (1,'ACTIVE','LEGACY_BACKFILL',NOW()-INTERVAL '1 day',NULL);" failure
scenario "official ENDED" "INSERT INTO political_mandates VALUES (1,'ENDED','OFFICIAL_VERIFIED',NOW()-INTERVAL '5 years',NOW()-INTERVAL '1 day');" failure
scenario "future official ACTIVE" "INSERT INTO political_mandates VALUES (1,'ACTIVE','OFFICIAL_VERIFIED',NOW()+INTERVAL '1 year',NULL);" failure
scenario "expired official ACTIVE" "INSERT INTO political_mandates VALUES (1,'ACTIVE','OFFICIAL_VERIFIED',NOW()-INTERVAL '5 years',NOW()-INTERVAL '1 day');" failure
scenario "verified ACTIVE" "INSERT INTO political_mandates VALUES (1,'ACTIVE','OFFICIAL_VERIFIED',NOW()-INTERVAL '1 year',NULL);" success
scenario "official roster ACTIVE" "INSERT INTO political_mandates VALUES (1,'ACTIVE','EP_CURRENT_ROSTER',NOW()-INTERVAL '1 year',NULL);" success

echo 'Seven PostgreSQL mandate-source scenarios passed.'


# FULL migration smoke: create a minimal historic schema and prove the real
# BEGIN/COMMIT migration rolls back all changes if only a legacy P/ACTIVE row
# exists. All objects live inside this disposable CI PostgreSQL container.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE public.political_mandates;
DROP TABLE public.users;
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  ruolo VARCHAR(3),
  grado_elezione TEXT,
  grado_candidatura TEXT,
  paese_elezione TEXT,
  regione_elezione TEXT,
  provincia_elezione TEXT,
  comune_elezione TEXT,
  paese_candidatura TEXT,
  regione_candidatura TEXT,
  provincia_candidatura TEXT,
  comune_candidatura TEXT
);
SQL

node - <<'NODE'
const fs = require('fs');
const source = fs.readFileSync('api/database/create-account-capabilities-model.sql', 'utf8');
const ddl = source.match(/CREATE TABLE IF NOT EXISTS political_mandates \([\s\S]*?\n\);/);
if (!ddl) throw new Error('Political mandate table DDL missing');
fs.writeFileSync('/tmp/demos-full-pm-create.sql', ddl[0].replace('CREATE TABLE IF NOT EXISTS', 'CREATE TABLE') + '\n');
NODE
psql -X -v ON_ERROR_STOP=1 -f /tmp/demos-full-pm-create.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.users(id, ruolo, grado_elezione)
VALUES ('00000000-0000-4000-8000-000000000001', 'P', 'S');
INSERT INTO public.political_mandates(user_id,office_code,status,source)
VALUES ('00000000-0000-4000-8000-000000000001', 'S','ACTIVE','LEGACY_BACKFILL');
SQL
if psql -X -v ON_ERROR_STOP=1 -f api/database/create-account-capabilities-model.sql > /tmp/demos-full-migration.log 2>&1; then
  echo 'FAIL: full migration accepted a legacy-only current politician'; exit 1
fi
if ! grep -q 'Unverified legacy politician mandates:' /tmp/demos-full-migration.log; then
  echo 'FAIL: migration aborted for a reason other than verified-mandate guard'
  tail -40 /tmp/demos-full-migration.log; exit 1
fi
column_count="$(psql -X -At -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='account_type'")"
if [[ "$column_count" != "0" ]]; then
  echo 'FAIL: failed migration wrote a new users column despite transaction rollback'; exit 1
fi
echo 'PASS: full migration aborts atomically on a legacy-only P/ACTIVE record'

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM public.political_mandates;
INSERT INTO public.political_mandates(user_id,office_code,status,source)
VALUES ('00000000-0000-4000-8000-000000000001', 'S','ACTIVE','OFFICIAL_VERIFIED');
SQL
if ! psql -X -v ON_ERROR_STOP=1 -f api/database/create-account-capabilities-model.sql > /tmp/demos-full-migration-success.log 2>&1; then
  echo 'FAIL: full migration rejected an official verified ACTIVE mandate'
  tail -80 /tmp/demos-full-migration-success.log; exit 1
fi
status="$(psql -X -At -c "SELECT ruolo||':'||account_type FROM public.users WHERE id='00000000-0000-4000-8000-000000000001'")"
if [[ "$status" != "P:PERSON" ]]; then
  echo "FAIL: verified political role projection is $status instead of P:PERSON"; exit 1
fi
fabricated="$(psql -X -At -c "SELECT COUNT(*) FROM public.political_mandates WHERE source='LEGACY_BACKFILL'")"
if [[ "$fabricated" != "0" ]]; then
  echo 'FAIL: full migration inserted an unverified legacy mandate'; exit 1
fi
echo 'PASS: full migration completes, preserves verified P and adds no bogus mandate'
