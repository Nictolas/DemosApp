# Opinion vault bootstrap (shadow)

This module defines a non-live migration boundary for moving the citizen's own political vector from the legacy Identity API into the encrypted device vault.

## Safety rules

- Read the encrypted device vault first.
- Never contact the legacy Identity API when the vault is already available.
- Legacy import is disabled by default and must be explicitly enabled by a migration/cutover decision.
- A successful legacy fetch is written to the encrypted vault before it is returned to matching.
- This module does not delete, rewrite, or migrate any server-side legacy rows.
- Production hooks are not switched by this scaffold.

A future controlled migration must separately decide when server-side legacy opinion rows can be deleted, how recovery/multi-device works, and how the native secure-storage dependency is approved and built.
