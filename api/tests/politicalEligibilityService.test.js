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

test('directly elected provincial council selections are restricted to their province, not ordinary provinces', async () => {
  assert.equal(jurisdictionMatchesRepresentative({province:'TN'}, 'it.provincial.trento', {paese_residenza:'IT',provincia_residenza:'TN'}), true);
  assert.equal(jurisdictionMatchesRepresentative({province:'Trento'}, 'it.provincial.trento', {paese_residenza:'IT',provincia_residenza:'Trento'}), true);
  assert.equal(jurisdictionMatchesRepresentative({province:'BZ'}, 'it.provincial.bolzano', {paese_residenza:'IT',provincia_residenza:'BZ'}), true);
  assert.equal(jurisdictionMatchesRepresentative({province:'TN'}, 'it.provincial.trento', {paese_residenza:'IT',provincia_residenza:'PI'}), false);
  assert.equal(jurisdictionMatchesRepresentative({province:'BZ'}, 'it.provincial.bolzano', {paese_residenza:'IT',provincia_residenza:'TN'}), false);
  assert.equal(jurisdictionMatchesRepresentative({province:'PI'}, 'it.provincial.trento', {paese_residenza:'IT',provincia_residenza:'PI'}), false);
  assert.equal(jurisdictionMatchesRepresentative({}, 'it.provincial.trento', {paese_residenza:'IT',provincia_residenza:'TN'}), false);
  assert.equal(jurisdictionMatchesRepresentative({province:'TN'}, 'it.provincial.trento', {}), false);

  const db = {async query(sql) {
    const q = String(sql);
    if (q.includes('FROM user_political_territories')) throw missingTable();
    if (q.includes('FROM users WHERE id = $1')) return {rows:[{id:'u',provincia_residenza:'PI'}]};
    throw new Error('An out-of-province request must not reach mandate or legacy queries');
  }};
  const denied = await listEligibleRepresentatives(db,'u','it.provincial.trento');
  assert.equal(denied.strict,true);
  assert.equal(denied.reason,'OFFICE_OUTSIDE_USER_TERRITORY');
  assert.deepEqual(denied.subjects,[]);
});

test('provincial candidate eligibility fails closed before querying candidacies outside the province', async () => {
  const db = { async query(sql) {
    const q = String(sql);
    if (q.includes('FROM user_political_territories')) throw missingTable();
    if (q.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'u', provincia_residenza: 'PI' }] };
    throw new Error('Out-of-province user must not reach candidacy or legacy queries');
  } };
  const denied = await listEligibleCandidates(db, 'u', 'it.provincial.bolzano');
  assert.equal(denied.strict, true);
  assert.equal(denied.reason, 'OFFICE_OUTSIDE_USER_TERRITORY');
  assert.deepEqual(denied.subjects, []);
});

test('provincial selections never fall back to unscoped legacy candidates or representatives', async () => {
  const db = { async query(sql) {
    const q = String(sql);
    if (q.includes('FROM user_political_territories')) throw missingTable();
    if (q.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'u', paese_residenza: 'IT', provincia_residenza: 'TN' }] };
    if (q.includes('FROM political_candidacies') || q.includes('FROM political_mandates')) throw missingTable();
    throw new Error('Provincial fallback must not query legacy users candidates/representatives');
  } };
  const candidates = await listEligibleCandidates(db, 'u', 'it.provincial.trento');
  const representatives = await listEligibleRepresentatives(db, 'u', 'it.provincial.trento');
  for (const result of [candidates, representatives]) {
    assert.equal(result.strict, true);
    assert.equal(result.source, 'CAPABILITY');
    assert.equal(result.reason, 'PROVINCIAL_REQUIRES_CANONICAL_DATA');
    assert.deepEqual(result.subjects, []);
  }
});

