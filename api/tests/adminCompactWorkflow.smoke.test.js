'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Notifications are opened directly from the Admin hub without a single-item submenu', () => {
  const hubs = read('client/src/pages/Gestisci/constants/hubs.ts');
  assert.match(hubs, /id: "comunicazioni"/);
  assert.match(hubs, /title: "Notifiche"/);
  assert.match(hubs, /route: "\/notifiche-totali"/);
  const grid = read('client/src/pages/Gestisci/components/SectionsGrid.tsx');
  assert.match(grid, /if \(dpoReadOnly\)/);
  assert.match(grid, /\/dpo\?section=/);
  assert.match(grid, /if \(hub\.route\)/);
});

test('Only one voting entry is shown under institutional data, keeping old URLs as deep links', () => {
  const hubs = read('client/src/pages/Gestisci/constants/hubs.ts');
  const sections = read('client/src/pages/Gestisci/constants/sections.ts');
  const page = read('client/src/pages/Gestisci/VotazioniAdmin.tsx');
  const app = read('client/src/App.tsx');
  assert.match(hubs, /"votazioni-admin"/);
  assert.doesNotMatch(hubs, /"eci",/);
  assert.doesNotMatch(hubs, /"voti-politici",/);
  assert.match(sections, /route: "\/gestisci\/votazioni"/);
  for (const tab of ['nazionali', 'europee', 'diagnostica']) assert.ok(page.includes('value="' + tab + '"'));
  for (const link of ['/voti-politici', '/voti-parlamento', '/voti-parlamento-europeo']) assert.ok(page.includes('href="' + link + '"'));
  assert.match(page, /hasAdminCapability\(user\)/);
  assert.match(app, /ProtectedRoute path="\/gestisci\/votazioni" component=\{VotazioniAdmin\}/);
  assert.match(app, /ProtectedRoute path="\/voti-parlamento-europeo"/);
});

test('Recognition portal has verified self-proposals but retains original civic-proposal approvals', () => {
  const recog = read('client/src/pages/Riconoscimenti.tsx');
  const proposals = read('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  const wrapper = read('client/src/pages/Gestisci/VerificheIdentita.tsx');
  const app = read('client/src/App.tsx');
  assert.match(recog, /Riconoscimenti e verifiche/);
  assert.match(recog, /\/gestisci\/verifiche-identita/);
  assert.match(wrapper, /scope="verification"/);
  assert.match(proposals, /scope === "verification" \? "attivisti" : "capo_stato"/);
  assert.match(proposals, /visibleCategories\.map\(category/);
  assert.match(proposals, /SELF_PROFILE_CATEGORIES\.has\(category\)/);
  assert.match(proposals, /attestVideoVerification\(p\)/);
  assert.match(proposals, /representative_role: role, role_evidence_kind: evidence/);
  assert.match(proposals, /\/api\/subject-proposals\/admin\/.*verify-profile/);
  assert.match(proposals, /\/api\/subject-proposals\/admin\/.*decision/);
  assert.match(app, /ProtectedRoute path="\/gestisci\/verifiche-identita" component=\{VerificheIdentita\}/);
});

test('Ops Center groups ten existing links in four accessible native disclosure sections', () => {
  const ops = read('client/src/pages/Admin/OpsCenter.tsx');
  for (const title of ["Salute", "Sicurezza", "Privacy", "Backup/Export"]) {
    assert.ok(ops.includes('>' + title + '</span>'), title);
  }
  assert.equal((ops.match(/<details /g) || []).length, 4);
  assert.equal((ops.match(/<Card className="border-slate-200\/70 bg-white\/90 shadow-sm">/g) || []).length, 10);
  assert.match(ops, /Database \(Neon\)/);
  assert.match(ops, /AI Cybersecurity Agent/);
  assert.match(ops, /\/security-center\/health/);
});
