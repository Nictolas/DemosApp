'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Firma contains only signature tools, with proposals still available contextually', () => {
  const firma = read('client/src/pages/Proponi.tsx');
  assert.match(firma, /title: "Iniziativa Popolare"/);
  assert.match(firma, /title: "Referendum Abrogativo"/);
  assert.match(firma, /title: "ECI"/);
  assert.doesNotMatch(firma, /Proponi nuovi soggetti|href="\/proponi-soggetto/);
  const proposalButton = read('client/src/components/ProposeSubjectButton.tsx');
  assert.match(proposalButton, /\/proponi-soggetto\?categoria=/);
});

test('personal completion reminder requires verified political consent and owner context', () => {
  const profile = read('client/src/pages/Profilo/index.tsx');
  const compass = read('client/src/pages/CompassoPolitico.tsx');
  const hook = read('client/src/pages/Profilo/hooks/useProfileData.ts');
  assert.match(profile, /opinions: wantsCompletion \|\| openPanels\.opinions/);
  assert.match(profile, /isViewingOwnProfile && !isEditing/);
  assert.match(profile, /consentGranted && !sectionsLoading\.opinions && !opinionsError/);
  assert.match(compass, /<CompleteOpinionsCallout answers=\{userOpinions\}/);
  assert.match(hook, /verifiedPoliticalConsent\?\.granted === true/);
  assert.match(hook, /userAnswers[\s\S]*answersLoaded: true/);
});

test('completion count includes only published opinions and separates missing from explicitly undecided', () => {
  const card = read('client/src/pages/Profilo/components/CompleteOpinionsCallout.tsx');
  const topics = read('client/src/lib/opinionTopics.ts');
  const matches = [...topics.matchAll(/^  "[a-z0-9_]+": "[a-z0-9_]+"/gm)];
  assert.equal(matches.length, 94);
  assert.match(card, /Object\.keys\(OPINION_TOPIC_BY_ID\)/);
  assert.match(card, /answer === "i" \|\| answer === "Indeciso"/);
  assert.match(card, /if \(status === "undecided"\) undecided\+\+/);
  assert.match(card, /if \(status === "unanswered"\) unanswered\+\+/);
  assert.match(card, /if \(counts\.total === 0\) return null/);
  assert.match(card, /Sei ancora indeciso su \{counts\.total\} opinioni/);
  assert.match(card, /href="\\/opinioni-da-completare"/);
  assert.doesNotMatch(card, /onClick=|aria-expanded|<ul|<select/);
  assert.match(card, /<ChevronRight /);
  assert.doesNotMatch(card, /localStorage|sessionStorage|apiRequest|fetch\(/);
});
