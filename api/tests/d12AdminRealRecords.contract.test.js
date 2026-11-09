"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const page = fs.readFileSync(path.join(root, "client/src/pages/Gestisci/ProposteSoggetti.tsx"), "utf8");
const api = fs.readFileSync(path.join(root, "api/routes/subject-proposals.js"), "utf8");

test("Admin pending section uses database API only: no synthetic fixtures or impersonation", () => {
  assert.doesNotMatch(page, /DEMO_SUBJECT_PROPOSALS|showDemo|MODALITÀ TEST|FITTIZIO|esempi TEST/);
  assert.equal(fs.existsSync(path.join(root, "client/src/pages/Gestisci/demoSubjectProposals.ts")), false);
  assert.match(page, /apiRequest\("GET", "\/api\/subject-proposals\/admin"\)/);
  assert.match(page, /pending\.map\(p =>/);
  assert.match(page, /Nessuna proposta in attesa/);
});

test("Private admin API is tied to actual pending DB records and requires admin authorization", () => {
  assert.match(api, /router\.get\('\/admin', verifyToken, requireAdmin/);
  assert.match(api, /FROM subject_proposals\s+WHERE status='pending'/);
  assert.match(api, /router\.post\('\/admin\/:id\/decision', verifyToken, requireAdmin/);
  assert.match(api, /if \(decision === 'approve' && !isNominationWriteEnabled\(\)\)/);
  assert.doesNotMatch(api, /CANDIDATO FITTIZIO|NORMA FITTIZIA/);
});