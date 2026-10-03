# Durable batched revocation relay (shadow)

Status: shadow design and test implementation only. No route, queue, scheduler, database migration, service, secret, or production deployment is introduced here.

## Boundary

A relay batch contains only opaque revocation capabilities. The batch envelope is exactly `{ version, items }`; every item is exactly `{ capability }`. Account IDs, user IDs, participant IDs/public keys, credential digests, opinion data, timestamps, request IDs and receipts are forbidden at the Research boundary.

The privacy threshold is at least 8 distinct capabilities. The Identity-side builder copies and cryptographically shuffles the items before they cross the boundary. Duplicate capabilities cannot be used to satisfy the threshold.

## Durable all-or-nothing acknowledgement

Research validates the complete batch before opening a transaction, enables `synchronous_commit`, and applies every capability inside the same PostgreSQL transaction. It returns only one aggregate acknowledgement:

- `{ accepted: true, durable: true }` after every capability matched and COMMIT completed;
- `{ accepted: false, durable: false }` if any capability is unknown, with the whole transaction rolled back.

There are no per-item receipts, participant identifiers, indexes or status details in the acknowledgement. This lets a future Identity relay destroy the escrow set only after the whole shuffled batch is durably committed.

Retries remain idempotent because applying a valid capability to an already-revoked participant keeps it revoked.

## Delay policy inside Identity

`identityRevocationRelayDelayPolicy` is a pure shadow policy. Its queue snapshot accepts only `{ accountId, queuedAt }` inside the Identity trust domain; it explicitly rejects plaintext capabilities and extra fields. It dispatches only when the configured minimum delay has elapsed for at least the configured privacy threshold, choosing the oldest eligible cohort. The raw capability remains encrypted in the existing Identity escrow until the actual dispatch stage.

The delay values are intentionally not hard-coded as production policy. A caller must provide `minimumDelayMs` and `maximumHoldMs`; no timer, scheduler or durable queue is installed by this checkpoint.

## Low-volume conflict: privacy threshold vs bounded latency

With fewer than the privacy threshold of eligible revocations, a system cannot simultaneously guarantee both a fixed minimum cohort and a hard maximum deletion latency unless it introduces another privacy mechanism such as reviewed cover traffic or an anonymizing relay. The shadow policy therefore never lowers the cohort threshold. If `maximumHoldMs` is exceeded while the cohort is still too small, it returns `PRIVACY_THRESHOLD_BLOCKS_BOUNDED_LATENCY` with `requiresIntervention: true` and dispatches nothing.

Before production activation, this conflict needs an explicit architectural decision and DPIA treatment. Timing metadata such as `queuedAt` must remain in Identity and must never be transmitted to Research.
