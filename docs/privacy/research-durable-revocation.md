# Durable Research revocation (shadow)

This checkpoint closes the acknowledgement gap between Identity escrow release and Research revocation without creating a production route, queue or deployment.

## Durable acknowledgement rule

Research may return `{ accepted: true, durable: true }` only after PostgreSQL has committed the terminal revocation state. The shadow service:

1. accepts only the existing relay item `{ capability }`;
2. hashes the opaque capability and never stores or logs the plaintext;
3. starts a database transaction and sets `synchronous_commit = on`;
4. updates the matching pseudonymous `research.participants` row to `status = 'revoked'` and expires it immediately;
5. returns the durable acknowledgement only after `COMMIT` succeeds.

An unknown capability returns `{ accepted: false, durable: false }`. A retry for an already-revoked participant remains idempotently accepted because the persistent `revoked` row is itself the durable state. If commit fails, no durable acknowledgement is emitted and Identity must keep its encrypted escrow.

This is a Research-domain primitive only. It does not add Identity identifiers, participant IDs, network metadata, a route, a queue, production credentials or a deployed relay.

## Enrollment and terminal revocation

New shadow enrollment now requires a random revocation capability of at least 256 bits. Research stores only its SHA-256 digest in `research.participants`; the plaintext capability is transient.

Enrollment no longer updates an existing participant key on conflict. A new enrollment credential therefore cannot reactivate or extend an existing/revoked pseudonymous participant. Renewal is restricted to `active` or `expired` rows; `revoked` is terminal.

## Still required before production

The network/queue layer still needs privacy-preserving batching/delay, abuse controls, bounded retention and operational evidence that it cannot recreate an Identity-to-Research mapping. PostgreSQL durability settings and failover semantics must be verified in the eventual Research environment. No real database schema or service is activated by this checkpoint.
