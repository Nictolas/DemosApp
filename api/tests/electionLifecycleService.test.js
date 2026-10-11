const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ElectionLifecycleError,
  selectionFieldsForCandidacy,
  canonicalSelectionTargetForCandidacy,
  closeElectionLifecycle,
} = require('../services/electionLifecycleService');

test('candidate support field is derived from candidacy level before event fallback', () => {
  assert.deepEqual(selectionFieldsForCandidacy({ jurisdiction: { level: 'E' } }, 'nazionali'), ['candidato_europeo']);
  assert.deepEqual(selectionFieldsForCandidacy({ jurisdiction: { level: 'C' } }, 'politiche_nazionali'), ['candidato_camera']);
  assert.deepEqual(selectionFieldsForCandidacy({ jurisdiction: { level: 'S' } }, 'politiche_nazionali'), ['candidato_senato']);
  assert.deepEqual(selectionFieldsForCandidacy({ jurisdiction: { level: 'R' } }, 'regionali'), ['candidato_regionale']);
  assert.deepEqual(selectionFieldsForCandidacy({ jurisdiction: { level: 'CO' } }, 'comunali'), ['candidato_comune']);
});

test('canonical candidate selection target is scoped to candidacy, user and office', () => {
  assert.deepEqual(
    canonicalSelectionTargetForCandidacy({ id: 'cand-r', user_id: 'u-r', jurisdiction: { level: 'R' } }),
    { candidacyId: 'cand-r', selectedUserId: 'u-r', officeId: 'it.regional' },
  );
});

test('national event fallback clears both Camera and Senato only when candidacy level is unavailable', () => {
  assert.deepEqual(selectionFieldsForCandidacy({ jurisdiction: {} }, 'politiche_nazionali'), ['candidato_camera', 'candidato_senato']);
});

function makeLifecycleClient({ ended = true, alreadyClosed = false } = {}) {
  const calls = [];
  const client = {
    calls,
    async query(sql, values = []) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ s, values });

      if (s.includes('FROM eventi') && s.includes('FOR UPDATE')) {
        return {
          rows: [{
            id: 'event-1', tipologia_evento: 'Elezioni', tipo_elezione: 'regionali',
            giorno_inizio: '2026-10-08', giorno_fine: '2026-10-08',
            election_end_date: '2026-10-08', has_ended: ended,
            election_lifecycle_closed_at: alreadyClosed ? '2026-10-09T10:00:00Z' : null,
            election_lifecycle_closed_by_user_id: alreadyClosed ? 'admin-old' : null,
          }],
        };
      }
      if (s.includes('FROM political_candidacies') && s.includes("status = 'ACTIVE'")) {
        return { rows: [
          { id: 'cand-win', user_id: 'u-win', election_event_id: 'event-1', jurisdiction: { level: 'R' } },
          { id: 'cand-lose', user_id: 'u-lose', election_event_id: 'event-1', jurisdiction: { level: 'R' } },
        ] };
      }
      if (s.includes('FROM political_mandates') && s.includes("status = 'ACTIVE'")) {
        return { rows: [{ id: 'mand-1', user_id: 'u-win' }] };
      }
      if (s.startsWith('UPDATE political_candidacies')) {
        return { rows: [{ id: values[0], user_id: values[0] === 'cand-win' ? 'u-win' : 'u-lose', result: values[1], ends_at: values[2] }] };
      }
      if (s.includes("to_regclass('public.political_programs')")) {
        return { rows: [{ programs: null, snapshots: null }] };
      }
      if (s.startsWith('DELETE FROM political_selections')) {
        return { rows: [], rowCount: 1 };
      }
      if (s.includes("to_regclass('public.user_representatives')")) {
        return { rows: [{ table_name: null }] };
      }
      if (s.startsWith('UPDATE users SET candidato_regionale = NULL')) {
        return { rows: [], rowCount: 4 };
      }
      if (s.startsWith('SELECT refresh_users_legacy_role')) return { rows: [] };
      if (s.startsWith('UPDATE eventi SET election_lifecycle_closed_at')) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected query: ${s}`);
    },
  };
  return client;
}

test('closure marks mandate-linked candidate ELECTED, others NOT_ELECTED and clears canonical plus legacy support', async () => {
  const client = makeLifecycleClient();
  const result = await closeElectionLifecycle(client, {
    eventId: 'event-1',
    closedByUserId: 'admin-1',
    closedAt: new Date('2026-10-09T12:00:00Z'),
  });

  assert.equal(result.alreadyClosed, false);
  assert.equal(result.candidaciesEnded, 2);
  assert.equal(result.elected, 1);
  assert.equal(result.notElected, 1);
  assert.equal(result.supporterSelectionsCleared, 6);

  const endedCalls = client.calls.filter((call) => call.s.startsWith('UPDATE political_candidacies'));
  assert.deepEqual(endedCalls.map((call) => call.values[1]), ['ELECTED', 'NOT_ELECTED']);
  const canonicalDeleteCalls = client.calls.filter((call) => call.s.startsWith('DELETE FROM political_selections'));
  assert.equal(canonicalDeleteCalls.length, 2);
  assert.ok(canonicalDeleteCalls.every((call) => call.s.includes("selection_kind = 'candidate'")));
  assert.ok(canonicalDeleteCalls.every((call) => call.s.includes('selected_candidacy_id::text = $1::text')));
  assert.ok(canonicalDeleteCalls.every((call) => call.values[2] === 'it.regional'));
  assert.ok(client.calls.some((call) => call.s.includes('UPDATE users SET candidato_regionale = NULL')));
  assert.ok(client.calls.some((call) => call.s.includes('UPDATE eventi SET election_lifecycle_closed_at')));
});

test('closure refuses an election whose real end date is still in the future', async () => {
  const client = makeLifecycleClient({ ended: false });
  await assert.rejects(
    () => closeElectionLifecycle(client, { eventId: 'event-1', closedByUserId: 'admin-1' }),
    (error) => error instanceof ElectionLifecycleError && error.code === 'ELECTION_NOT_ENDED',
  );
  assert.equal(client.calls.some((call) => call.s.includes('FROM political_candidacies')), false);
});

test('closure is idempotent after lifecycle timestamp is set', async () => {
  const client = makeLifecycleClient({ alreadyClosed: true });
  const result = await closeElectionLifecycle(client, { eventId: 'event-1', closedByUserId: 'admin-1' });
  assert.equal(result.alreadyClosed, true);
  assert.equal(result.candidaciesEnded, 0);
  assert.equal(client.calls.some((call) => call.s.includes('FROM political_candidacies')), false);
});
