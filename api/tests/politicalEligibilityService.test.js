const test = require('node:test');
const assert = require('node:assert/strict');

const {
  regionAliases,
  chooseEligibleUnits,
  jurisdictionMatchesRepresentative,
  listEligibleCandidates,
  listEligibleRepresentatives
} = require('../services/politicalEligibilityService');

function missingTable() {
  const error = new Error('canonical territory schema missing');
  error.code = '42P01';
  return error;
}

test('region aliases accept both DEMOS code and human-readable name', () => {
  assert.deepEqual(new Set(regionAliases('Toscana')), new Set(['toscana', 'to']));
  assert.deepEqual(new Set(regionAliases('TO')), new Set(['to', 'toscana']));
});

test('electoral-unit matching prefers the most specific territory available for each election', () => {
  const user = { paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' };
  const eligible = chooseEligibleUnits([
    { election_event_id: 'e1', electoral_unit_id: 'region-unit', territory_type: 'REGION', territory_code: 'TO' },
    { election_event_id: 'e1', electoral_unit_id: 'city-unit', territory_type: 'MUNICIPALITY', territory_code: 'Pisa' },
    { election_event_id: 'e2', electoral_unit_id: 'region-only', territory_type: 'REGION', territory_code: 'Toscana' }
  ], user);
  assert.deepEqual(eligible, new Set(['e1:city-unit', 'e2:region-only']));
});

test('national/european representatives are selectable globally while regional/municipal are territorial', () => {
  const user = { regione_residenza: 'TO', comune_residenza: 'Pisa' };
  assert.equal(jurisdictionMatchesRepresentative({ region: 'LA' }, 'E', user), true);
  assert.equal(jurisdictionMatchesRepresentative({ region: 'LA' }, 'C', user), true);
  assert.equal(jurisdictionMatchesRepresentative({ region: 'LA' }, 'S', user), true);
  assert.equal(jurisdictionMatchesRepresentative({ region: 'Toscana' }, 'R', user), true);
  assert.equal(jurisdictionMatchesRepresentative({ region: 'Lazio' }, 'R', user), false);
  assert.equal(jurisdictionMatchesRepresentative({ municipality: 'Pisa' }, 'CO', user), true);
  assert.equal(jurisdictionMatchesRepresentative({ municipality: 'Lucca' }, 'CO', user), false);
});

test('canonical candidates use legacy residence only when territory schema is absent', async () => {
  const pool = {
    async query(sql) {
      const s = String(sql);
      if (s.includes('FROM user_political_territories')) throw missingTable();
      if (s.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' }] };
      if (s.includes('FROM political_candidacies')) {
        return { rows: [
          { id: 'p1', cognome: 'A', election_event_id: 'e1', electoral_unit_id: 'unit-pisa', jurisdiction: { level: 'C' }, grado_candidatura: 'C' },
          { id: 'p2', cognome: 'B', election_event_id: 'e1', electoral_unit_id: 'unit-lucca', jurisdiction: { level: 'C' }, grado_candidatura: 'C' }
        ] };
      }
      if (s.includes('FROM unita_elettorale ue')) {
        return { rows: [
          { election_event_id: 'e1', electoral_unit_id: 'unit-pisa', territory_type: 'MUNICIPALITY', territory_code: 'Pisa' },
          { election_event_id: 'e1', electoral_unit_id: 'unit-lucca', territory_type: 'MUNICIPALITY', territory_code: 'Lucca' },
          { election_event_id: 'e1', electoral_unit_id: 'unit-pisa', territory_type: 'REGION', territory_code: 'TO' },
          { election_event_id: 'e1', electoral_unit_id: 'unit-lucca', territory_type: 'REGION', territory_code: 'TO' }
        ] };
      }
      if (s.includes('FROM user_electoral_unit_memberships')) throw missingTable();
      throw new Error(`unexpected query ${s}`);
    }
  };
  const result = await listEligibleCandidates(pool, 'u1', 'C');
  assert.equal(result.source, 'CAPABILITY');
  assert.equal(result.territorySource, 'LEGACY');
  assert.equal(result.strict, true);
  assert.deepEqual(result.subjects.map((row) => row.id), ['p1']);
});

test('canonical candidate eligibility prefers exact user electoral-unit membership', async () => {
  const pool = {
    async query(sql) {
      const s = String(sql);
      if (s.includes('FROM user_political_territories')) return { rows: [
        { jurisdiction_id: 'us', territory_type: 'ADMIN_LEVEL_1', territory_code: 'CA' },
        { jurisdiction_id: 'us', territory_type: 'ELECTORAL_DISTRICT', territory_code: 'CA-34', political_office_id: 'us.house' },
      ] };
      if (s.includes('FROM political_candidacies')) return { rows: [
        { id: 'p34', election_event_id: 'e1', electoral_unit_id: 'unit-34', jurisdiction: { level: 'HOUSE' } },
        { id: 'p35', election_event_id: 'e1', electoral_unit_id: 'unit-35', jurisdiction: { level: 'HOUSE' } },
      ] };
      if (s.includes('FROM unita_elettorale ue')) return { rows: [
        { election_event_id: 'e1', electoral_unit_id: 'unit-34', territory_type: 'ELECTORAL_DISTRICT', territory_code: 'CA-34' },
        { election_event_id: 'e1', electoral_unit_id: 'unit-35', territory_type: 'ELECTORAL_DISTRICT', territory_code: 'CA-35' },
      ] };
      if (s.includes('FROM user_electoral_unit_memberships')) return { rows: [
        { election_event_id: 'e1', electoral_unit_id: 'unit-35', political_office_id: 'us.house' },
      ] };
      throw new Error(`unexpected query ${s}`);
    }
  };
  const result = await listEligibleCandidates(pool, 'u1', 'us.house');
  assert.equal(result.territorySource, 'CANONICAL');
  assert.equal(result.electoralMembershipsAvailable, true);
  assert.deepEqual(result.subjects.map((row) => row.id), ['p35']);
});

test('capability representatives filter region but not Camera/Senato/Europeo', async () => {
  const rows = [
    { id: 'p-to', jurisdiction: { region: 'TO' } },
    { id: 'p-la', jurisdiction: { region: 'LA' } }
  ];
  function poolForGrade() {
    return {
      async query(sql) {
        const s = String(sql);
        if (s.includes('FROM user_political_territories')) throw missingTable();
        if (s.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'u1', regione_residenza: 'Toscana', comune_residenza: 'Pisa' }] };
        if (s.includes('FROM political_mandates')) return { rows };
        throw new Error(`unexpected query ${s}`);
      }
    };
  }
  const regional = await listEligibleRepresentatives(poolForGrade(), 'u1', 'R');
  assert.deepEqual(regional.subjects.map((row) => row.id), ['p-to']);
  assert.equal(regional.territorySource, 'LEGACY');
  const camera = await listEligibleRepresentatives(poolForGrade(), 'u1', 'C');
  assert.deepEqual(camera.subjects.map((row) => row.id), ['p-to', 'p-la']);
});

