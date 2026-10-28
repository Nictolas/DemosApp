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
