const { finalizeCandidacyProgram } = require('./candidacyProgramService');
const SCHEMA_COMPAT_ERROR_CODES = new Set(['42P01', '42703']);

function buildJurisdictionFromRecognition(r, kind) {
  const suffix = kind === 'candidacy' ? 'candidatura' : 'elezione';
  const jurisdiction = {
    country: r[`paese_${suffix}`] || null,
    region: r[`regione_${suffix}`] || null,
    province: r[`provincia_${suffix}`] || null,
    municipality: r[`comune_${suffix}`] || null,
    level: r[`grado_${suffix}`] || null
  };
  return Object.fromEntries(Object.entries(jurisdiction).filter(([, value]) => value != null && value !== ''));
}

async function upsertRecognitionCandidacy(client, recognition) {
  const jurisdiction = buildJurisdictionFromRecognition(recognition, 'candidacy');
  const electionEventId = recognition.election_event_id || recognition.evento_id || null;
  const electoralUnitId = recognition.electoral_unit_id || recognition.unita_elettorale_id || null;
  const context = {
    recognition_id: recognition.id,
    legacy_role: recognition.tipo_ruolo,
    imported_without_canonical_election: electionEventId == null
  };

  const updated = await client.query(
    `
    UPDATE political_candidacies
    SET election_event_id = COALESCE($2, election_event_id),
        electoral_unit_id = COALESCE($3, electoral_unit_id),
        jurisdiction = $4::jsonb,
        status = 'ACTIVE',
        ends_at = NULL,
        result = NULL,
        source = 'RECOGNITION',
        legacy_context = $5::jsonb,
        updated_at = NOW()
    WHERE user_id = $1
      AND status = 'ACTIVE'
      AND source IN ('LEGACY_BACKFILL', 'RECOGNITION')
    RETURNING id
    `,
    [recognition.user_id, electionEventId, electoralUnitId, JSON.stringify(jurisdiction), JSON.stringify(context)]
  );

  if (updated.rows.length > 0) return updated.rows[0].id;

  const inserted = await client.query(
    `
    INSERT INTO political_candidacies (
      user_id, election_event_id, electoral_unit_id, jurisdiction, status, source, legacy_context
    )
    VALUES ($1, $2, $3, $4::jsonb, 'ACTIVE', 'RECOGNITION', $5::jsonb)
    RETURNING id
    `,
    [recognition.user_id, electionEventId, electoralUnitId, JSON.stringify(jurisdiction), JSON.stringify(context)]
  );
  return inserted.rows[0].id;
}

async function upsertRecognitionMandate(client, recognition) {
  const jurisdiction = buildJurisdictionFromRecognition(recognition, 'mandate');
  const context = {
    recognition_id: recognition.id,
    legacy_role: recognition.tipo_ruolo
  };

  const updated = await client.query(
    `
    UPDATE political_mandates
    SET election_event_id = COALESCE($2, election_event_id),
        office_code = COALESCE($3, office_code),
        jurisdiction = $4::jsonb,
        status = 'ACTIVE',
        ends_at = NULL,
        source = 'RECOGNITION',
        legacy_context = $5::jsonb,
        updated_at = NOW()
    WHERE user_id = $1
      AND status = 'ACTIVE'
      AND source IN ('LEGACY_BACKFILL', 'RECOGNITION')
    RETURNING id
    `,
    [
      recognition.user_id,
      recognition.election_event_id || recognition.evento_id || null,
      recognition.grado_elezione || null,
      JSON.stringify(jurisdiction),
      JSON.stringify(context)
    ]
  );

  if (updated.rows.length > 0) return updated.rows[0].id;

  const inserted = await client.query(
    `
    INSERT INTO political_mandates (
      user_id, election_event_id, office_code, jurisdiction, status, source, legacy_context
    )
    VALUES ($1, $2, $3, $4::jsonb, 'ACTIVE', 'RECOGNITION', $5::jsonb)
    RETURNING id
    `,
    [
      recognition.user_id,
      recognition.election_event_id || recognition.evento_id || null,
      recognition.grado_elezione || null,
      JSON.stringify(jurisdiction),
      JSON.stringify(context)
    ]
  );
  return inserted.rows[0].id;
}

async function mirrorApprovedPoliticalRecognition(client, recognition) {
  const role = recognition.tipo_ruolo;
  if (!['P', 'C', 'CP'].includes(role)) {
    return { usedCapabilityModel: false, reason: 'NOT_POLITICAL_RECOGNITION' };
  }

  await client.query('SAVEPOINT capability_model_sync');
  try {
    let candidacyId = null;
    let mandateId = null;

    if (role === 'C' || role === 'CP') {
      candidacyId = await upsertRecognitionCandidacy(client, recognition);
    }
    if (role === 'P' || role === 'CP') {
      mandateId = await upsertRecognitionMandate(client, recognition);
    }

    await client.query('SELECT refresh_users_legacy_role($1)', [recognition.user_id]);
    await client.query('RELEASE SAVEPOINT capability_model_sync');
    return { usedCapabilityModel: true, candidacyId, mandateId };
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT capability_model_sync');
    await client.query('RELEASE SAVEPOINT capability_model_sync');
    if (SCHEMA_COMPAT_ERROR_CODES.has(error?.code)) {
      return { usedCapabilityModel: false, reason: 'CAPABILITY_SCHEMA_NOT_AVAILABLE' };
    }
    throw error;
  }
}

async function getProgramModelAvailability(client) {
  const result = await client.query(
    `SELECT
       to_regclass('public.political_programs') AS programs,
       to_regclass('public.mandate_program_snapshots') AS snapshots`
  );
  return result.rows[0] || { programs: null, snapshots: null };
}

async function endCandidacy(client, candidacyId, result = 'UNKNOWN', endsAt = new Date(), options = {}) {
  if (!['ELECTED', 'NOT_ELECTED', 'UNKNOWN'].includes(result)) {
    throw new Error(`Invalid candidacy result: ${result}`);
  }
  if (result === 'ELECTED' && !options.mandateId) {
    throw new Error('mandateId is required when ending an elected candidacy');
  }

  const updated = await client.query(
    `
    UPDATE political_candidacies
    SET status = 'ENDED', result = $2, ends_at = $3, updated_at = NOW()
    WHERE id = $1 AND status = 'ACTIVE'
    RETURNING id, user_id, election_event_id, result, ends_at
    `,
    [candidacyId, result, endsAt]
  );
  const row = updated.rows[0] || null;
  if (!row || result === 'UNKNOWN') return row;

  const availability = await getProgramModelAvailability(client);
  const canFinalize = Boolean(availability.programs) && (result !== 'ELECTED' || Boolean(availability.snapshots));
  if (!canFinalize) {
    return { ...row, program_finalization: { applied: false, reason: 'PROGRAM_SCHEMA_NOT_AVAILABLE' } };
  }

  const programFinalization = await finalizeCandidacyProgram(client, {
    candidacyId,
    result,
    mandateId: options.mandateId || null
  });
  return { ...row, program_finalization: { applied: true, ...programFinalization } };
}

async function endMandate(client, mandateId, endsAt = new Date()) {
  const updated = await client.query(
    `
    UPDATE political_mandates
    SET status = 'ENDED', ends_at = $2, updated_at = NOW()
    WHERE id = $1 AND status = 'ACTIVE'
    RETURNING id, user_id, election_event_id, ends_at
    `,
    [mandateId, endsAt]
  );
  return updated.rows[0] || null;
}

module.exports = {
  buildJurisdictionFromRecognition,
  mirrorApprovedPoliticalRecognition,
  endCandidacy,
  endMandate
};
