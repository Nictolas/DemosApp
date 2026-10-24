#!/usr/bin/env bash
set -euo pipefail

# CI ONLY: actual pg_dump -Fc / pg_restore round trip of five synthetic
# opinion/ledger tables. Runs exclusively against the GitHub Actions
# PostgreSQL 17 service; NEVER targets a DEMOS project or Supabase.
if [[ "$GITHUB_ACTIONS" != "true" ||
      "$OPINION_BENCH_EPHEMERAL" != "yes" ||
      "$PGHOST" != "127.0.0.1" ||
      "$PGPORT" != "5432" ||
      "$PGDATABASE" != "opinion_bitset_ci" ||
      "$PGUSER" != "postgres" ||
      "$PGPASSWORD" != "synthetic-only" ]]; then
  echo "Refusing dump or restore outside disposable CI PostgreSQL" >&2
  exit 1
fi
if [[ -z "$RUNNER_TEMP" ]] || ! command -v docker >/dev/null 2>&1; then
  echo "GitHub-hosted Linux runner with Docker and RUNNER_TEMP is required" >&2
  exit 1
fi

restore_db="opinion_bitset_restore_ci"
# Use the same PostgreSQL 17 CLI version as the disposable service.
image="postgres:17"
export_file="$(mktemp "$RUNNER_TEMP/demos-opinions-archive.XXXXXXXX")"
bad_file="$(mktemp "$RUNNER_TEMP/demos-opinions-truncated.XXXXXXXX")"
trap 'rm -f "$export_file" "$bad_file"' EXIT

docker run --rm --network host \
  -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint pg_dump "$image" \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
  -d "$PGDATABASE" -Fc --no-owner --no-acl \
  --table=public.ci_idem_catalog \
  --table=public.ci_idem_head \
  --table=public.ci_idem_subjects \
  --table=public.ci_idem_votes \
  --table=public.ci_idem_requests \
  > "$export_file"

test -s "$export_file"
# A deliberately truncated synthetic archive must be rejected; never
# try restoring it into either database.
head -c 12 "$export_file" > "$bad_file"
docker run --rm -i --network host \
  --entrypoint pg_restore "$image" --list \
  < "$export_file" > /dev/null
if docker run --rm -i --network host \
   --entrypoint pg_restore "$image" --list \
   < "$bad_file" > /dev/null 2>&1; then
  echo "Invalid truncated archive unexpectedly passed pg_restore --list" >&2
  exit 1
fi

docker run --rm --network host \
  -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint createdb "$image" \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$restore_db"

# Restore into a DISTINCT, EMPTY database in the disposable service.
docker run --rm -i --network host \
  -e PGPASSWORD="$PGPASSWORD" \
  --entrypoint pg_restore "$image" \
  --exit-on-error --single-transaction --no-owner --no-acl \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
  -d "$restore_db" < "$export_file"

OPINION_RESTORE_DB="$restore_db" \
  node api/scripts/verify-opinion-pgdump-restore.js

echo "OPINION_PGDUMP_RESTORE_CLI_PASS"
echo "OPINION_PGDUMP_RESTORE_CLI_BYTES=$(wc -c < "$export_file" | tr -d ' ')"
