-- Private, synthetic-only Demos-Staging QA schema hardening.
-- Resolves missing primary-key and unindexed-FK INFO advisories for the
-- newly created f12_poe_ci tables; does not touch any public table or identity.
ALTER TABLE f12_poe_ci.political_mandates
  ADD CONSTRAINT political_mandates_pk PRIMARY KEY(user_id,source,starts_at);
ALTER TABLE f12_poe_ci.political_candidacies
  ADD CONSTRAINT political_candidacies_pk PRIMARY KEY(user_id,source,starts_at);
COMMENT ON TABLE f12_poe_ci.users IS
  'Synthetic-only P/O/E regression; no public API grants; RLS enabled with intentionally NO policies.';
COMMENT ON TABLE f12_poe_ci.political_mandates IS
  'Synthetic-only test mandates; RLS deny-all for Data API roles is intentional.';
COMMENT ON TABLE f12_poe_ci.political_candidacies IS
  'Synthetic-only test candidacies; RLS deny-all for Data API roles is intentional.';
