#!/usr/bin/env bash
# Disposable PostgreSQL concurrency test. Requires PG* env set by CI service.
set -euo pipefail

sql="SELECT demos_internal.import_official_political_mandate(
 '22222222-2222-4222-8222-222222222222'::uuid,
 'SENATO','90002',19,'2022-10-13'::date,NULL,
 'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=90002',
 'POL-015-review-parallel','reviewer-fixture');"

p1=$(mktemp)
p2=$(mktemp)
trap 'rm -f "$p1" "$p2"' EXIT
psql -X -v ON_ERROR_STOP=1 -tA -c "$sql" > "$p1" &
pid1=$!
psql -X -v ON_ERROR_STOP=1 -tA -c "$sql" > "$p2" &
pid2=$!
wait "$pid1"
wait "$pid2"
grep -q '"outcome": "inserted"' "$p1" || grep -q '"outcome": "inserted"' "$p2"
grep -q '"outcome": "unchanged"' "$p1" || grep -q '"outcome": "unchanged"' "$p2"
actual="$(psql -X -v ON_ERROR_STOP=1 -tA -c "SELECT count(*) FROM public.political_mandates WHERE source = 'OFFICIAL_VERIFIED' AND legacy_context->>'official_id'='90002';")"
test "$actual" = "1" || { echo "Expected exactly one verified mandate, got $actual" >&2; exit 1; }
echo "PASS: concurrent same-official-ID attempts create exactly one mandate"
