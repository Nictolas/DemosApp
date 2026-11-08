'use strict';

// PROD-041: independent adapter for explicitly attributed, verified EP roll-call
// records. No UI edits, no party/group fields, and NO inference of absence.
// The EP pipeline managed separately must confirm chronology and provenance
// before invoking this service. This module does not enable a sync job.
const { upsertVerifiedCurrentVote } = require('./institutionalCurrentNominalVotesService');

const SOURCE_HOST = 'data.europarl.europa.eu';
function stableMepId(raw) {
  const value = typeof raw === 'string' ? raw : raw && typeof raw === 'object'
    ? (raw.id || raw['@id'] || raw.person_id || raw.mep_id) : null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const str = String(value).trim();
  if (/^[1-9]\d{0,8}$/.test(str)) return str;
  let url;
  try { url = new URL(str); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== SOURCE_HOST ||
      url.username || url.password || url.search || url.hash) return null;
  const suffix = url.pathname.match(/\/([1-9]\d{0,8})\/?$/);
  return suffix ? suffix[1] : null;
}

function extractExplicitItalianVotes(voteResult, italianMepMap, meta) {
  if (!(italianMepMap instanceof Map) || !italianMepMap.size ||
      !voteResult || typeof voteResult !== 'object' || !meta ||
      meta.verified !== true || meta.sourceType !== 'pe_ufficiale')
    throw new Error('EP_CURRENT_SOURCE_UNVERIFIED');
  if (!['string', 'number'].includes(typeof meta.ballotId) || !meta.ballotTitle ||
      !meta.voteDate || !Number.isSafeInteger(meta.ballotOrder) ||
      meta.ballotOrder < 0 || typeof meta.sourceUrl !== 'string')
    throw new Error('EP_CURRENT_BALLOT_METADATA_MISSING');

  const eligible = new Set();
  for (const [rawKey, mep] of italianMepMap) {
    const fromKey = stableMepId(rawKey), fromValue = stableMepId(mep?.id);
    if (!fromKey || (mep?.id && fromKey !== fromValue) || eligible.has(fromKey)) {
      throw new Error('EP_CURRENT_AMBIGUOUS_MEP_ID');
    }
    eligible.add(fromKey);
  }

  const categories = [
    ['votedFor', 'Favorevole'],
    ['votedAgainst', 'Contrario'],
    ['votedAbstained', 'Astenuto']
  ];
  if (!categories.some(([field]) => Array.isArray(voteResult[field])))
    throw new Error('EP_CURRENT_NO_NOMINAL_LIST');
  const selected = new Map();
  for (const [field, status] of categories) {
    const list = voteResult[field];
    if (list === undefined || list === null) continue;
    if (!Array.isArray(list)) throw new Error('EP_CURRENT_BAD_NOMINAL_LIST');
    for (const rawId of list) {
      const mepId = stableMepId(rawId);
      if (!mepId) throw new Error('EP_CURRENT_INVALID_PERSON_ID');
      if (selected.has(mepId)) throw new Error('EP_CURRENT_CONFLICTING_PERSON_VOTE');
      if (eligible.has(mepId)) selected.set(mepId, status);
    }
  }
  // People missing from all three lists are not asserted to be absent.
  return [...selected].map(([mepId, status]) => ({
    institution: 'PE', representativeKey: 'pe:' + mepId,
    sourcePersonId: mepId, ballotId: String(meta.ballotId),
    voteDate: meta.voteDate, ballotOrder: meta.ballotOrder,
    status, ballotTitle: meta.ballotTitle,
    ballotOutcome: meta.ballotOutcome || null,
    sourceUrl: meta.sourceUrl, sourceType: 'pe_ufficiale', verified: true
  }));
}

async function persistExplicitItalianEuropeanVotes(pool, voteResult, italianMepMap, meta) {
  const votes = extractExplicitItalianVotes(voteResult, italianMepMap, meta);
  if (!votes.length) return { considered: 0, changed: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let changed = 0;
    for (const vote of votes) {
      const result = await upsertVerifiedCurrentVote(client, vote);
      if (result.changed) changed++;
    }
    await client.query('COMMIT');
    return { considered: votes.length, changed };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { stableMepId, extractExplicitItalianVotes,
  persistExplicitItalianEuropeanVotes };
