const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeElectionType,
  eventGeographyMatches,
  listElectionEvents,
  listRelevantElectionEvents
} = require('../services/electionEventService');

function missingTable(code = '42P01') {
  const error = new Error('schema missing');
  error.code = code;
  return error;
}

test('election type normalization covers DEMOS current labels', () => {
  assert.equal(normalizeElectionType('Europee'), 'EUROPEAN');
  assert.equal(normalizeElectionType('Politiche_nazionali'), 'NATIONAL');
  assert.equal(normalizeElectionType('Regionali'), 'REGIONAL');
  assert.equal(normalizeElectionType('Comunali'), 'MUNICIPAL');
  assert.equal(normalizeElectionType('Referendum'), 'REFERENDUM');
});

test('event geography keeps national/global elections broad and local elections territorial', () => {
  const user = { paese_residenza: 'IT', regione_residenza: 'TO', comune_residenza: 'Pisa' };
  assert.equal(eventGeographyMatches(user, { tipo_elezione: 'Europee', paese_evento: 'IT' }), true);
  assert.equal(eventGeographyMatches(user, { tipo_elezione: 'Regionali', paese_evento: 'IT', regione_evento: 'Toscana' }), true);
  assert.equal(eventGeographyMatches(user, { tipo_elezione: 'Regionali', paese_evento: 'IT', regione_evento: 'Lazio' }), false);
  assert.equal(eventGeographyMatches(user, { tipo_elezione: 'Comunali', paese_evento: 'IT', comune_evento: 'Pisa' }), true);
  assert.equal(eventGeographyMatches(user, { tipo_elezione: 'Comunali', paese_evento: 'IT', comune_evento: 'Lucca' }), false);
});

test('upcoming elections use real event dates, never createdat as election date', async () => {
  let capturedSql = '';
  const pool = { query: async (sql, params) => { capturedSql = String(sql); assert.deepEqual(params, [5]); return { rows: [] }; } };
  await listElectionEvents(pool, { upcomingOnly: true, limit: 5 });
  assert.match(capturedSql, /FROM eventi/);
  assert.match(capturedSql, /giorno_inizio IS NOT NULL/);
  assert.match(capturedSql, /COALESCE\(giorno_fine, giorno_inizio\) >= CURRENT_DATE/);
  assert.doesNotMatch(capturedSql, /createdat\s*>\s*NOW/i);
});

test('relevant elections derive exact electoral unit from legacy residence only when canonical territory schema is absent', async () => {
  const pool = {
    query: async (sql) => {
      const s = String(sql);
      if (s.includes('FROM user_political_territories')) throw missingTable();
      if (s.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' }] };
      if (s.includes('FROM eventi')) return { rows: [
        { id: 'e1', tipo_elezione: 'Politiche_nazionali', paese_evento: 'IT' },
        { id: 'e2', tipo_elezione: 'Politiche_nazionali', paese_evento: 'IT' }
      ] };
      if (s.includes('FROM user_electoral_unit_memberships')) throw missingTable();
      if (s.includes('FROM unita_elettorale ue')) return { rows: [
        { election_event_id: 'e1', electoral_unit_id: 'u-pisa', territory_type: 'MUNICIPALITY', territory_code: 'Pisa' },
        { election_event_id: 'e2', electoral_unit_id: 'u-lucca', territory_type: 'MUNICIPALITY', territory_code: 'Lucca' }
      ] };
      throw new Error(`unexpected query ${s}`);
    }
  };
  const rows = await listRelevantElectionEvents(pool, 'u1');
  assert.deepEqual(rows.map((row) => row.id), ['e1']);
  assert.deepEqual(rows[0].eligible_electoral_unit_ids, ['u-pisa']);
});

test('canonical direct electoral-unit membership makes a mixed-scope event relevant', async () => {
  const pool = {
    query: async (sql) => {
      const s = String(sql);
      if (s.includes('FROM user_political_territories')) return { rows: [
        { jurisdiction_id: 'us', territory_type: 'COUNTRY', territory_code: 'US' },
        { jurisdiction_id: 'us', territory_type: 'ADMIN_LEVEL_1', territory_code: 'CA' },
      ] };
      if (s.includes('FROM eventi')) return { rows: [
        { id: 'e-general', tipo_elezione: 'General Election', paese_evento: 'US' },
      ] };
      if (s.includes('FROM user_electoral_unit_memberships')) return { rows: [
        { election_event_id: 'e-general', electoral_unit_id: 'house-34', political_office_id: 'us.house' },
      ] };
      if (s.includes('FROM unita_elettorale ue')) return { rows: [
        { election_event_id: 'e-general', electoral_unit_id: 'house-34', territory_type: 'ELECTORAL_DISTRICT', territory_code: 'CA-34' },
        { election_event_id: 'e-general', electoral_unit_id: 'house-35', territory_type: 'ELECTORAL_DISTRICT', territory_code: 'CA-35' },
      ] };
      throw new Error(`unexpected query ${s}`);
    }
  };
  const rows = await listRelevantElectionEvents(pool, 'u1');
  assert.deepEqual(rows.map((row) => row.id), ['e-general']);
  assert.deepEqual(rows[0].eligible_electoral_unit_ids, ['house-34']);
});

test('before generic unit migration, relevant elections fall back to event geography, not legacy elezioni table', async () => {
  const pool = {
    query: async (sql) => {
      const s = String(sql);
      if (s.includes('FROM user_political_territories')) throw missingTable();
      if (s.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' }] };
      if (s.includes('FROM eventi')) return { rows: [
        { id: 'e-to', tipo_elezione: 'Regionali', paese_evento: 'IT', regione_evento: 'Toscana' },
        { id: 'e-la', tipo_elezione: 'Regionali', paese_evento: 'IT', regione_evento: 'Lazio' }
      ] };
      if (s.includes('FROM user_electoral_unit_memberships')) throw missingTable();
      if (s.includes('FROM unita_elettorale ue')) throw missingTable('42703');
      throw new Error(`unexpected query ${s}`);
    }
  };
  const rows = await listRelevantElectionEvents(pool, 'u1');
  assert.deepEqual(rows.map((row) => row.id), ['e-to']);
});
