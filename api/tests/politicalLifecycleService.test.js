const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildJurisdictionFromRecognition,
  mirrorApprovedPoliticalRecognition,
  endCandidacy,
  endMandate
} = require('../services/politicalLifecycleService');

test('builds jurisdiction from candidacy and mandate legacy fields', () => {
  const r = {
    paese_candidatura: 'it', regione_candidatura: 'Toscana', grado_candidatura: 'R',
    paese_elezione: 'it', comune_elezione: 'Pisa', grado_elezione: 'CO'
  };
  assert.deepEqual(buildJurisdictionFromRecognition(r, 'candidacy'), {
    country: 'it', region: 'Toscana', level: 'R'
  });
  assert.deepEqual(buildJurisdictionFromRecognition(r, 'mandate'), {
    country: 'it', municipality: 'Pisa', level: 'CO'
  });
});

test('CP recognition mirrors both candidacy and mandate and refreshes compatibility role', async () => {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql: String(sql).trim(), values });
      const s = String(sql);
      if (s.includes('UPDATE political_candidacies')) return { rows: [] };
      if (s.includes('INSERT INTO political_candidacies')) return { rows: [{ id: 'cand-1' }] };
      if (s.includes('UPDATE political_mandates')) return { rows: [] };
      if (s.includes('INSERT INTO political_mandates')) return { rows: [{ id: 'mand-1' }] };
      return { rows: [] };
    }
  };

  const result = await mirrorApprovedPoliticalRecognition(client, {
    id: 'rec-1', user_id: 'user-1', tipo_ruolo: 'CP',
    grado_candidatura: 'R', regione_candidatura: 'Toscana',
    grado_elezione: 'C', paese_elezione: 'it'
  });

  assert.deepEqual(result, {
    usedCapabilityModel: true,
    candidacyId: 'cand-1',
    mandateId: 'mand-1'
  });
  assert.equal(calls[0].sql, 'SAVEPOINT capability_model_sync');
  assert.ok(calls.some((c) => c.sql.includes('refresh_users_legacy_role')));
  assert.equal(calls.at(-1).sql, 'RELEASE SAVEPOINT capability_model_sync');
});

test('schema compatibility error rolls back capability sub-transaction and keeps legacy flow available', async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(String(sql).trim());
      if (String(sql).includes('UPDATE political_candidacies')) {
        const error = new Error('relation missing');
        error.code = '42P01';
        throw error;
      }
      return { rows: [] };
    }
  };

  const result = await mirrorApprovedPoliticalRecognition(client, {
    id: 'rec-2', user_id: 'user-2', tipo_ruolo: 'C'
  });

  assert.equal(result.usedCapabilityModel, false);
  assert.equal(result.reason, 'CAPABILITY_SCHEMA_NOT_AVAILABLE');
  assert.ok(calls.includes('ROLLBACK TO SAVEPOINT capability_model_sync'));
  assert.ok(calls.includes('RELEASE SAVEPOINT capability_model_sync'));
});

test('non political recognitions are ignored by political mirror', async () => {
  const client = { async query() { throw new Error('must not query'); } };
  const result = await mirrorApprovedPoliticalRecognition(client, {
    id: 'rec-3', user_id: 'user-3', tipo_ruolo: 'A'
  });
  assert.deepEqual(result, { usedCapabilityModel: false, reason: 'NOT_POLITICAL_RECOGNITION' });
});

test('ending a candidacy records result and ending a mandate closes only active row', async () => {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql: String(sql), values });
      if (String(sql).includes('political_candidacies')) {
        return { rows: [{ id: 'c1', user_id: 'u1', result: values[1], ends_at: values[2] }] };
      }
      if (String(sql).includes('to_regclass')) return { rows: [{ programs: null, snapshots: null }] };
      if (String(sql).includes('political_mandates')) return { rows: [{ id: 'm1', user_id: 'u1', ends_at: values[1] }] };
      return { rows: [] };
    }
  };
  const at = new Date('2026-10-08T12:00:00Z');
  const c = await endCandidacy(client, 'c1', 'NOT_ELECTED', at);
  const m = await endMandate(client, 'm1', at);
  assert.equal(c.result, 'NOT_ELECTED');
  assert.equal(m.id, 'm1');
  assert.ok(calls[0].sql.includes("status = 'ENDED'"));
  assert.ok(calls.some((call) => call.sql.includes('political_mandates') && call.sql.includes("status = 'ENDED'")));
});

test('invalid candidacy result is rejected before database write', async () => {
  const client = { async query() { throw new Error('must not query'); } };
  await assert.rejects(() => endCandidacy(client, 'c1', 'WINNER'), /Invalid candidacy result/);
});


test('ending a losing candidacy discards canonical editable program when model is installed', async () => {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      const s = String(sql);
      calls.push({ s, values });
      if (s.includes('UPDATE political_candidacies')) return { rows: [{ id: 'c1', user_id: 'u1', result: values[1] }] };
      if (s.includes('to_regclass')) return { rows: [{ programs: 'political_programs', snapshots: 'mandate_program_snapshots' }] };
      if (s.includes('DELETE FROM political_programs')) return { rows: [] };
      return { rows: [] };
    }
  };
  const result = await endCandidacy(client, 'c1', 'NOT_ELECTED', new Date('2026-10-08T12:00:00Z'));
  assert.equal(result.program_finalization.applied, true);
  assert.equal(result.program_finalization.discarded, true);
  assert.ok(calls.some((call) => call.s.includes('DELETE FROM political_programs')));
});

test('elected candidacy requires mandate and freezes program snapshot', async () => {
  const noWrite = { async query() { throw new Error('must not query without mandate'); } };
  await assert.rejects(
    () => endCandidacy(noWrite, 'c1', 'ELECTED', new Date(), {}),
    /mandateId is required/
  );

  const calls = [];
  const client = {
    async query(sql, values = []) {
      const s = String(sql);
      calls.push({ s, values });
      if (s.includes('UPDATE political_candidacies')) return { rows: [{ id: 'c1', user_id: 'u1', result: 'ELECTED' }] };
      if (s.includes('to_regclass')) return { rows: [{ programs: 'political_programs', snapshots: 'mandate_program_snapshots' }] };
      if (s.includes('INSERT INTO mandate_program_snapshots')) return { rows: [{ mandate_id: 'm1', candidacy_id: 'c1' }] };
      if (s.includes('DELETE FROM political_programs')) return { rows: [] };
      return { rows: [] };
    }
  };
  const result = await endCandidacy(client, 'c1', 'ELECTED', new Date(), { mandateId: 'm1' });
  assert.equal(result.program_finalization.applied, true);
  assert.equal(result.program_finalization.snapshot.mandate_id, 'm1');
  assert.ok(calls.some((call) => call.s.includes('INSERT INTO mandate_program_snapshots')));
});
