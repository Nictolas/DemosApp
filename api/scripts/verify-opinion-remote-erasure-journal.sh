#!/usr/bin/env bash
set -euo pipefail

# DOC-050 CI-only: two distinct PostgreSQL 17 SERVER PROCESSES,
# one separate dedicated source database, one independent journal
# container and a pg_dump created before erasure. No production data.
if [[ "$GITHUB_ACTIONS" != "true" ||
      "$OPINION_BENCH_EPHEMERAL" != "yes" ||
      "$PGHOST" != "127.0.0.1" ||
      "$PGPORT" != "5432" ||
      "$PGDATABASE" != "opinion_bitset_ci" ||
      "$PGUSER" != "postgres" ||
      "$PGPASSWORD" != "synthetic-only" ]]; then
  echo "Refusing independent-journal test outside disposable CI" >&2
  exit 1
fi
if [[ -z "$RUNNER_TEMP" || -z "$GITHUB_RUN_ID" ]] ||
   ! command -v docker >/dev/null 2>&1; then
  echo "GitHub Actions runner with Docker required" >&2
  exit 1
fi

journal_name="demos-ci-journal-050-$GITHUB_RUN_ID"
source_db="opinion_remote_source_ci"
restored_db="opinion_remote_restored_ci"
backup="$(mktemp "$RUNNER_TEMP/demos-old-dump-050.XXXXXXXX")"
cleanup() {
  rm -f "$backup"
  docker rm -f "$journal_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
image="postgres:17"
export OPINION_REMOTE_JOURNAL="synthetic-journal-only"

# The independent PG17 journal uses another process, container, database,
# TCP port, and cluster storage (still the SAME ephemeral runner machine).
docker run --rm -d --name "$journal_name" \
  -p 127.0.0.1:55432:5432 \
  -e POSTGRES_DB=opinion_remote_journal_ci \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=synthetic-only \
  "$image" > /dev/null

ready=0
for _attempt in $(seq 1 70); do
  if docker exec "$journal_name" pg_isready -q \
      -U postgres -d opinion_remote_journal_ci; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo "Independent journal PostgreSQL did not become ready" >&2
  exit 1
fi

# Dedicated synthetic primary DB, unrelated to opinion_bitset_ci.
docker run --rm --network host -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint createdb "$image" \
  -h 127.0.0.1 -p 5432 -U postgres "$source_db"

OPINION_REMOTE_PHASE=seed node api/scripts/verify-opinion-remote-erasure-journal.js

# Store the backup BEFORE the two revocations.
docker run --rm --network host -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint pg_dump "$image" \
  -h 127.0.0.1 -p 5432 -U postgres -d "$source_db" \
  -Fc --no-owner --no-acl \
  --table=public.ci_remote_catalog \
  --table=public.ci_remote_subjects \
  --table=public.ci_remote_votes \
  --table=public.ci_remote_requests \
  --table=public.ci_remote_gate \
  > "$backup"
test -s "$backup"

# Journal events commit FIRST in a separate PG server; primary deletes
# and consent flags are applied transactionally to its own database.
OPINION_REMOTE_PHASE=revoke node api/scripts/verify-opinion-remote-erasure-journal.js

# Destroy the dedicated source database. Do NOT drop opinion_bitset_ci.
docker run --rm --network host -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint dropdb "$image" \
  -h 127.0.0.1 -p 5432 -U postgres --force "$source_db"

# Restore deliberately stale dump to another dedicated database.
docker run --rm --network host -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint createdb "$image" \
  -h 127.0.0.1 -p 5432 -U postgres "$restored_db"
docker run --rm -i --network host -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint pg_restore "$image" \
  --exit-on-error --single-transaction --no-owner --no-acl \
  -h 127.0.0.1 -p 5432 -U postgres -d "$restored_db" \
  < "$backup"

# Independent journal survives source DB destruction. Verify that a
# restricted reader role cannot see resurrected opinions until all
# remote revocations have been authenticated and reconciled.
OPINION_REMOTE_PHASE=verify node api/scripts/verify-opinion-remote-erasure-journal.js

# DOC-051 extends the same two live PG17 processes with real remote
# row-lock coordination and per-read watermark validation. The journal
# container is torn down only after both experiments have finished.
OPINION_REMOTE_CUTOVER=synthetic-fence-only \
  node api/scripts/verify-opinion-remote-cutover-fence.js

# DOC-052 measures the additional remote lock/head-HMAC overhead against
# the same SQL protected view with synthetic warm and concurrent reads.
# This runs after DOC-051, before the journal container is removed.
OPINION_REMOTE_CUTOVER=synthetic-fence-only \
  OPINION_REMOTE_BENCH=synthetic-measure-only \
  node api/scripts/benchmark-opinion-remote-fence.js

# DOC-053: a third, isolated *synthetic* database for local admission.
# The journal container remains alive; no changes to opinion_bitset_ci.
docker run --rm --network host -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint createdb "$image" \
  -h 127.0.0.1 -p 5432 -U postgres opinion_local_fence_ci
OPINION_LOCAL_FENCE=ci-local-only-053 \
  node api/scripts/verify-opinion-local-admission-fence.js

echo "OPINION_REMOTE_JOURNAL_PGDUMP_CLI_PASS"
echo "OPINION_REMOTE_JOURNAL_PGDUMP_CLI_BYTES=$(wc -c < "$backup" | tr -d ' ')"
