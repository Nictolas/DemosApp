const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const config = read('api/config/politicalTerritoryResolvers.js');
const service = read('api/services/politicalTerritoryResolverService.js');
const membership = read('api/services/politicalTerritoryMembershipService.js');
const docs = read('ARCHITETTURA_GLOBALE_GIURISDIZIONI_POLITICHE.md');

test('Italy resolver sources are adapter configuration, not route-local country branches', () => {
  assert.match(config, /it\.istat\.situas/);
  assert.match(config, /it\.interno\.eligendo/);
  assert.match(config, /ADMINISTRATIVE_CATALOG/);
  assert.match(config, /ELECTORAL_UNIT/);
  assert.doesNotMatch(read('api/routes/candidati.js'), /it\.istat\.situas|it\.interno\.eligendo/);
  assert.doesNotMatch(read('api/routes/rappresentanti.js'), /it\.istat\.situas|it\.interno\.eligendo/);
});

test('resolver writes through canonical territory membership service only', () => {
  assert.match(service, /replaceUserPoliticalTerritories/);
  assert.match(service, /replaceUserElectoralUnitMemberships/);
  assert.doesNotMatch(service, /UPDATE users SET .*regione_residenza/s);
  assert.doesNotMatch(service, /INSERT INTO users/);
  assert.match(membership, /resolveAuthoritativeTerritoryRows/);
});

test('official electoral resolution is event scoped and validates unit ownership', () => {
  assert.match(config, /eventScoped: true/);
  assert.match(service, /FROM eventi WHERE id = \$1/);
  assert.match(service, /FROM unita_elettorale WHERE evento_id = \$1/);
  assert.match(service, /TERRITORY_RESOLVER_UNIT_EVENT_MISMATCH/);
});

test('architecture documentation distinguishes official catalog normalization from official membership evidence', () => {
  assert.match(docs, /SELF_DECLARED < VERIFIED < OFFICIAL/);
});

test('territory resolver job is opt-in and never activates from import alone', () => {
  const app = read('api/app.js');
  const job = read('api/jobs/politicalTerritoryResolverJob.js');
  assert.match(app, /ENABLE_POLITICAL_TERRITORY_RESOLVER === 'true'/);
  assert.match(app, /politicalTerritoryResolverJob\.start\(\)/);
  assert.match(job, /syncItalianPoliticalTerritoriesFromProfiles/);
  assert.match(job, /POLITICAL_TERRITORY_RESOLVER_BATCH_SIZE/);
  assert.doesNotMatch(job, /ENABLE_POLITICAL_TERRITORY_RESOLVER/);
});

test('legacy two-letter Italian region aliases are explicitly documented as compatibility codes, not Istat region codes', () => {
  const regionUtils = read('api/utils/regioniUtils.js');
  assert.match(regionUtils, /codici legacy DEMOS, non codici Regione ISTAT/);
});
