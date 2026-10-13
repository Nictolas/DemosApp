'use strict';

const { listRelevantElectionEvents } = require('./electionEventService');
const { regionAliases } = require('./politicalEligibilityService');
const { isApprovalSchemaError } = require('./eventApprovalService');
const { loadPoliticalSelections } = require('./politicalSelectionService');

function normalize(value) {
  return value == null ? '' : String(value).trim().toLocaleLowerCase('it-IT');
}

function sameText(a, b) {
  return Boolean(normalize(a) && normalize(a) === normalize(b));
}

// Compatibility helper for pre-canonical callers/tests. Political selections are now
// loaded through politicalSelectionService; activist/organization choices still live
// on the user compatibility projection for the moment.
function selectedSubjectIds(user) {
  return [...new Set([
    user.rappresentante_europeo,
    user.rappresentante_camera,
    user.rappresentante_senato,
    user.rappresentante_regionale,
    user.rappresentante_comune,
    user.candidato_europeo,
    user.candidato_camera,
    user.candidato_senato,
    user.candidato_regionale,
    user.candidato_comune,
    user.attivisti,
    user.organizzazioni
  ].filter(Boolean).map(String))];
}

async function getFeedUser(pool, userId) {
  const result = await pool.query(
    `SELECT id, paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
            attivisti, organizzazioni
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getSelectedSubjects(pool, user) {
  const selectionState = await loadPoliticalSelections(pool, { userId: user.id });
  const ids = [...new Set([
    ...(selectionState.selections || []).map((selection) => selection.selectedUserId),
    user.attivisti,
    user.organizzazioni
  ].filter(Boolean).map(String))];

  if (!ids.length) {
    return { ids: new Set(), names: new Set(), source: selectionState.source };
  }

  const result = await pool.query(
    `SELECT id, nome, cognome
     FROM users
     WHERE id::text = ANY($1)`,
    [ids]
  );

  return {
    ids: new Set(ids),
    names: new Set(result.rows
      .map((row) => normalize(`${row.nome || ''} ${row.cognome || ''}`))
      .filter(Boolean)),
    source: selectionState.source
  };
}

function eventTimestamp(event) {
  if (!event.giorno_inizio) return Number.POSITIVE_INFINITY;
  const time = event.orario_inizio ? String(event.orario_inizio).slice(0, 8) : '00:00:00';
  const value = Date.parse(`${event.giorno_inizio}T${time}`);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function eventTerritoryMatches(user, event) {
  if (event.comune_evento) return sameText(event.comune_evento, user.comune_residenza);
  if (event.provincia_evento) return sameText(event.provincia_evento, user.provincia_residenza);
  if (event.regione_evento) {
    return regionAliases(user.regione_residenza).includes(normalize(event.regione_evento));
  }
  return false;
}

function classifyFeedEvent(event, { selectedIds = new Set(), selectedNames = new Set(), user, relevantElectionIds }) {
  const isElection = normalize(event.tipologia_evento) === 'elezioni';
  const canonicalSelectedSubject = Boolean(event.creator_user_id) && selectedIds.has(String(event.creator_user_id));
  const legacySelectedSubject = !event.creator_user_id && selectedNames.has(normalize(event.organizzatore));
  const selectedSubject = canonicalSelectedSubject || legacySelectedSubject;
  const territory = eventTerritoryMatches(user, event);
  const relevantElection = isElection && relevantElectionIds.has(String(event.id));

  if (selectedSubject) return { include: true, priority: 0, reason: 'SELECTED_SUBJECT' };
  if (territory) return { include: true, priority: 1, reason: 'TERRITORY' };
  if (relevantElection) return { include: true, priority: 2, reason: 'RELEVANT_ELECTION' };
  return { include: false, priority: 99, reason: null };
}

function rankFeedEvents(events, context) {
  return events
    .map((event) => ({ event, classification: classifyFeedEvent(event, context) }))
    .filter(({ classification }) => classification.include)
    .sort((a, b) => {
      if (a.classification.priority !== b.classification.priority) {
        return a.classification.priority - b.classification.priority;
      }
      const dateDiff = eventTimestamp(a.event) - eventTimestamp(b.event);
      if (dateDiff !== 0) return dateDiff;
      return String(a.event.id).localeCompare(String(b.event.id));
    })
    .map(({ event, classification }) => ({
      ...event,
      feed_reason: classification.reason,
      feed_priority: classification.priority
    }));
}

async function listPersonalizedEvents(pool, userId, { futureOnly = false } = {}) {
  const user = await getFeedUser(pool, userId);
  if (!user) return { user: null, events: [] };

  const [selectedSubjects, relevantElections] = await Promise.all([
    getSelectedSubjects(pool, user),
    listRelevantElectionEvents(pool, userId)
  ]);

  let sql = `
    SELECT id, nome_evento, tipologia_evento, tipo_elezione,
           paese_evento, regione_evento, provincia_evento, comune_evento,
           indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine,
           orario_inizio_giorno2, orario_fine_giorno2, organizzatore, creator_user_id, created_at
    FROM eventi
  `;
  if (futureOnly) {
    sql += ` WHERE giorno_inizio IS NOT NULL AND COALESCE(giorno_fine, giorno_inizio) >= CURRENT_DATE`;
  }
  sql += ` ORDER BY giorno_inizio ASC NULLS LAST, orario_inizio ASC NULLS LAST, created_at ASC`;

  const approvalClause = futureOnly ? ` AND approval_status = 'APPROVED'` : ` WHERE approval_status = 'APPROVED'`;
  const orderClause = ` ORDER BY giorno_inizio ASC NULLS LAST, orario_inizio ASC NULLS LAST, created_at ASC`;
  const approvedSql = sql.replace(orderClause, `${approvalClause}${orderClause}`);
  let result;
  try {
    result = await pool.query(approvedSql);
  } catch (error) {
    if (!isApprovalSchemaError(error)) throw error;
    // Before the additive approval migration only Admin can create events, so legacy rows
    // are already-published compatibility data. Non-admin writes fail closed in eventi.js.
    result = await pool.query(sql);
  }

  const relevantElectionIds = new Set(relevantElections.map((event) => String(event.id)));
  const events = rankFeedEvents(result.rows, {
    selectedIds: selectedSubjects.ids,
    selectedNames: selectedSubjects.names,
    user,
    relevantElectionIds
  });

  return { user, events, selectionSource: selectedSubjects.source };
}

module.exports = {
  selectedSubjectIds,
  eventTerritoryMatches,
  classifyFeedEvent,
  rankFeedEvents,
  listPersonalizedEvents
};
