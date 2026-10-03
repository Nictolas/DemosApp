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

## Consumer boundary

`citizenOpinionVectorSource` is the single shadow boundary intended for future matching consumers. Candidate/representative matching should depend on this boundary rather than on the legacy Identity response shape. It is not wired into live hooks yet.

## Legacy import adapter

The shadow legacy adapter is restricted to the authenticated own-profile endpoint and immediately projects the response to the validated opinion vector. Profile fields, email, tokens, and other surrounding Identity response data are not returned to the privacy matching layer.

The Android shadow composition now exposes `createNativeAndroidCitizenOpinionVectorSourceFromIdentity`, which binds bootstrap to the minimized own-profile adapter rather than requiring matching consumers to construct a legacy fetcher themselves.

## Local matching pipeline invariant

The shadow local matching pipeline reads the citizen vector locally first, then requests only public political vectors by scope from Research with credentials omitted. The citizen vector is passed only to the local matcher and is never serialized into the Research request. If the private vector source fails, Research is not contacted.

## Runtime selection policy

The shadow runtime policy keeps legacy matching as the default until both local matching and an explicit vault cutover phase are active. Once privacy-first mode is selected, failures are propagated fail-closed; they must not trigger a silent fallback to server-side legacy matching.

The runtime executor accepts separate legacy and privacy-first callbacks and executes exactly one. A privacy-first exception is rethrown; the legacy callback is never invoked as recovery. This is the hook-facing boundary for the eventual cutover.

## Live cutover gate

`getLivePoliticalMatchingRuntimeMode` is the single environment-derived gate intended for the live hook. Existing local-matching configuration alone is insufficient: privacy-first requires both a configured Research endpoint and an explicit vault cutover phase. With current/default vault configuration the live mode remains legacy.
