import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const component = fs.readFileSync(path.join(root, "client/src/components/VotazioniFinaliOpenpolis.tsx"), "utf8");
const page = fs.readFileSync(path.join(root, "client/src/pages/VotiParlamento.tsx"), "utf8");
const sourceEndpoint = fs.readFileSync(path.join(root, "api/routes/voti-politici.js"), "utf8");

test("final-vote feed reads existing confirmed source table, never creates synthetic votes", () => {
  assert.match(component, /voti-politici\/votazioni-finali-decisive\?limit=30/);
  assert.match(sourceEndpoint, /loadOpenpolisVotazioniFinali\(pool, limit\)/);
  assert.match(page, /<VotazioniFinaliOpenpolis\s*\/>/);
  assert.doesNotMatch(component, /INSERT INTO|UPDATE votazioni_parlamento|sendEachForMulticast|fetch\([^)]*firebase/);
});
test("source links are restricted to Openpolis voting pages", () => {
  assert.match(component, /parsed\.protocol !== "https:"/);
  assert.match(component, /parsed\.hostname !== "parlamento19\.openpolis\.it"/);
  assert.match(component, /rel="noopener noreferrer"/);
});
test("UI does not use unreliable date-only combined matches", () => {
  assert.match(page, /const combinedCamera: VotazioneParlamento\[\] = \[\]/);
  assert.match(page, /const combinedSenato: VotazioneParlamento\[\] = \[\]/);
  assert.match(page, /Abbinamento SPARQL \+ Openpolis disattivato/);
});
test("visible text does not claim a final vote is an enacted law", () => {
  assert.match(component, /L'approvazione di una votazione non implica/);
  assert.match(component, /classificate come finali da Openpolis/);
});
