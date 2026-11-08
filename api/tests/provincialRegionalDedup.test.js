'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { listEligibleRepresentatives } = require('../services/politicalEligibilityService');

function isolatedMandates(rows, residence = {
  id: 'resident', paese_residenza: 'IT',
  regione_residenza: 'Trentino-Alto Adige', provincia_residenza: 'TN',
}) {
  const calls = [];
  return {
    calls,
    async query(sql) {
      const statement = String(sql);
      calls.push(statement);
      if (statement.includes('FROM user_political_territories')) {
        const error = new Error('Synthetic old territory schema');
        error.code = '42P01';
        throw error;
      }
      if (statement.includes('FROM users WHERE id = $1')) {
        return { rows: [residence] };
      }
      if (statement.includes('FROM political_mandates')) {
        return { rows };
      }
      throw new Error('Unexpected SQL in regional/provincial mandate regression');
    },
  };
}

test('regional matching counts a provincial councillor once and prefers their explicit regional mandate', async () => {
  const region = 'Trentino-Alto Adige';
  const db = isolatedMandates([
    // A derived provincial record can arrive first from the DB.
    { id: 'both', mandate_id: 'derived-from-provincial', grado_elezione: 'CONSIGLIO_PROVINCIALE_TRENTO',
      jurisdiction: { level: 'R', region, province: 'TN' } },
    { id: 'other', mandate_id: 'other-regional', grado_elezione: 'R',
      jurisdiction: { level: 'R', region } },
    { id: 'both', mandate_id: 'explicit-regional', grado_elezione: 'R',
      jurisdiction: { level: 'R', region } },
    { id: 'both', mandate_id: 'duplicate-regional', grado_elezione: 'R',
      jurisdiction: { level: 'R', region } },
    { id: 'outsider', mandate_id: 'another-region', grado_elezione: 'R',
      jurisdiction: { level: 'R', region: 'Lazio' } },
  ]);
  const result = await listEligibleRepresentatives(db, 'resident', 'R');
  assert.equal(result.strict, true);
  assert.deepEqual(result.subjects.map((row) => row.id), ['both', 'other']);
  assert.equal(result.subjects[0].mandate_id, 'explicit-regional');
  assert.equal(new Set(result.subjects.map((row) => row.id)).size, result.subjects.length);
  assert.equal(db.calls.filter((sql) => sql.includes('FROM political_mandates')).length, 1);
});

test('provincial matching retains only direct provincial mandate, not the regional derivative', async () => {
  const region = 'Trentino-Alto Adige';
  const db = isolatedMandates([
    { id: 'both', mandate_id: 'derived-regional', grado_elezione: 'R',
      jurisdiction: { level: 'it.provincial.trento', region, province: 'TN' } },
    { id: 'both', mandate_id: 'direct-provincial', grado_elezione: 'CONSIGLIO_PROVINCIALE_TRENTO',
      jurisdiction: { level: 'it.provincial.trento', region, province: 'TN' } },
    { id: 'both', mandate_id: 'duplicate-direct', grado_elezione: 'CONSIGLIO_PROVINCIALE_TRENTO',
      jurisdiction: { level: 'it.provincial.trento', region, province: 'TN' } },
    { id: 'other-province', mandate_id: 'bz', grado_elezione: 'CONSIGLIO_PROVINCIALE_BOLZANO',
      jurisdiction: { level: 'it.provincial.bolzano', region, province: 'BZ' } },
  ]);
  const result = await listEligibleRepresentatives(db, 'resident', 'it.provincial.trento');
  assert.deepEqual(result.subjects.map((row) => row.id), ['both']);
  assert.equal(result.subjects[0].mandate_id, 'direct-provincial');
});


test('Bolzano councillor is not counted twice across regional and provincial mandate views', async () => {
  const region = 'Trentino-Alto Adige';
  const residence = { id: 'bolzano-resident', paese_residenza: 'IT', regione_residenza: region, provincia_residenza: 'BZ' };
  const rows = [
    { id: 'councillor-bz', mandate_id: 'provincial-bz', grado_elezione: 'it.provincial.bolzano',
      jurisdiction: { level: 'it.provincial.bolzano', region, province: 'BZ' } },
    { id: 'councillor-bz', mandate_id: 'regional-bz', grado_elezione: 'R',
      jurisdiction: { level: 'R', region, province: 'BZ' } },
    { id: 'councillor-tn', mandate_id: 'provincial-tn', grado_elezione: 'it.provincial.trento',
      jurisdiction: { level: 'it.provincial.trento', region, province: 'TN' } },
  ];
  const provincial = await listEligibleRepresentatives(isolatedMandates(rows, residence), residence.id, 'it.provincial.bolzano');
  assert.deepEqual(provincial.subjects.map((row) => row.mandate_id), ['provincial-bz']);

  const regional = await listEligibleRepresentatives(isolatedMandates(rows, residence), residence.id, 'R');
  assert.deepEqual(regional.subjects.map((row) => row.mandate_id), ['regional-bz', 'provincial-tn']);
  assert.equal(regional.subjects.filter((row) => row.id === 'councillor-bz').length, 1);
});

test('regional/provincial dedup leaves unrelated national and European mandate lists untouched', async () => {
  const db = isolatedMandates([
    { id: 'same', mandate_id: 'one', grado_elezione: 'E', jurisdiction: {} },
    { id: 'same', mandate_id: 'two', grado_elezione: 'E', jurisdiction: {} },
  ]);
  const result = await listEligibleRepresentatives(db, 'resident', 'E');
  assert.deepEqual(result.subjects.map((row) => row.mandate_id), ['one', 'two']);
});

test('Transparency Podium aggregates unique institutional votes per person and level, without adding a provincial level', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'routes', 'podio-trasparenza.js'), 'utf8');
  assert.match(code, /COUNT\(DISTINCT c\.institutional_vote_key\)/);
  assert.match(code, /GROUP BY c\.id_utente, u\.nome, u\.cognome, c\.institutional_level/);
  assert.match(code, /PARTITION BY institutional_level/);
  assert.doesNotMatch(code, /institutional_level\s*=\s*'PROVINCIALE'/);
});