test('provincial offices reject explicit foreign residence even when province code collides', async () => {
  assert.equal(jurisdictionMatchesRepresentative(
    { province: 'TN' }, 'it.provincial.trento',
    { paese_residenza: 'US', provincia_residenza: 'TN' }
  ), false);
  assert.equal(jurisdictionMatchesRepresentative(
    { province: 'BZ' }, 'it.provincial.bolzano',
    { paese_residenza: 'DE', provincia_residenza: 'BZ' }
  ), false);
  assert.equal(jurisdictionMatchesRepresentative(
    { province: 'TN' }, 'it.provincial.trento',
    { paese_residenza: 'IT', provincia_residenza: 'TN' }
  ), true);
  const db = { async query(sql) {
    const q = String(sql);
    if (q.includes('FROM user_political_territories')) throw missingTable();
    if (q.includes('FROM users WHERE id = $1')) {
      return { rows: [{ id: 'foreign', paese_residenza: 'US', provincia_residenza: 'TN' }] };
    }
    throw new Error('Foreign residence must not reach candidacies, mandates or legacy queries');
  } };
  for (const list of [listEligibleCandidates, listEligibleRepresentatives]) {
    const result = await list(db, 'foreign', 'it.provincial.trento');
    assert.equal(result.strict, true);
    assert.equal(result.reason, 'OFFICE_OUTSIDE_USER_TERRITORY');
    assert.deepEqual(result.subjects, []);
  }
});


test('provincial candidate rejects a mismatched or missing candidacy province despite eligible electoral unit', async () => {
  const db = { async query(sql) {
    const q = String(sql);
    if (q.includes('FROM user_political_territories')) throw missingTable();
    if (q.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'u', paese_residenza: 'IT', provincia_residenza: 'TN' }] };
    if (q.includes('FROM political_candidacies')) return { rows: [
      { id: 'good', election_event_id: 'e', electoral_unit_id: 'tn', jurisdiction: { level: 'it.provincial.trento', province: 'TN' } },
      { id: 'wrong', election_event_id: 'e', electoral_unit_id: 'tn', jurisdiction: { level: 'it.provincial.trento', province: 'BZ' } },
      { id: 'missing', election_event_id: 'e', electoral_unit_id: 'tn', jurisdiction: { level: 'it.provincial.trento' } },
      { id: 'foreign-country', election_event_id: 'e', electoral_unit_id: 'tn', jurisdiction: { level: 'it.provincial.trento', province: 'TN', country: 'US' } },
      { id: 'foreign-code', election_event_id: 'e', electoral_unit_id: 'tn', jurisdiction: { level: 'it.provincial.trento', province: 'TN', countryCode: 'DE' } },
    ] };
    if (q.includes('FROM unita_elettorale ue')) return { rows: [
      { election_event_id: 'e', electoral_unit_id: 'tn', territory_type: 'PROVINCE', territory_code: 'TN' }
    ] };
    if (q.includes('FROM user_electoral_unit_memberships')) throw missingTable();
    throw new Error('Unexpected query in isolated provincial eligibility test');
  } };
  const result = await listEligibleCandidates(db, 'u', 'it.provincial.trento');
  assert.equal(result.strict, true);
  assert.deepEqual(result.subjects.map(row => row.id), ['good']);
});

test('provincial councillor with overlapping mandate rows appears only once', async () => {
  const db = { async query(sql) {
    const q = String(sql);
    if (q.includes('FROM user_political_territories')) throw missingTable();
    if (q.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'resident', paese_residenza: 'IT', provincia_residenza: 'TN' }] };
    if (q.includes('FROM political_mandates')) return { rows: [
      { id: 'councillor', mandate_id: 'provincial', grado_elezione: 'it.provincial.trento', jurisdiction: { province: 'TN' } },
      { id: 'councillor', mandate_id: 'derived-regional', grado_elezione: 'CONSIGLIO_REGIONALE', jurisdiction: { province: 'TN' } },
      { id: 'another', mandate_id: 'provincial-2', grado_elezione: 'it.provincial.trento', jurisdiction: { province: 'TN' } },
      { id: 'outsider', mandate_id: 'other', grado_elezione: 'it.provincial.bolzano', jurisdiction: { province: 'BZ' } }
    ] };
    throw new Error('Unexpected query in provincial duplicate mandate test');
  } };
  const result = await listEligibleRepresentatives(db, 'resident', 'it.provincial.trento');
  assert.equal(result.strict, true);
  assert.deepEqual(result.subjects.map((row) => row.id), ['councillor', 'another']);
  assert.equal(result.subjects[0].mandate_id, 'provincial', 'retain the first eligible mandate, not the derived duplicate');
});


