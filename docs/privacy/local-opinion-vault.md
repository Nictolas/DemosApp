# Local opinion vault (shadow)

This module is a device-side storage boundary for the citizen political vector.

Current status: shadow only. No production flow writes to it yet, and no legacy opinion data is migrated or deleted.

Privacy invariant for the future cutover:
- local matching reads the citizen vector from the device vault;
- Research receives only election scope;
- Identity does not receive the citizen vector for compatibility computation;
- missing/corrupt local state fails closed rather than falling back to identified server-side matching.

The initial implementation uses browser localStorage only as a testable scaffold. It is **not** the final security design for sensitive political data. Before activation, replace it with an encrypted device-bound store and define recovery/multi-device behavior.
