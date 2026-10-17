'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const migration = read('20261017_referendum_ballots.sql');
const snapshotMigration = read('20261017_referendum_forecast_snapshots.sql');
const route = read('api/routes/referendum-vote.js');
const referendumRouter = read('api/routes/referendum.js');
const civicConfig = read('api/config/civicProcesses.js');
const consentService = read('api/services/politicalConsentService.js');
const syncService = read('api/services/referendumBallotSyncService.js');
const syncJob = read('api/jobs/civicProcessSyncJob.js');
const snapshotJob = read('api/jobs/referendumForecastSnapshotJob.js');
const snapshotService = read('api/services/referendumForecastSnapshotService.js');
const statsService = read('api/services/referendumForecastStatsService.js');
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
  assert.match(statsService, /MIN_PUBLIC_RESPONSES = 10/);
  assert.match(statsService, /intendingVoters = yes \+ no/);
  assert.match(statsService, /turnoutPercent/);
  assert.match(statsService, /yesPercent/);
  assert.match(statsService, /abstainPercent/);
  assert.match(statsService, /suppressed: true/);
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

test('forecast snapshots are aggregate-only and privacy-thresholded', () => {
  assert.match(snapshotMigration, /CREATE TABLE IF NOT EXISTS civic_ballot_forecast_snapshots/);
  assert.doesNotMatch(snapshotMigration, /^\s*user_id\s+/m);
  assert.match(snapshotMigration, /yes_count \+ no_count \+ abstain_count = total_responses/);
  assert.match(snapshotService, /total < MIN_PUBLIC_RESPONSES/);
  assert.match(snapshotService, /isFrozen/);
  assert.match(snapshotJob, /captureReferendumForecastSnapshots/);
  assert.match(syncJob, /referendumForecastSnapshotJob\.start\(\)/);
});

test('geographic forecast never exposes territories below the privacy threshold', () => {
  assert.match(route, /router\.get\('\/:ballotId\/geography'/);
  assert.match(statsService, /HAVING COUNT\(\*\) >= \$2/g);
  assert.match(statsService, /political_opinions_consent/);
  assert.match(statsService, /regione_residenza/);
  assert.match(statsService, /provincia_residenza/);
  assert.match(statsService, /comune_residenza/);
});

test('history and trend expose frozen forecast comparison without individual history', () => {
  assert.match(route, /router\.get\('\/history'/);
  assert.match(route, /router\.get\('\/:ballotId\/trend'/);
  assert.match(statsService, /s\.is_frozen = TRUE/);
  assert.match(statsService, /official_result_updated_at/);
  assert.match(page, /Archivio e confronto/);
  assert.match(page, /Previsione finale DEMOS/);
  assert.match(page, /Risultato ufficiale/);
  assert.match(page, /Territori e andamento/);
});
