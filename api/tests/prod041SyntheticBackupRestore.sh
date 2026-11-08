#!/usr/bin/env bash
# PROD-041: only synthetic ephemeral CI. Never run against production/staging.
set -euo pipefail
umask 077
if [[ "$(printenv GITHUB_ACTIONS || true)" != "true" ||
      "$(printenv TEST_PARLIAMENT_PG_EPHEMERAL || true)" != "true" ]]; then
  echo "REFUSE_NON_EPHEMERAL_BACKUP_REHEARSAL" >&2
  exit 3
fi
for binary in docker openssl sha256sum mktemp; do
  command -v "$binary" >/dev/null || { echo "MISSING_REHEARSAL_TOOL" >&2; exit 3; }
done
containers="$(docker ps --filter 'ancestor=postgres:16-alpine' --format '{{.ID}}')"
if [[ -z "$containers" || "$containers" == *$'\n'* ]]; then
  echo "REFUSE_UNEXPECTED_POSTGRES_CONTAINER_COUNT" >&2
  exit 3
fi
cid="$containers"
assert_ci_identity="$(docker exec "$cid" psql -U demos_test -d demos_test -Atc "SELECT current_database() || ':' || current_user;")"
[[ "$assert_ci_identity" == 'demos_test:demos_test' ]] || {
  echo "REFUSE_WRONG_REHEARSAL_DB" >&2
  exit 3
}
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
# Two synthetic historical votes, same synthetic representative.
docker exec -i "$cid" psql -v ON_ERROR_STOP=1 -U demos_test -d demos_test >/dev/null <<'SQL'
CREATE SCHEMA IF NOT EXISTS prod041_rehearsal;
CREATE TABLE IF NOT EXISTS prod041_rehearsal.parlamento_voti_nominali (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uri_votazione text NOT NULL, camera text NOT NULL,
  uri_politico text NOT NULL, nome_politico text NOT NULL, voto text NOT NULL
);
INSERT INTO prod041_rehearsal.parlamento_voti_nominali(uri_votazione,camera,uri_politico,nome_politico,voto)
VALUES ('synthetic-ballot-1','Senato','synthetic-source-person','PERSONA FINTA','Favorevole'),
       ('synthetic-ballot-2','Senato','synthetic-source-person','PERSONA FINTA','Contrario');
SQL
source_count="$(docker exec "$cid" psql -U demos_test -d demos_test -Atc \
  "SELECT count(*) FROM prod041_rehearsal.parlamento_voti_nominali;")"
[[ "$source_count" == 2 ]] || { echo "REHEARSAL_SOURCE_COUNT_MISMATCH" >&2; exit 3; }
docker exec "$cid" pg_dump -U demos_test -d demos_test --format=custom \
  --no-owner --no-privileges --table=prod041_rehearsal.parlamento_voti_nominali > "$scratch/legacy.dump"
openssl rand -hex 32 > "$scratch/key"
openssl enc -aes-256-cbc -salt -pbkdf2 -in "$scratch/legacy.dump" \
  -out "$scratch/legacy.dump.enc" -pass file:"$scratch/key"
test -s "$scratch/legacy.dump.enc"
expected_hash="$(sha256sum "$scratch/legacy.dump" | cut -d' ' -f1)"
rm -f "$scratch/legacy.dump"
openssl enc -d -aes-256-cbc -pbkdf2 -in "$scratch/legacy.dump.enc" \
  -out "$scratch/restored.dump" -pass file:"$scratch/key"
actual_hash="$(sha256sum "$scratch/restored.dump" | cut -d' ' -f1)"
[[ "$expected_hash" == "$actual_hash" ]] || {
  echo "REHEARSAL_BACKUP_CHECKSUM_MISMATCH" >&2
  exit 3
}
docker exec -i "$cid" pg_restore -l < "$scratch/restored.dump" >/dev/null
docker exec "$cid" psql -v ON_ERROR_STOP=1 -U demos_test -d postgres \
  -c "CREATE DATABASE prod041_restore_fixture OWNER demos_test" >/dev/null
docker exec "$cid" psql -v ON_ERROR_STOP=1 -U demos_test -d prod041_restore_fixture \
  -c "CREATE SCHEMA prod041_rehearsal" >/dev/null
docker exec -i "$cid" pg_restore -U demos_test -d prod041_restore_fixture \
  --no-owner --no-privileges < "$scratch/restored.dump"
restored="$(docker exec "$cid" psql -U demos_test -d prod041_restore_fixture -Atc \
  "SELECT count(*) || ':' || count(distinct uri_votazione) || ':' || count(distinct uri_politico) FROM prod041_rehearsal.parlamento_voti_nominali;")"
[[ "$restored" == "2:2:1" ]] || { echo "REHEARSAL_RESTORE_CONTENT_MISMATCH" >&2; exit 3; }
docker exec "$cid" psql -v ON_ERROR_STOP=1 -U demos_test -d postgres \
  -c "DROP DATABASE prod041_restore_fixture" >/dev/null
echo "PROD041_SYNTHETIC_BACKUP_ENCRYPT_RESTORE_PASS"