test('provincial candidates with multiple active candidacies appear once per person', async () => {
  const db = { async query(sql) {
    const q = String(sql);
    if (q.includes('FROM user_political_territories')) throw missingTable();
    if (q.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'resident', paese_residenza: 'IT', provincia_residenza: 'TN' }] };
    if (q.includes('FROM political_candidacies')) return { rows: [
      { id: 'candidate-a', candidacy_id: 'first', election_event_id: 'e', electoral_unit_id: 'tn', jurisdiction: { level: 'it.provincial.trento', province: 'TN' } },
      { id: 'candidate-a', candidacy_id: 'second', election_event_id: 'e', electoral_unit_id: 'tn', jurisdiction: { level: 'it.provincial.trento', province: 'TN' } },
      { id: 'candidate-b', candidacy_id: 'third', election_event_id: 'e', electoral_unit_id: 'tn', jurisdiction: { level: 'it.provincial.trento', province: 'TN' } },
      { id: 'candidate-outside', candidacy_id: 'fourth', election_event_id: 'e', electoral_unit_id: 'tn', jurisdiction: { level: 'it.provincial.trento', province: 'BZ' } }
    ] };
    if (q.includes('FROM unita_elettorale ue')) return { rows: [{ election_event_id: 'e', electoral_unit_id: 'tn', territory_type: 'PROVINCE', territory_code: 'TN' }] };
    if (q.includes('FROM user_electoral_unit_memberships')) throw missingTable();
    throw new Error('Unexpected query in duplicate provincial candidacy test');
  } };
  const result = await listEligibleCandidates(db, 'resident', 'it.provincial.trento');
  assert.equal(result.strict, true);
  assert.deepEqual(result.subjects.map(row => row.id), ['candidate-a', 'candidate-b']);
  assert.equal(result.subjects[0].candidacy_id, 'first', 'retain the first eligible candidacy, not the last duplicate');
});


test('provincial offices fail closed when residence country is missing despite a matching province', async () => {
  for (const [office, province] of [['it.provincial.trento', 'TN'], ['it.provincial.bolzano', 'BZ']]) {
    assert.equal(jurisdictionMatchesRepresentative({ province }, office, { provincia_residenza: province }), false);
    const db = { async query(sql) {
      const q = String(sql);
      if (q.includes('FROM user_political_territories')) throw missingTable();
      if (q.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'resident', provincia_residenza: province }] };
      throw new Error('Missing country must not reach candidacy or mandate queries');
    } };
    for (const list of [listEligibleCandidates, listEligibleRepresentatives]) {
      const result = await list(db, 'resident', office);
      assert.equal(result.strict, true);
      assert.equal(result.reason, 'OFFICE_OUTSIDE_USER_TERRITORY');
      assert.deepEqual(result.subjects, []);
    }
  }
});


test('provincial electoral units cannot be inferred from regional-only mappings or ambiguous province mappings', async () => {
  function mockDb(mappingRows, { exactMembership = false } = {}) {
    return {
      async query(sql) {
        const statement = String(sql);
        if (statement.includes('FROM user_political_territories')) throw missingTable();
        if (statement.includes('FROM users WHERE id = $1')) return {
          rows: [{
            id: 'resident', paese_residenza: 'IT',
            regione_residenza: 'Trentino-Alto Adige', provincia_residenza: 'TN',
          }],
        };
        if (statement.includes('FROM political_candidacies')) return {
          rows: [{
            id: 'candidate', election_event_id: 'e1', electoral_unit_id: 'unit',
            jurisdiction: { level: 'it.provincial.trento', province: 'TN' },
          }],
        };
        if (statement.includes('FROM unita_elettorale ue')) return { rows: mappingRows };
        if (statement.includes('FROM user_electoral_unit_memberships')) {
          if (!exactMembership) throw missingTable();
          return { rows: [{
            election_event_id: 'e1', electoral_unit_id: 'unit',
            political_office_id: 'it.provincial.trento', verification_level: 'OFFICIAL',
          }] };
        }
        throw new Error('Unexpected synthetic SQL query in provincial electoral unit test');
      },
    };
  }

  const regionOnly = [{
    election_event_id: 'e1', electoral_unit_id: 'unit',
    territory_type: 'REGION', territory_code: 'Trentino-Alto Adige',
  }];
  for (const exactMembership of [false, true]) {
    const result = await listEligibleCandidates(
      mockDb(regionOnly, { exactMembership }), 'resident', 'it.provincial.trento',
    );
    assert.equal(result.strict, true);
    assert.deepEqual(result.subjects, [],
      'a region-wide unit cannot qualify for a direct provincial council');
  }

  const province = [{
    election_event_id: 'e1', electoral_unit_id: 'unit',
    territory_type: 'PROVINCE', territory_code: 'TN',
  }];
  const valid = await listEligibleCandidates(mockDb(province), 'resident', 'it.provincial.trento');
  assert.deepEqual(valid.subjects.map((row) => row.id), ['candidate']);

  const administrativeProvince = [{
    election_event_id: 'e1', electoral_unit_id: 'unit',
    territory_type: 'ADMIN_LEVEL_2', territory_code: 'TN',
  }];
  const validAdmin2 = await listEligibleCandidates(
    mockDb(administrativeProvince), 'resident', 'it.provincial.trento',
  );
  assert.deepEqual(validAdmin2.subjects.map((row) => row.id), ['candidate']);

  const contradictory = [...province, {
    election_event_id: 'e1', electoral_unit_id: 'unit',
    territory_type: 'PROVINCE', territory_code: 'BZ',
  }];
  const denied = await listEligibleCandidates(mockDb(contradictory), 'resident', 'it.provincial.trento');
  assert.deepEqual(denied.subjects, [],
    'conflicting provincial unit mappings must fail closed even when one matches');
});


