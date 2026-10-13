const { endCandidacy } = require('./politicalLifecycleService');
const {
  getLegacySelectionField,
  getLegacySelectionFieldsForElectionType,
  resolvePoliticalOffice,
} = require('./politicalJurisdictionRegistryService');

const SCHEMA_ERROR_CODES = new Set(['42P01', '42703', '42883']);

class ElectionLifecycleError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function parseJurisdiction(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function selectionFieldsForCandidacy(candidacy, electionType) {
  const jurisdiction = parseJurisdiction(candidacy?.jurisdiction);
  const level = String(jurisdiction.level || '').trim();
  const directField = getLegacySelectionField('candidate', level);
  if (directField) return [directField];
  return getLegacySelectionFieldsForElectionType('candidate', electionType);
}

function canonicalSelectionTargetForCandidacy(candidacy) {
  const jurisdiction = parseJurisdiction(candidacy?.jurisdiction);
  const level = String(jurisdiction.level || '').trim();
  const office = resolvePoliticalOffice(level);
  return {
    candidacyId: candidacy?.id ? String(candidacy.id) : null,
    selectedUserId: candidacy?.user_id ? String(candidacy.user_id) : null,
    officeId: office?.id || null,
  };
}

async function clearCandidateSelections(client, event, candidacies) {
  let cleared = 0;

  // Canonical store: remove current candidate choices tied to the candidacy being closed.
  // Legacy-backfilled canonical rows may not have selected_candidacy_id; in that case
  // scope the fallback to the same selected user and political office.
  for (const candidacy of candidacies) {
    const target = canonicalSelectionTargetForCandidacy(candidacy);
    if (!target.candidacyId) continue;
    const values = [target.candidacyId];
    let predicate = 'selected_candidacy_id::text = $1::text';
    if (target.selectedUserId && target.officeId) {
      values.push(target.selectedUserId, target.officeId);
      predicate += ` OR (
        selected_candidacy_id IS NULL
        AND selected_user_id::text = $2::text
        AND political_office_id = $3
      )`;
    }
    try {
      const canonicalResult = await client.query(
        `DELETE FROM political_selections
         WHERE selection_kind = 'candidate'
           AND (${predicate})`,
        values,
      );
      cleared += canonicalResult.rowCount || 0;
    } catch (error) {
      if (!SCHEMA_ERROR_CODES.has(error?.code)) throw error;
    }
  }

  const idsByField = new Map();
  for (const candidacy of candidacies) {
    for (const field of selectionFieldsForCandidacy(candidacy, event.tipo_elezione)) {
      const ids = idsByField.get(field) || new Set();
      ids.add(String(candidacy.user_id));
      idsByField.set(field, ids);
    }
  }

  const representativesTable = await client.query(
    `SELECT to_regclass('public.user_representatives') AS table_name`
  );
  let representativeColumns = new Set();
  if (representativesTable.rows[0]?.table_name) {
    const columnsResult = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_representatives'`
    );
    representativeColumns = new Set(columnsResult.rows.map((row) => row.column_name));
  }

  for (const [field, ids] of idsByField.entries()) {
    const values = [...ids];
    if (!values.length) continue;
    const result = await client.query(
      `UPDATE users
       SET ${field} = NULL
       WHERE ${field}::text = ANY($1::text[])`,
      [values],
    );
    cleared += result.rowCount || 0;

    if (representativeColumns.has(field)) {
      await client.query(
        `UPDATE user_representatives
         SET ${field} = NULL
         WHERE ${field}::text = ANY($1::text[])`,
        [values],
      );
    }
  }
  return cleared;
}

