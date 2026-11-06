'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listEligibleRepresentatives } = require('../services/politicalEligibilityService');

test('provincial mandate list never substitutes a derived regional mandate', async () => {
  const db = { async query(sql) {
    const statement = String(sql);
    if (statement.includes('FROM user_political_territories')) {
      const error = new Error('synthetic absent territory table');
      error.code = '42P01';
      throw error;
    }
    if (statement.includes('FROM users WHERE id = $1')) {
      return { rows: [{ id: 'resident', paese_residenza: 'IT', provincia_residenza: 'TN' }] };
    }
    if (statement.includes('FROM political_mandates')) {
      return { rows: [
        { id: 'same-person', mandate_id: 'regional-only', grado_elezione: 'R', jurisdiction: { province: 'TN' } },
        { id: 'same-person', mandate_id: 'direct-provincial', grado_elezione: 'CONSIGLIO_PROVINCIALE_TRENTO', jurisdiction: { province: 'TN' } },
        { id: 'regional-person', mandate_id: 'regional-only-2', grado_elezione: 'R', jurisdiction: { province: 'TN' } },
        { id: 'missing-office', mandate_id: 'missing', grado_elezione: null, jurisdiction: { province: 'TN' } },
        { id: 'unknown-office', mandate_id: 'unknown', grado_elezione: 'NOT_A_REAL_OFFICE', jurisdiction: { province: 'TN' } },
        { id: 'other-province', mandate_id: 'bolzano', grado_elezione: 'CONSIGLIO_PROVINCIALE_BOLZANO', jurisdiction: { province: 'BZ' } },
        { id: 'foreign-jurisdiction', mandate_id: 'foreign', grado_elezione: 'CONSIGLIO_PROVINCIALE_TRENTO', jurisdiction: { province: 'TN', country: 'US' } },
        { id: 'foreign-code', mandate_id: 'foreign-code', grado_elezione: 'CONSIGLIO_PROVINCIALE_TRENTO', jurisdiction: { province: 'TN', countryCode: 'DE' } },
        { id: 'same-person', mandate_id: 'duplicate-provincial', grado_elezione: 'CONSIGLIO_PROVINCIALE_TRENTO', jurisdiction: { province: 'TN' } },
      ] };
    }
    throw new Error('Unexpected synthetic SQL');
  } };

  const result = await listEligibleRepresentatives(db, 'resident', 'it.provincial.trento');
  assert.equal(result.strict, true);
  assert.deepEqual(result.subjects.map((row) => row.id), ['same-person']);
  assert.equal(result.subjects[0].mandate_id, 'direct-provincial');
});
