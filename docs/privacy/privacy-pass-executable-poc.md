# Privacy Pass Blind RSA executable POC

This harness mirrors Cloudflare's current public-verifiable example using
@cloudflare/privacypass-ts 0.9.0 and BlindRSAMode.PSS.

It is intentionally not wired into package.json yet. The Demos backend has a committed npm
lockfile, so adding the package without regenerating package-lock.json with npm would create an
inconsistent dependency state.

Verified upstream facts at the checkpoint:
- @cloudflare/privacypass-ts package version: 0.9.0
- engines: Node >=20 (Demos requires Node >=22)
- pinned upstream dependency: @cloudflare/blindrsa-ts 0.4.6
- official flow: createTokenRequest -> issue -> finalize -> verify
- upstream repository includes interoperability vectors from Go/Rust implementations.

Next safe execution step:
1. In an isolated checkout of api/, run npm install --save-exact @cloudflare/privacypass-ts@0.9.0.
2. Run node pocs/privacyPassBlindRsa.poc.js.
3. Run existing privacy-shadow tests.
4. Review package-lock diff and dependency tree before committing both manifest and lockfile.

Do not install this dependency directly in production or wire this POC to a route.
