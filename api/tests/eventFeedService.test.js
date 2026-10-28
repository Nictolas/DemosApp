const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectedSubjectIds,
  eventTerritoryMatches,
  rankFeedEvents,
  listPersonalizedEvents
} = require('../services/eventFeedService');

test('legacy compatibility helper deduplicates selected subjects', () => {
  assert.deepEqual(selectedSubjectIds({
    rappresentante_camera: 'p1', candidato_camera: 'p1',
    candidato_comune: 'c1', attivisti: 'a1', organizzazioni: 'o1'
  }), ['p1', 'c1', 'a1', 'o1']);
});

test('territory matching uses municipality, then province, then region', () => {
  const user = { comune_residenza: 'Pisa', provincia_residenza: 'PI', regione_residenza: 'TO' };
  assert.equal(eventTerritoryMatches(user, { comune_evento: 'Pisa', provincia_evento: 'LU' }), true);
  assert.equal(eventTerritoryMatches(user, { provincia_evento: 'PI' }), true);
  assert.equal(eventTerritoryMatches(user, { regione_evento: 'Toscana' }), true);
  assert.equal(eventTerritoryMatches(user, { comune_evento: 'Lucca', regione_evento: 'Toscana' }), false);
});

test('feed ranking is selected subject > territory > relevant election, then chronological within priority', () => {
  const context = {
    selectedIds: new Set(['p1']),
    selectedNames: new Set(['mario rossi']),
    user: { comune_residenza: 'Pisa', provincia_residenza: 'PI', regione_residenza: 'TO' },
    relevantElectionIds: new Set(['e-election'])
  };
  const rows = rankFeedEvents([
    { id: 'e-territory-late', comune_evento: 'Pisa', giorno_inizio: '2027-02-02', tipologia_evento: 'Altro' },
    { id: 'e-selected', creator_user_id: 'p1', organizzatore: 'Nome cambiato', giorno_inizio: '2027-12-01', tipologia_evento: 'Altro' },
    { id: 'e-election', giorno_inizio: '2027-01-01', tipologia_evento: 'Elezioni' },
    { id: 'e-territory-early', provincia_evento: 'PI', giorno_inizio: '2027-01-10', tipologia_evento: 'Altro' },
    { id: 'e-ignore', comune_evento: 'Lucca', giorno_inizio: '2027-01-01', tipologia_evento: 'Altro' }
  ], context);
  assert.deepEqual(rows.map((row) => row.id), ['e-selected', 'e-territory-early', 'e-territory-late', 'e-election']);
  assert.deepEqual(rows.map((row) => row.feed_reason), ['SELECTED_SUBJECT', 'TERRITORY', 'TERRITORY', 'RELEVANT_ELECTION']);
});

test('legacy organizer name is only a fallback when creator_user_id is absent', () => {
  const context = {
    selectedIds: new Set(['p1']),
    selectedNames: new Set(['mario rossi']),
    user: {},
    relevantElectionIds: new Set()
  };
  const rows = rankFeedEvents([
    { id: 'legacy', organizzatore: 'Mario Rossi', tipologia_evento: 'Altro' },
    { id: 'canonical-other', creator_user_id: 'other', organizzatore: 'Mario Rossi', tipologia_evento: 'Altro' }
  ], context);
  assert.deepEqual(rows.map((row) => row.id), ['legacy']);
});

test('personalized feed combines canonical selected subjects, territory and canonical relevant elections', async () => {
  const pool = {
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      if (s.includes('FROM user_political_territories') || s.includes('FROM user_electoral_unit_memberships')) {
        const err = new Error('territory membership schema missing'); err.code = '42P01'; throw err;
      }
      if (s.includes('u.attivisti, u.organizzazioni') && s.includes('FROM users u')) {
        return { rows: [{
          id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa',
          attivisti: null, organizzazioni: null
        }] };
      }
      if (s.includes('FROM political_selections ps')) {
        assert.equal(params[0], 'u1');
        return { rows: [{
          user_id: 'u1', selection_kind: 'representative', jurisdiction_id: 'it', political_office_id: 'it.camera',
          selected_user_id: 'p1', selected_candidacy_id: null, selected_mandate_id: 'm1', source: 'matching', context: {}
        }] };
      }
      if (s.includes('FROM users') && s.includes('id::text = ANY($1)')) {
        assert.deepEqual(params[0], ['p1']);
        return { rows: [{ id: 'p1', nome: 'Mario', cognome: 'Rossi' }] };
      }
      if ((s.startsWith('SELECT id, paese_residenza, regione_residenza') && !s.includes('attivisti, organizzazioni')) || (s.includes('LEFT JOIN user_profile p') && !s.includes('u.attivisti'))) {
        return { rows: [{ id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' }] };
      }
      if (s.includes("WHERE LOWER(TRIM(tipologia_evento)) = 'elezioni'")) {
        return { rows: [{ id: 'el1', tipologia_evento: 'Elezioni', tipo_elezione: 'Politiche_nazionali', paese_evento: 'IT', giorno_inizio: '2027-03-01' }] };
      }
      if (s.includes('FROM unita_elettorale ue')) {
        const error = new Error('generic territory schema absent'); error.code = '42703'; throw error;
      }
      if (s.includes('FROM eventi') && !s.includes("LOWER(TRIM(tipologia_evento))")) {
        assert.match(s, /approval_status = 'APPROVED'/);
        return { rows: [
          { id: 'selected', creator_user_id: 'p1', organizzatore: 'Nome variabile', tipologia_evento: 'Altro', comune_evento: 'Lucca', giorno_inizio: '2027-12-01' },
          { id: 'territory', creator_user_id: 'x1', organizzatore: 'Altro', tipologia_evento: 'Altro', comune_evento: 'Pisa', giorno_inizio: '2027-01-10' },
          { id: 'el1', tipologia_evento: 'Elezioni', tipo_elezione: 'Politiche_nazionali', paese_evento: 'IT', giorno_inizio: '2027-03-01' },
          { id: 'ignore', creator_user_id: 'x2', tipologia_evento: 'Altro', comune_evento: 'Lucca', giorno_inizio: '2027-01-01' }
        ] };
      }
      throw new Error(`Unexpected query: ${s}`);
    }
  };

  const feed = await listPersonalizedEvents(pool, 'u1', { futureOnly: true });
  assert.equal(feed.selectionSource, 'CANONICAL');
  assert.deepEqual(feed.events.map((row) => row.id), ['selected', 'territory', 'el1']);
});
