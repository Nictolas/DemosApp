'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const migration = read('20261017_referendum_ballots.sql');
const route = read('api/routes/referendum-vote.js');
const referendumRouter = read('api/routes/referendum.js');
const civicConfig = read('api/config/civicProcesses.js');
const consentService = read('api/services/politicalConsentService.js');
const syncService = read('api/services/referendumBallotSyncService.js');
const syncJob = read('api/jobs/civicProcessSyncJob.js');
const appWrapper = read('client/src/components/AppWrapper.tsx');
const voteHub = read('client/src/pages/Vota.tsx');
const desktopHub = read('client/src/pages/Preferiti/PreferitiDesktopHub.tsx');
const page = read('client/src/pages/VotaReferendum/index.tsx');


test('referendum ballots are separate from the retired priority vote', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS civic_ballots/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS civic_ballot_positions/);
  assert.match(migration, /CHECK \(choice IN \('YES', 'NO', 'ABSTAIN'\)\)/);
  assert.doesNotMatch(migration, /voti_referendum_abrogativi/);
  assert.match(appWrapper, /location === '\/vota-referendum'/);
  assert.doesNotMatch(appWrapper, /vota-referendum-abrogativo/);
});

test('the real referendum write path is protected and freezes at poll opening', () => {
  assert.match(route, /requireVerifiedCivicIdentity/);
  assert.match(route, /requirePoliticalConsent/);
  assert.match(route, /REFERENDUM_VOTE_FROZEN/);
  assert.match(route, /now >= opensAt/);
  assert.match(route, /scope: `referendum-vote:\$\{ballotId\}`/);
  assert.match(route, /assertPreferenceChangeAllowed/);
  assert.match(route, /recordPreferenceChange/);
});

test('aggregate forecast separates turnout from YES-NO and applies privacy minimum', () => {
  assert.match(route, /MIN_PUBLIC_RESPONSES = 10/);
  assert.match(route, /intendingVoters = yes \+ no/);
  assert.match(route, /turnoutPercent/);
  assert.match(route, /yesPercent/);
  assert.match(route, /abstainPercent/);
  assert.match(route, /suppressed: true/);
});

test('ballot API is mounted under the existing referendum router', () => {
  assert.match(referendumRouter, /require\('\.\/referendum-vote'\)/);
  assert.match(referendumRouter, /router\.use\('\/vote-real', referendumVoteRoutes\)/);
  assert.match(page, /\/api\/referendum\/vote-real/);
});

test('Vota stays symmetric without an active referendum and adds the real referendum dynamically', () => {
  assert.match(voteHub, /useReferendumVoteAvailability/);
  assert.match(voteHub, /className=\{referendumAvailable \? "" : "col-span-2"\}/);
  assert.match(voteHub, /referendumAvailable &&/);
  assert.match(voteHub, /path="\/vota-referendum"/);

  assert.match(desktopHub, /useReferendumVoteAvailability/);
  assert.match(desktopHub, /items\.length % 2 === 1/);
  assert.match(desktopHub, /path: "\/vota-referendum"/);
});

test('official ballot sources and ballot-stage policy are explicit', () => {
  assert.match(civicConfig, /'it\.official_gazette'/);
  assert.match(civicConfig, /'it\.interior\.eligendo'/);
  assert.match(civicConfig, /BALLOT_POSITION/);
  assert.match(civicConfig, /position_on_question: true/);
  assert.match(syncService, /APPROVED_BALLOT_SOURCES/);
  assert.match(syncService, /payload_metadata \? 'ballot'/);
  assert.match(syncJob, /syncReferendumBallotsFromCanonicalSources/);
});

test('referendum choices are erased when political-consent data is cleared', () => {
  assert.match(consentService, /'civic_ballot_positions'/);
});

test('client explains YES semantics and offers abstention as a distinct choice', () => {
  assert.match(page, /Cosa significa votare Sì\?/);
  assert.match(page, /Non voterei/);
  assert.match(page, /previsione DEMOS, non il voto istituzionale/i);
});