test('provincial canonical residence rejects mixed countries and provinces without querying candidacies or mandates', async () => {
  const offices = [
    ['it.provincial.trento', 'TN', 'BZ'],
    ['it.provincial.bolzano', 'BZ', 'TN'],
  ];
  for (const [office, province, foreignProvince] of offices) {
    const base = [
      { jurisdiction_id: 'it', territory_type: 'COUNTRY', territory_code: 'IT', political_office_id: null, verification_level: 'OFFICIAL' },
      { jurisdiction_id: 'it', territory_type: 'PROVINCE', territory_code: province, political_office_id: null, verification_level: 'OFFICIAL' },
    ];
    const mixedCountry = [...base, {
      jurisdiction_id: 'it', territory_type: 'COUNTRY', territory_code: 'DE',
      political_office_id: office, verification_level: 'OFFICIAL',
    }];
    const mixedProvince = [...base, {
      jurisdiction_id: 'it', territory_type: 'PROVINCE', territory_code: foreignProvince,
      political_office_id: office, verification_level: 'OFFICIAL',
    }];
    for (const memberships of [mixedCountry, mixedProvince]) {
      const calls = [];
      const pool = {
        async query(sql) {
          calls.push(String(sql));
          if (String(sql).includes('FROM user_political_territories')) {
            return { rows: memberships };
          }
          throw new Error('A conflicting provincial residence must be rejected before candidacy/mandate SQL');
        },
      };
      for (const list of [listEligibleCandidates, listEligibleRepresentatives]) {
        const result = await list(pool, 'synthetic-resident', office);
        assert.equal(result.source, 'CAPABILITY');
        assert.equal(result.strict, true);
        assert.equal(result.reason, 'OFFICE_OUTSIDE_USER_TERRITORY');
        assert.deepEqual(result.subjects, []);
      }
      assert.equal(calls.length, 2, 'only one canonical residence read per candidate/representative check');
    }
  }
});

test('provincial jurisdiction matching accepts equivalent residence aliases but rejects any conflicting active values', () => {
  for (const [office, province, name, other] of [
    ['it.provincial.trento', 'TN', 'Trento', 'BZ'],
    ['it.provincial.bolzano', 'BZ', 'Bolzano', 'TN'],
  ]) {
    const jurisdiction = { province, level: office };
    assert.equal(jurisdictionMatchesRepresentative(jurisdiction, office, {
      COUNTRY: ['it', 'italia', 'italy'], PROVINCE: [province.toLowerCase(), name.toLowerCase()],
    }), true);
    assert.equal(jurisdictionMatchesRepresentative(jurisdiction, office, {
      COUNTRY: ['it', 'de'], PROVINCE: [province.toLowerCase()],
    }), false);
    assert.equal(jurisdictionMatchesRepresentative(jurisdiction, office, {
      COUNTRY: ['it'], PROVINCE: [province.toLowerCase(), other.toLowerCase()],
    }), false);
    assert.equal(jurisdictionMatchesRepresentative(jurisdiction, office, {
      COUNTRY: [], PROVINCE: [province.toLowerCase()],
    }), false);
    assert.equal(jurisdictionMatchesRepresentative(jurisdiction, office, {
      COUNTRY: ['it'], PROVINCE: [],
    }), false);
  }
});
