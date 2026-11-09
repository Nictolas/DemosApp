const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const client = path.resolve(__dirname, "../../client/src");
const read = (p) => fs.readFileSync(path.join(client, p), "utf8");

test("Admin proposals URL has a real, auth-protected page instead of a white screen", () => {
  const app = read("App.tsx");
  const page = read("pages/Gestisci/ProposteSoggettiStato.tsx");
  assert.match(app, /<Route path="\/gestisci\/proposte-soggetti">/);
  assert.match(app, /<ProtectedRoute path="\/gestisci\/proposte-soggetti" component=\{ProposteSoggettiStato\}/);
  assert.match(page, /hasAdminCapability\(user\)/);
  assert.match(page, /<Redirect to="\/auth"/);
  assert.match(page, /<Redirect to="\/gestisci"/);
  assert.match(page, /La gestione delle proposte non è ancora attiva/);
});

test("Unavailable production page never reads or mutates personal proposals", () => {
  const page = read("pages/Gestisci/ProposteSoggettiStato.tsx");
  assert.doesNotMatch(page, /(?:apiRequest|fetch|axios|useQuery|useMutation)\s*\(/);
  assert.doesNotMatch(page, /(?:subject-proposals|\/api\/grazia)/);
  assert.match(page, /non legge né invia dati personali/);
});

test("Gestisci exposes an accurately marked status entry", () => {
  const sections = read("pages/Gestisci/constants/sections.ts");
  const hubs = read("pages/Gestisci/constants/hubs.ts");
  assert.match(sections, /id: "proposte-soggetti"/);
  assert.match(sections, /route: "\/gestisci\/proposte-soggetti"/);
  assert.match(sections, /buttonText: "Stato proposte"/);
  assert.match(hubs, /sectionIds: \["utenti", "riconoscimenti", "proposte-soggetti"\]/);
});