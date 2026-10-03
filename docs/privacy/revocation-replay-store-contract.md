# Shared replay-state contract (shadow)

This checkpoint defines only the application contract for a future shared replay store. It creates no database, cache, table, queue, route, service or deployment.

The store receives only an opaque replay token and a bounded TTL. The required operation is consumeOnce({ token, ttlSeconds }) and must return a boolean. A production adapter must implement this as one atomic operation so concurrent instances cannot both accept the same token.

TTL is mandatory and bounded to 60 seconds through 24 hours in this shadow contract. The exact production retention window remains a policy decision and must be justified against deletion latency, retry behavior and abuse resistance.

The store must not receive account IDs, participant IDs, public keys, emails, opinion vectors or request-origin metadata. Logging must not recreate those relationships.

Choosing or provisioning Redis, PostgreSQL or another shared store, and any production persistence, requires a separate approved checkpoint.