test('missing capability schema falls back to legacy candidate/representative queries', async () => {
  const candidatePool = {
    async query(sql) {
      const s = String(sql);
      if (s.includes('FROM user_political_territories')) throw missingTable();
      if (s.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'u1' }] };
      if (s.includes('FROM political_candidacies')) { const err = new Error('political_candidacies missing'); err.code = '42P01'; throw err; }
      assert.match(s, /ruolo IN \('C', 'CP'\)/);
      return { rows: [{ id: 'legacy-c' }] };
    }
  };
  const candidates = await listEligibleCandidates(candidatePool, 'u1', 'E');
  assert.equal(candidates.source, 'LEGACY');
  assert.equal(candidates.strict, false);
  assert.deepEqual(candidates.subjects.map((row) => row.id), ['legacy-c']);

  const representativePool = {
    async query(sql) {
      const s = String(sql);
      if (s.includes('FROM user_political_territories')) throw missingTable();
      if (s.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'u1' }] };
      if (s.includes('FROM political_mandates')) { const err = new Error('political_mandates missing'); err.code = '42P01'; throw err; }
      assert.match(s, /u\.ruolo = 'P'/);
      return { rows: [{ id: 'legacy-p' }] };
    }
  };
  const representatives = await listEligibleRepresentatives(representativePool, 'u1', 'R');
  assert.equal(representatives.source, 'LEGACY');
  assert.deepEqual(representatives.subjects.map((row) => row.id), ['legacy-p']);
});


test('eligibility queries do not require legacy users.avatar_config column', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'politicalEligibilityService.js'), 'utf8');
  assert.doesNotMatch(source, /\bu\.avatar_config\b/);
  assert.doesNotMatch(source, /SELECT id, nome, cognome, ruolo, status, avatar_config,/);
  assert.match(source, /to_jsonb\(u\)->'avatar_config' AS avatar_config/);
  assert.match(source, /to_jsonb\(users\)->'avatar_config' AS avatar_config/);
});