async function closeElectionLifecycle(client, { eventId, closedByUserId, closedAt = new Date() }) {
  let eventResult;
  try {
    eventResult = await client.query(
      `SELECT id, tipologia_evento, tipo_elezione, giorno_inizio, giorno_fine,
              election_lifecycle_closed_at, election_lifecycle_closed_by_user_id,
              COALESCE(giorno_fine, giorno_inizio) AS election_end_date,
              (COALESCE(giorno_fine, giorno_inizio) <= CURRENT_DATE) AS has_ended
       FROM eventi
       WHERE id = $1
       FOR UPDATE`,
      [eventId],
    );
  } catch (error) {
    if (SCHEMA_ERROR_CODES.has(error?.code)) {
      throw new ElectionLifecycleError(
        'ELECTION_LIFECYCLE_SCHEMA_REQUIRED',
        'La migrazione lifecycle elezioni deve essere applicata prima della chiusura.',
        503,
      );
    }
    throw error;
  }

  const event = eventResult.rows[0] || null;
  if (!event) throw new ElectionLifecycleError('ELECTION_NOT_FOUND', 'Evento elettorale non trovato.', 404);
  if (String(event.tipologia_evento || '').trim().toLowerCase() !== 'elezioni') {
    throw new ElectionLifecycleError('NOT_AN_ELECTION_EVENT', 'Questo evento non è un evento elettorale.', 400);
  }
  if (!event.election_end_date) {
    throw new ElectionLifecycleError('ELECTION_END_DATE_REQUIRED', 'La data di chiusura dell’elezione è obbligatoria.');
  }
  if (!event.has_ended) {
    throw new ElectionLifecycleError('ELECTION_NOT_ENDED', 'L’elezione non è ancora terminata.');
  }
  if (event.election_lifecycle_closed_at) {
    return {
      alreadyClosed: true,
      eventId: String(event.id),
      closedAt: event.election_lifecycle_closed_at,
      closedByUserId: event.election_lifecycle_closed_by_user_id || null,
      candidaciesEnded: 0,
      elected: 0,
      notElected: 0,
      supporterSelectionsCleared: 0,
    };
  }

  const candidacyResult = await client.query(
    `SELECT id, user_id, election_event_id, electoral_unit_id, jurisdiction
     FROM political_candidacies
     WHERE election_event_id = $1 AND status = 'ACTIVE'
     ORDER BY created_at ASC, id ASC`,
    [eventId],
  );
  const candidacies = candidacyResult.rows;

  const mandateResult = await client.query(
    `SELECT id, user_id
     FROM political_mandates
     WHERE election_event_id = $1 AND status = 'ACTIVE'
     ORDER BY starts_at DESC, created_at DESC`,
    [eventId],
  );
  const mandateByUser = new Map();
  for (const mandate of mandateResult.rows) {
    const key = String(mandate.user_id);
    if (!mandateByUser.has(key)) mandateByUser.set(key, mandate);
  }

  let elected = 0;
  let notElected = 0;
  for (const candidacy of candidacies) {
    const mandate = mandateByUser.get(String(candidacy.user_id)) || null;
    if (mandate) {
      await endCandidacy(client, candidacy.id, 'ELECTED', closedAt, { mandateId: mandate.id });
      elected += 1;
    } else {
      await endCandidacy(client, candidacy.id, 'NOT_ELECTED', closedAt);
      notElected += 1;
    }
  }

  const supporterSelectionsCleared = await clearCandidateSelections(client, event, candidacies);

  for (const userId of [...new Set(candidacies.map((row) => String(row.user_id)))]) {
    await client.query('SELECT refresh_users_legacy_role($1)', [userId]);
  }

  await client.query(
    `UPDATE eventi
     SET election_lifecycle_closed_at = $2,
         election_lifecycle_closed_by_user_id = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [eventId, closedAt, closedByUserId || null],
  );

  return {
    alreadyClosed: false,
    eventId: String(event.id),
    closedAt,
    closedByUserId: closedByUserId || null,
    candidaciesEnded: candidacies.length,
    elected,
    notElected,
    supporterSelectionsCleared,
  };
}

module.exports = {
  ElectionLifecycleError,
  selectionFieldsForCandidacy,
  canonicalSelectionTargetForCandidacy,
  clearCandidateSelections,
  closeElectionLifecycle,
};
