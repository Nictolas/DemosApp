# CP-048 - Tailwind 4 Migration Isolation v0.48

## Scope

Local-only major migration of the client styling toolchain to remove the remaining Tailwind 3 production vulnerability chain. No GitHub push, GitHub Actions, deploy, production write, database migration, or Action Runner activation.

## Upgrade accepted

- `tailwindcss`: 3.x -> 4.3.3
- PostCSS integration moved to `@tailwindcss/postcss` 4.3.3
- `tailwind-merge`: 2.x -> 3.7.0 for Tailwind 4 class-conflict semantics
- direct `autoprefixer` dependency removed because Tailwind 4 handles the required prefixing through its new build pipeline
- `tailwindcss-animate` removed: it was installed but never registered in the Tailwind configuration, while the application's `animate-in` behavior is implemented by custom CSS
- the now-empty `tailwind.config.js` was removed by the official Tailwind upgrader

The official `@tailwindcss/upgrade` tool migrated 266 templates. The bulk changes are compatibility renames required by Tailwind 4, including gradient, shadow, radius, outline, shrink/grow, blur and related utility names. The migration was replayed from the clean CP-047 client after an initial validation pass so unrelated whitespace cleanup was not included in the checkpoint.

## Compatibility hardening

Tailwind 4 changes `space-y-*` from the Tailwind 3 sibling top-margin model to a previous-child bottom-margin model. That was not visually equivalent where children already had explicit bottom margins. The shared `CardHeader` and the legal-page `CardContent` spacing were therefore expressed with explicit sibling top-margin selectors (`[&>*+*]:mt-*`) to preserve Tailwind 3 layout semantics.

An isolated before/after visual check covered desktop authentication, mobile authentication, Privacy Policy and Accessibility pages. Authentication remained visually equivalent. After the spacing correction, the legal-page screenshot RMS deltas were approximately 0.17 and 0.33 respectively, i.e. effectively pixel-level parity apart from rendering noise.

## Dependency result

Production client audit before CP-048: 6 findings = 6 high.

Production client audit after CP-048: **0 findings**.

Full client audit before CP-048: 9 findings = 7 high + 2 moderate.

Full client audit after CP-048: **3 findings = 1 high + 2 moderate**. The residual findings are build/development tooling only:

- `vite`: high
- `esbuild`: moderate, transitive through Vite
- `@originjs/vite-plugin-commonjs`: moderate

These are deliberately deferred to an isolated Vite/build-tooling major checkpoint instead of being forced into the Tailwind migration.

## Local validation

- `git diff --check`: PASS
- `npm run test:security-preci`: PASS
- Security Agent tests: 328/328 PASS
- Vite production build with Tailwind 4: PASS
- `npx cap sync android`: PASS
- client production `npm audit --omit=dev`: 0 findings
- client full `npm audit`: 3 tooling-only findings
- repository still has no configured `lint` script; no lint command was invented or silently substituted

The native Capacitor/Gradle stack was not changed in this checkpoint; CP-047 already validated the Capacitor 7 Android build with JDK 21. CP-048 validates that the new web assets synchronize into the Android project successfully.

## Safety invariants

The AI Cybersecurity Agent remains shadow/read-only. No execution authority, real notification delivery, production credential, migration, write path, deploy, or Action Runner is enabled by this checkpoint.

## Next recommended checkpoint

CP-049 - Firebase Admin major isolation for the remaining API production moderate findings. After that, isolate the Vite/build-tooling major needed to clear the three remaining client development findings.