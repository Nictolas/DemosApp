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

test("FCM, Android, and the notification feed preserve the exact verified final-ballot deep link", () => {
  const item = read("client/src/pages/Notifiche/components/NotificaItem.tsx");
  const sw = read("client/public/firebase-messaging-sw.js");
  const native = read("client/src/hooks/useNativePush.ts");
  assert.match(item, /new URLSearchParams\(window\.location\.search\)\.get\('final_vote'\)/);
  assert.match(sw, /parliament_final_vote/);
  assert.match(native, /case 'parliament_final_vote':/);
  assert.match(native, /target\.pathname.*target\.search/);
});

test("superseded notification push links still offer and open a verified final-ballot archive record", () => {
  const feed = read("client/src/pages/Notifiche/index.tsx");
  const archive = read("client/src/pages/VotiPoliticiFinali.tsx");
  assert.match(feed, /latestNotificationMatches/);
  assert.match(feed, /voti-politici\?final_vote=/);
  assert.match(archive, /new URLSearchParams\(window\.location\.search\)\.get\("final_vote"\)/);
  assert.match(archive, /data\.find\(v => v\.openpolis_id === id && isRecentFinale\(v\)\)/);
  assert.match(archive, /handledDeepLink/);
});

test("verified parliamentary ballots use the same chronological list as all notifications", () => {
  const list = read("client/src/pages/Notifiche/components/ListaNotifiche.tsx");
  assert.match(list, /data\.notifiche\.map\(\(notifica\) => \(/);
  assert.doesNotMatch(list, /Le votazioni dei tuoi rappresentanti|Altre notifiche|finalParliament|otherNotices/);
  assert.match(list, /<NotificaItem/);
});

test("selected Peppe De Cristofaro resolves verified Senate Giuseppe roll-call and still validates status", () => {
  const dialog=read("client/src/pages/Notifiche/components/FinalParliamentBallotDialog.tsx");
  assert.match(dialog, /representative === "peppe de cristofaro"/);
  assert.match(dialog, /de cristofaro giuseppe/);
  assert.match(dialog, /memberVariants\.has\(normalized\(m\.name\)\)/);
  assert.match(dialog, /ownMatches\.length === 1 && ownMatches\[0\]\.vote === notifica\.voto/);
});
