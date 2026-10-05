# CP-056 - Incident Lifecycle & Dedup Safety v0.56

A regression test exposed a real lifecycle gap: repeated evidence for the same open finding preserved the original incident severity even when the new finding became more severe. That could delay downstream priority escalation.

The in-memory IncidentManager now applies monotonic severity updates for an existing open/acknowledged incident: severity may increase (`high`→`critical`) but cannot decrease. Count remains monotonic as before.

Additional invariants verify that acknowledged incidents are not implicitly reopened, resolved incidents are not mutated by later evidence (a later occurrence creates a new open incident), and transitions for unknown incident IDs are inert.

The change affects only local incident metadata aggregation. It introduces no execution capability, network request, database migration, production write, session action, or Action Runner.
