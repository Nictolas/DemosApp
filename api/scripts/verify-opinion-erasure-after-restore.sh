#!/usr/bin/env bash
set -euo pipefail
# DOC-049 CI only: deliberately restore a backup taken BEFORE revocation.
# Strict local-only guard; never export or restore any live DEMOS data.
if [[ "$GITHUB_ACTIONS" != "true" ||
      "$OPINION_BENCH_EPHEMERAL" != "yes" ||
      "$PGHOST" != "127.0.0.1" ||
      "$PGPORT" != "5432" ||
      "$PGDATABASE" != "opinion_bitset_ci" ||
      "$PGUSER" != "postgres" ||
      "$PGPASSWORD" != "synthetic-only" ]]; then
  echo "Refusing stale-backup experiment outside disposable CI PG17" >&2
  exit 1
fi
if [[ -z "$RUNNER_TEMP" ]] || ! command -v docker >/dev/null 2>&1; then
  echo "GitHub-hosted Linux runner and Docker required" >&2
  exit 1
fi
image="postgres:17"
restore_db="opinion_erasure_restore_ci"
backup="$(mktemp "$RUNNER_TEMP/demos-erasure-stale.XXXXXXXX")"
trap 'rm -f "$backup"' EXIT

# Create dummy responses in two catalog versions and a SEALED restore gate.
OPINION_ERASURE_PHASE=seed node api/scripts/verify-opinion-erasure-after-restore.js

# The revocation journal is deliberately NOT part of this older backup.
docker run --rm --network host -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint pg_dump "$image" \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --format=custom --no-owner --no-acl \
  --table=public.ci_erasure_catalog \
  --table=public.ci_erasure_subjects \
  --table=public.ci_erasure_votes \
  --table=public.ci_erasure_requests \
  --table=public.ci_erasure_gate \
  > "$backup"
test -s "$backup"
docker run --rm -i --network host --entrypoint pg_restore "$image" \
  --list < "$backup" > /dev/null

# Revoke consent and purge the source CI records; record a new event in
# the journal table excluded from this intentionally stale snapshot.
OPINION_ERASURE_PHASE=revoke node api/scripts/verify-opinion-erasure-after-restore.js

# Restore the OLD snapshot into a different empty throwaway database.
docker run --rm --network host -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint createdb "$image" \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$restore_db"
docker run --rm -i --network host -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint pg_restore "$image" --exit-on-error --single-transaction \
  --no-owner --no-acl -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
  -d "$restore_db" < "$backup"

# Negative control: raw restored rows contain a deleted vote. The
# demo gate blocks reads; controlled replay deletes the resurrected rows.
OPINION_ERASURE_PHASE=verify \
  OPINION_ERASURE_RESTORE_DB="$restore_db" \
  node api/scripts/verify-opinion-erasure-after-restore.js

echo "OPINION_ERASURE_STALE_PGDUMP_CLI_PASS"
echo "OPINION_ERASURE_STALE_PGDUMP_CLI_BYTES=$(wc -c < "$backup" | tr -d ' ')"
