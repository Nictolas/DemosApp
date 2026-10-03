-- DEMOS privacy-first Research renewal proof shadow overlay
-- STATUS: DESIGN / SHADOW ONLY. Do not apply automatically to production.

alter table research.proof_challenges
  drop constraint if exists proof_challenges_purpose_check;

alter table research.proof_challenges
  add constraint proof_challenges_purpose_check
  check (purpose in ('read-opinions-v1', 'renew-participant-v1'));
