# Account activity migration plan (shadow)

This plan is intentionally non-executable in production until explicit approval.

1. Create `identity.account_activity` with forced RLS.
2. Backfill every account idempotently from `MAX(active_sessions.last_activity)`; when no session evidence exists, use the account creation timestamp so missing rows never become an accidental deletion signal.
3. Enable dual-write from successful auth activity to both the session store and lifecycle store.
4. Validate: every account has a lifecycle row and no lifecycle timestamp lags a known session timestamp.
5. Observe dual-write parity before cutover.
6. Cut the inactivity policy read from legacy session aggregation to `identity.account_activity` only after validation.
7. Rollback by switching reads back to legacy aggregation. Preserve lifecycle rows during rollback; deleting them would destroy evidence.

No schema application, backfill, dual-write activation or cutover is performed by this commit.

## Shadow dual-write and parity gate

A non-wired shadow mirror can copy successful Identity activity into the lifecycle store. Mirror failure returns `mirrored:false` and may emit only a fixed failure code, so enabling observation later does not require logging account identifiers. The legacy authentication write remains authoritative during this phase; mirror failure must not break login. A parity checker counts missing lifecycle rows and rows lagging `MAX(active_sessions.last_activity)`. Cutover is allowed only when both counts are zero. These helpers are not connected to production auth by this commit.
