'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('yellow personal reminder is a compact link to one protected completion route', () => {
  const card = read('client/src/pages/Profilo/components/CompleteOpinionsCallout.tsx');
  const app = read('client/src/App.tsx');
  assert.match(card, /href="\/opinioni-da-completare"/);
  assert.doesNotMatch(card, /aria-expanded|<ul|onClick/);
  assert.match(app, /import OpinioniDaCompletare from "\.\/pages\/OpinioniDaCompletare"/);
  assert.match(app, /<Route path="\/opinioni-da-completare">\s*<ProtectedRoute path="\/opinioni-da-completare" component=\{OpinioniDaCompletare\}/);
});

test('only published unanswered/indeciso opinions are shown after all four protected catalog loads', () => {
  const page = read('client/src/pages/OpinioniDaCompletare.tsx');
  const topics = read('client/src/lib/opinionTopics.ts');
  assert.equal([...topics.matchAll(/^  "[a-z0-9_]+": "[a-z0-9_]+"/gm)].length, 94);
  for (const grade of ['E', 'N', 'R', 'CO']) assert.match(page, new RegExp('id: "'+grade+'"'));
  assert.match(page, /loadOpinionCategory\(user!\.id, verifiedPoliticalConsent!\.timestamp, id, signal\)/);
  assert.match(page, /const catalogReady = questions.length === publishedCount/);
  assert.match(page, /saved === null \|\| saved === "i"/);
  assert.match(page, /\.filter\(question => \{/);
  assert.match(page, /const missingCount = unresolved\.filter/);
  assert.match(page, /const undecidedCount = unresolved\.length - missingCount/);
  assert.match(page, /OPINION_TOPIC_DEFINITIONS\.filter/);
  assert.match(page, /Filtra per argomento/);
  assert.match(page, /showHeading && <h2/);
  assert.match(page, /unresolved\.length === 0 \?/);
});

test('editing works in place and only server-confirmed responses change the count', () => {
  const page = read('client/src/pages/OpinioniDaCompletare.tsx');
  const guard = read('client/src/hooks/useUnsavedOpinionsGuard.tsx');
  assert.match(page, /collectChangedOpinionAnswers\(questions, drafts\)/);
  assert.match(page, /captureOpinionSaveSession\(/);
  assert.match(page, /matchesOpinionSaveSession\(/);
  assert.match(page, /await saveAndVerifyOpinions\("N", changes\)/);
  assert.match(page, /await cacheConfirmedOpinionAnswers\(/);
  assert.match(page, /queryClient\.setQueriesData\(/);
  assert.match(page, /getAuthToken\(\)/);
  assert.match(page, /stayAfterSave: true/);
  assert.match(page, /if \(destination\) navigate\(destination\)/);
  assert.match(guard, /options\.stayAfterSave \? null/);
  for (const choice of ['Favorevole', 'Indeciso', 'Contrario']) assert.match(page, new RegExp('label: "'+choice+'"'));
  assert.match(page, /<OpinionActionsBar onSave=\{handleSave\}/);
  assert.match(page, /Le risposte definitive sono state rimosse dall.elenco/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|postMessage|new WebSocket/);
});

test('political consent, identity and epoch guard read/write and prevent account leaks', () => {
  const page = read('client/src/pages/OpinioniDaCompletare.tsx');
  assert.match(page, /const authorized = !!user && isSessionVerified && hasConsent/);
  assert.match(page, /JSON\.stringify\(\[user\.id, verifiedPoliticalConsent\.timestamp, "opinioni-da-completare"\]\)/);
  assert.match(page, /enabled: authorized/);
  assert.match(page, /rebaseTopicDrafts\(previous, draftScope, questions\)/);
  assert.match(page, /if \(!draftScope\) return \{\}/);
  assert.match(page, /if \(!current\(\)\) return/);
  assert.match(page, /!hasConsent \?/);
  assert.match(page, /<PoliticalOpinionsConsentModal/);
  assert.match(page, /<Redirect to="\/auth"/);
});
