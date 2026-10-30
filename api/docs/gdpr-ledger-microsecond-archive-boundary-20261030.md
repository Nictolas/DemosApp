# GDPR ledger B2 archive-size boundary (synthetic, 30 October 2026)

`recordEvent` validates an event before its SQL INSERT even when the outbox is disabled. PostgreSQL `NOW()` can return six-digit microsecond timestamps, while the former synthetic preflight used a shorter three-digit timestamp. An event close to the 8192-byte cap could therefore pass preflight but become unarchivable after SQL insertion.

The Draft now validates against a six-digit nonzero microsecond timestamp. A synthetic boundary regression confirms the three-byte difference and rejects an over-limit payload before any SQL call, in both outbox OFF and ON modes. This prevents one specific class of newly committed unarchivable ledger events; it does **not** validate historical rows or prove complete independent B2 archival.

No B2, real SQL, secrets, personal records, restore, merge or deploy. PR #374 remains Draft; issue #296 and recovery remain NO-GO pending independent integrity/completeness, isolation and controlled restore.
