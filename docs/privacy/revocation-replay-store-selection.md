# Distributed replay-store selection criteria

This shadow checkpoint defines minimum capabilities for a future distributed replay-store adapter. It does not select a vendor or provision infrastructure.

A candidate is eligible for an isolated POC only if it can explicitly provide all of the following:

- atomic create-if-absent semantics for a replay token;
- native expiry;
- bounded retention;
- fail-closed behavior on unavailable or indeterminate storage;
- opaque keys only;
- no Identity or Research identity metadata in the replay record.

Passing this checklist is necessary but not sufficient for production. The candidate must also pass the reusable contract tests against an isolated test instance, and operational review must cover concurrency across processes, retention, logging, backups, access controls, region/data residency, deletion behavior and failure recovery.

No Redis, PostgreSQL, managed cache or other storage is selected or created by this checkpoint.
