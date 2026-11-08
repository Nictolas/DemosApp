'use strict';

// PROD-041: backend-only verified current state, never append nominal history.
// The UNIQUE primary key and conditional UPSERT make old/out-of-order syncs safe.
const VALID_VOTES = new Set([
  'Favorevole', 'Contrario', 'Astensione', 'Astenuto', 'Astenuto R',
  'Assente', 'In missione', 'In congedo', 'Non ha partecipato',
  'Presente non votante', 'Presidente di turno'
]);
const SOURCES = {
  Camera: { type: 'camera_ufficiale', host: 'documenti.camera.it' },
  Senato: { type: 'senato_openpolis', host: 'parlamento19.openpolis.it' },
  PE: { type: 'pe_ufficiale', host: 'data.europarl.europa.eu' }
};

function assertVerifiedVote(vote) {
  if (!vote || !Object.hasOwn(SOURCES, vote.institution)) throw new Error('CURRENT_VOTE_INVALID_INSTITUTION');
  const key = String(vote.representativeKey || '');
  if (!/^(?:demos:[0-9a-f]{8}-[0-9a-f-]{27,40}|pe:[0-9]+|official:[a-z0-9:/._-]+)$/i.test(key) ||
      key.length > 180) throw new Error('CURRENT_VOTE_STABLE_ID_REQUIRED');
  if (!/^[a-zA-Z0-9._:/-]{3,200}$/.test(String(vote.ballotId || '')))
    throw new Error('CURRENT_VOTE_BALLOT_ID_REQUIRED');
  const date = String(vote.voteDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + 'T00:00:00Z')) ||
      new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date)
    throw new Error('CURRENT_VOTE_DATE_INVALID');
  if (!Number.isSafeInteger(vote.ballotOrder) || vote.ballotOrder < 0)
    throw new Error('CURRENT_VOTE_SEQUENCE_REQUIRED');
  if (!VALID_VOTES.has(vote.status)) throw new Error('CURRENT_VOTE_STATUS_UNVERIFIED');
  if (typeof vote.ballotTitle !== 'string' || !vote.ballotTitle.trim() || vote.ballotTitle.length > 2000)
    throw new Error('CURRENT_VOTE_TITLE_REQUIRED');
  if (vote.verified !== true || vote.sourceType !== SOURCES[vote.institution].type)
    throw new Error('CURRENT_VOTE_VERIFICATION_REQUIRED');
  let url;
  try { url = new URL(vote.sourceUrl); } catch { throw new Error('CURRENT_VOTE_SOURCE_INVALID'); }
  if (url.protocol !== 'https:' || url.hostname !== SOURCES[vote.institution].host ||
      url.username || url.password) throw new Error('CURRENT_VOTE_SOURCE_INVALID');
  // A DEMOS UUID alone proves the storage key, NOT the identity of the
  // person named in a roll call. The source person ID is mandatory for writes.
  const sourcePersonId = vote.sourcePersonId;
  if (typeof sourcePersonId !== 'string' || !sourcePersonId.trim() ||
      sourcePersonId.length > 250) throw new Error('CURRENT_VOTE_SOURCE_PERSON_REQUIRED');
  if (vote.institution === 'PE') {
    if (!/^[1-9]\d{0,8}$/.test(sourcePersonId))
      throw new Error('CURRENT_VOTE_SOURCE_PERSON_INVALID');
  } else {
    let personUrl;
    try { personUrl = new URL(sourcePersonId); } catch {
      throw new Error('CURRENT_VOTE_SOURCE_PERSON_INVALID');
    }
    const allowed = vote.institution === 'Camera'
      ? ['camera.it','www.camera.it','documenti.camera.it','dati.camera.it']
      : ['parlamento19.openpolis.it','senato.it','www.senato.it','dati.senato.it'];
    if (!['http:', 'https:'].includes(personUrl.protocol) ||
        !allowed.includes(personUrl.hostname.toLowerCase()) ||
        personUrl.username || personUrl.password || personUrl.hash ||
        !/\/(?:deputat|senat|person|ocd\/deputato)/i.test(personUrl.pathname))
      throw new Error('CURRENT_VOTE_SOURCE_PERSON_INVALID');
  }
  return { ...vote, representativeKey:key, voteDate:date, sourceUrl:url.toString() };
}

const UPSERT_CURRENT_VOTE_SQL = `
  INSERT INTO public.institutional_current_nominal_votes
    (institution, representative_key, source_person_id, ballot_id,
     vote_date, ballot_order, vote, ballot_title, source_url, source_type)
  VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10)
  ON CONFLICT (representative_key) DO UPDATE SET
    institution = EXCLUDED.institution,
    source_person_id = EXCLUDED.source_person_id,
    ballot_id = EXCLUDED.ballot_id,
    vote_date = EXCLUDED.vote_date,
    ballot_order = EXCLUDED.ballot_order,
    vote = EXCLUDED.vote,
    ballot_title = EXCLUDED.ballot_title,
    source_url = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    verified_at = now()
  WHERE institutional_current_nominal_votes.vote_date < EXCLUDED.vote_date
     OR (institutional_current_nominal_votes.vote_date = EXCLUDED.vote_date
         AND institutional_current_nominal_votes.institution = EXCLUDED.institution
         AND institutional_current_nominal_votes.ballot_order < EXCLUDED.ballot_order)
  RETURNING institution, representative_key, ballot_id, vote_date, vote
`;

async function upsertVerifiedCurrentVote(db, raw) {
  const vote = assertVerifiedVote(raw); // fail closed before any DB access
  const values = [vote.institution, vote.representativeKey, vote.sourcePersonId,
    vote.ballotId, vote.voteDate, vote.ballotOrder, vote.status,
    vote.ballotTitle.trim(), vote.sourceUrl, vote.sourceType];
  const { rows } = await db.query(UPSERT_CURRENT_VOTE_SQL, values);
  return { changed: rows.length === 1, current: rows[0] || null };
}

async function getCurrentVote(db, institution, representativeKey) {
  if (!Object.hasOwn(SOURCES, institution) || typeof representativeKey !== 'string' ||
      representativeKey.length > 180) throw new Error('CURRENT_VOTE_INVALID_LOOKUP');
  const { rows } = await db.query(
    `SELECT institution, representative_key, ballot_id, vote_date, ballot_order,
            vote, ballot_title, source_url, source_type
       FROM public.institutional_current_nominal_votes
      WHERE institution = $1 AND representative_key = $2 LIMIT 1`,
    [institution, representativeKey]);
  return rows[0] || null;
}

module.exports = { assertVerifiedVote, UPSERT_CURRENT_VOTE_SQL,
  upsertVerifiedCurrentVote, getCurrentVote };
