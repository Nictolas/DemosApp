const SCHEMA_COMPAT_ERROR_CODES = new Set(['42P01', '42703']);

class ProgramDomainError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isProgramSchemaError(error) {
  return SCHEMA_COMPAT_ERROR_CODES.has(error?.code);
}

function buildProgramContent(input = {}) {
  const proposals = [];
  for (let i = 1; i <= 5; i += 1) {
    proposals.push({
      text: String(input[`proposta_${i}`] || ''),
      url: String(input[`url_${i}`] || '')
    });
  }
  return { proposals };
}

function toLegacyProgramView(row) {
  const proposals = Array.isArray(row?.content?.proposals) ? row.content.proposals : [];
  const data = {
    candidacy_id: row?.candidacy_id || null,
    mandate_id: row?.mandate_id || null,
    election_event_id: row?.election_event_id || null,
    electoral_unit_id: row?.electoral_unit_id || null,
    jurisdiction: row?.jurisdiction || null,
    canonical: true,
    frozen: Boolean(row?.frozen_at),
    data_creazione: row?.created_at || row?.frozen_at || null,
    data_modifica: row?.updated_at || row?.frozen_at || null
  };
  for (let i = 1; i <= 5; i += 1) {
    data[`proposta${i}`] = proposals[i - 1]?.text || '';
    data[`url${i}`] = proposals[i - 1]?.url || '';
  }
  return data;
}

async function resolveEditableCandidacy(pool, userId, candidacyId = null) {
  const params = [userId];
  let sql = `
    SELECT id, user_id, election_event_id, electoral_unit_id, jurisdiction, starts_at, ends_at
    FROM political_candidacies
    WHERE user_id = $1 AND status = 'ACTIVE'
  `;
  if (candidacyId) {
    params.push(candidacyId);
    sql += ` AND id = $2`;
  }
  sql += ` ORDER BY starts_at DESC NULLS LAST, created_at DESC`;
  const result = await pool.query(sql, params);

  if (candidacyId && result.rows.length === 0) {
    throw new ProgramDomainError('PROGRAMMA_CANDIDACY_NOT_FOUND', 'Candidatura attiva non trovata per questo profilo.', 404);
  }
  if (!candidacyId && result.rows.length === 0) {
    throw new ProgramDomainError('PROGRAMMA_ACTIVE_CANDIDACY_REQUIRED', 'Serve una candidatura attiva per modificare il Programma.');
  }
  if (!candidacyId && result.rows.length > 1) {
    throw new ProgramDomainError('PROGRAMMA_CANDIDACY_REQUIRED', 'Sono presenti più candidature attive: specifica candidacy_id.');
  }
  return result.rows[0];
}

async function upsertCandidacyProgram(pool, candidacy, input) {
  const content = buildProgramContent(input);
  const result = await pool.query(
    `INSERT INTO political_programs (candidacy_id, user_id, content, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW(), NOW())
     ON CONFLICT (candidacy_id)
     DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
     RETURNING *`,
    [candidacy.id, candidacy.user_id, JSON.stringify(content)]
  );
  return result.rows[0];
}


async function getEditableProgramContextsForUser(pool, userId) {
  const result = await pool.query(
    `SELECT
       pc.id AS candidacy_id, pc.user_id, pc.election_event_id, pc.electoral_unit_id,
       pc.jurisdiction, pc.starts_at, pc.ends_at,
       pp.id AS program_id, pp.content, pp.created_at, pp.updated_at
     FROM political_candidacies pc
     LEFT JOIN political_programs pp ON pp.candidacy_id = pc.id
     WHERE pc.user_id = $1 AND pc.status = 'ACTIVE'
     ORDER BY pc.starts_at DESC NULLS LAST, pc.created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    ...toLegacyProgramView(row),
    has_program: Boolean(row.program_id)
  }));
}

async function getProgramByCandidacy(pool, candidacyId) {
  const result = await pool.query(
    `SELECT pp.*, pc.election_event_id, pc.electoral_unit_id, pc.jurisdiction
     FROM political_programs pp
     JOIN political_candidacies pc ON pc.id = pp.candidacy_id
     WHERE pp.candidacy_id = $1
     LIMIT 1`,
    [candidacyId]
  );
  return result.rows[0] || null;
}

async function getActiveProgramsForUser(pool, userId) {
  const result = await pool.query(
    `SELECT pp.*, pc.election_event_id, pc.electoral_unit_id, pc.jurisdiction, pc.starts_at
     FROM political_programs pp
     JOIN political_candidacies pc ON pc.id = pp.candidacy_id
     WHERE pp.user_id = $1 AND pc.status = 'ACTIVE'
     ORDER BY pc.starts_at DESC NULLS LAST, pp.updated_at DESC`,
    [userId]
  );
  return result.rows;
}

async function getMandateProgramSnapshots(pool, userId) {
  const result = await pool.query(
    `SELECT * FROM mandate_program_snapshots
     WHERE user_id = $1
     ORDER BY frozen_at DESC`,
    [userId]
  );
  return result.rows;
}

async function freezeWinningProgram(client, candidacyId, mandateId) {
  const inserted = await client.query(
    `INSERT INTO mandate_program_snapshots (
       mandate_id, candidacy_id, user_id, election_event_id, content, frozen_at
     )
     SELECT pm.id, pp.candidacy_id, pp.user_id, pc.election_event_id, pp.content, NOW()
     FROM political_programs pp
     JOIN political_candidacies pc ON pc.id = pp.candidacy_id
     JOIN political_mandates pm ON pm.id = $2 AND pm.user_id = pp.user_id
     WHERE pp.candidacy_id = $1
     ON CONFLICT (mandate_id) DO NOTHING
     RETURNING *`,
    [candidacyId, mandateId]
  );
  if (inserted.rows[0]) return inserted.rows[0];
  const existing = await client.query(
    'SELECT * FROM mandate_program_snapshots WHERE mandate_id = $1',
    [mandateId]
  );
  return existing.rows[0] || null;
}

async function finalizeCandidacyProgram(client, { candidacyId, result, mandateId = null }) {
  if (result === 'ELECTED') {
    if (!mandateId) {
      throw new ProgramDomainError('PROGRAMMA_MANDATE_REQUIRED', 'Serve il mandato risultante per congelare il Programma eletto.');
    }
    const snapshot = await freezeWinningProgram(client, candidacyId, mandateId);
    await client.query('DELETE FROM political_programs WHERE candidacy_id = $1', [candidacyId]);
    return { snapshot, discarded: true };
  }
  if (result === 'NOT_ELECTED') {
    await client.query('DELETE FROM political_programs WHERE candidacy_id = $1', [candidacyId]);
    return { snapshot: null, discarded: true };
  }
  return { snapshot: null, discarded: false };
}

module.exports = {
  ProgramDomainError,
  isProgramSchemaError,
  buildProgramContent,
  toLegacyProgramView,
  resolveEditableCandidacy,
  upsertCandidacyProgram,
  getEditableProgramContextsForUser,
  getProgramByCandidacy,
  getActiveProgramsForUser,
  getMandateProgramSnapshots,
  freezeWinningProgram,
  finalizeCandidacyProgram
};
