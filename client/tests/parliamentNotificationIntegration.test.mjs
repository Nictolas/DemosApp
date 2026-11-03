import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

test("parliamentary notifications open a verified in-page detail when an Openpolis ID exists", () => {
  const item = read("client/src/pages/Notifiche/components/NotificaItem.tsx");
  const detail = read("client/src/pages/Notifiche/components/FinalParliamentBallotDialog.tsx");
  assert.match(item, /notifica\.openpolis_id/);
  assert.match(item, /setFinalBallotOpen\(true\)/);
  assert.match(item, /<FinalParliamentBallotDialog/);
  assert.match(item, /!notifica\.openpolis_id &&/);
  assert.match(detail, /votazioni-finali-decisive\//);
  assert.match(detail, /open={open}/);
  assert.match(detail, /max-h-\[90dvh\] overflow-y-auto/);
  assert.match(detail, /La spiegazione del testo ufficiale sarà aggiunta separatamente/);
});

test("the representative's source vote requires one exact name match and equal recorded status", () => {
  const detail = read("client/src/pages/Notifiche/components/FinalParliamentBallotDialog.tsx");
  assert.match(detail, /ownMatches\.length === 1/);
  assert.match(detail, /ownMatches\[0\]\.vote === notifica\.voto/);
  assert.match(detail, /Nessun voto viene attribuito/);
  assert.match(detail, /non sito istituzionale del Senato/);
  assert.match(detail, /Assenze, missioni e presenze senza voto non sono voti contrari/);
});

test("the client notification model retains both legacy and new verified ballot IDs", () => {
  const types = read("client/src/pages/Notifiche/types/index.ts");
  assert.match(types, /uri_votazione\?: string/);
  assert.match(types, /openpolis_id\?: string \| null/);
  assert.match(types, /votazione_titolo\?: string \| null/);
});
