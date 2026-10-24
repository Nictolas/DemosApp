# DEMOS — experimental 2-bit opinion encoding (OP-41)

**Status: isolated prototype; no production usage, schema change, migration or rollout.**

## Wire format and invariants

Each catalog opinion consumes two actual bits in a `Buffer` (`BYTEA` candidate): `00` = unanswered (`NULL`), `01` = `f`, `10` = `c`, `11` = `i`. Four answers fit in a byte, highest bits first. The 94 currently published opinions therefore require **24 raw bytes** (188 meaningful bits plus four zero padding bits). This is not the PostgreSQL total-row size.

The catalog must be an **explicitly persisted, versioned, append-only mapping of immutable opinion IDs to indices**. Never infer positions from alphabetical ordering, `information_schema` order or mutable frontend lists. The prototype exposes a SHA-256 fingerprint to detect reorder; a future row format must associate each buffer with its catalog version/fingerprint. New opinions may only append, or require an explicit controlled migration; retired opinions must retain their old positions. Ensure all client versions receive the same canonical opinion IDs and legacy `f/c/i/NULL` API semantics.

The codec rejects unknown opinion IDs, invalid values, malformed buffers and nonzero padding. Normal patches cannot clear a vote; GDPR erasure follows a separate path. Encoding/decoding operate on copies, not shared mutable data.

## Concurrency: blocker before DB integration

A `Buffer` patch is **not itself concurrency-safe**. Two writers reading the same old buffer can overwrite one another. Any DB integration must update atomically, e.g. `BEGIN; SELECT ... FOR UPDATE;` decode/apply patch/write; `COMMIT`, or a versioned compare-and-swap retry. The test explicitly demonstrates the stale-snapshot failure. The existing production opinion route already uses `FOR UPDATE` on a pre-existing row, but first-insert races, per-opinion notification semantics, and migrations need separate integration tests. No new write path is enabled by this PR.

## Read-only production baseline, 24 October 2026

`opinioni_risposte`: 824 rows, 94 `TEXT` opinion columns, average `pg_column_size(row)` **754.26 B** (includes other columns and JSONB, not comparable directly with 24 B), heap **876,544 B**, indexes **57,344 B**, total **1,105,920 B**. `opinioni_domande`: 94 published opinions. These values can change. No user-level values were fetched.

## Verification

```sh
node --test api/tests/opinionTwoBitCodec.test.js
node scripts/benchmark-opinion-two-bit.js 94 5000
```

The synthetic benchmark compares raw packed byte counts and JavaScript JSON bytes, not actual PostgreSQL row/index/TOAST sizes. Next: build a **non-production PostgreSQL benchmark** with realistic NULL sparsity and JSONB source payloads; compare 94 TEXT columns vs BYTEA vs JSONB in heap, indexes, TOAST, query latency and write amplification. Measure Sondaggi aggregation, matching, consent filtering, account deletion, data export, Android legacy and append-only catalog migrations. Do not change production schema until results justify it and a rollback/compatibility plan is approved.
