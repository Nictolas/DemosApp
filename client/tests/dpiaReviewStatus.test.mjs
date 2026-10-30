import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const review = readFileSync(new URL("../../docs/privacy/DPIA_RELEASE_RECONCILIATION_2026-10-30.md", import.meta.url), "utf8");
const dpia = readFileSync(new URL("../../DPIA_DemosApp.md", import.meta.url), "utf8");

test("historic DPIA is prominently marked as pending post-release reconciliation", () => {
  assert.match(dpia.slice(0, 1500), /NON APPROVATA/i);
  assert.match(dpia.slice(0, 1500), /DPIA_RELEASE_RECONCILIATION_2026-10-30/);
});
test("DPIA reconciliation retains the open evidence gates, not unverified compliance claims", () => {
  assert.match(review, /Stato:\*\* REVISIONE APERTA — NON APPROVATA/);
  for (const marker of ["QA ANDROID FISICO NON ESEGUITO", "B2 NON CERTIFICATO", "PERIODI NON ATTESTATI", "PR #376", "DPIA NON APPROVATA", "Axiom", "Backblaze B2", "parere DPO"]) {
    assert.ok(review.includes(marker), `Missing unresolved review gate: ${marker}`);
  }
  assert.doesNotMatch(review, /GDPR (?:certificato|conforme al 100%)/i);
});
