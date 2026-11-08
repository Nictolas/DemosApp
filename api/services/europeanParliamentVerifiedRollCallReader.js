'use strict';

/**
 * European Parliament RCV reader. Pure/read-only; the single-current-vote writer
 * and database schema belong to the separate "Ultimo voto per rappresentante" PR.
 *
 * Never infer an absence from omission in an RCV file; only listed roll calls
 * provide individual voting evidence. The VOT outcome/finality must be verified
 * independently before a record becomes eligible for publication.
 */
const axios = require('axios');
const cheerio = require('cheerio');

const OFFICIAL_HOST = 'https://www.europarl.europa.eu';
const MAX_BYTES = 6 * 1024 * 1024;
const CACHE_MS = 6 * 60 * 60 * 1000;
const sessions = new Map();
const inflight = new Map();

function canonicalMepId(value) {
  const text = String(value == null ? '' : value).trim();
  if (!/^(?:\d+|(?:person\/)?\d+)$/.test(text)) return null;
  const digits = text.split('/').pop();
  return /^(?:0|[1-9]\d*)$/.test(digits) ? digits : null;
}

function officialRcvUrl(sittingDate) {
  if (!/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(sittingDate)) {
    throw new TypeError('INVALID_EP_SITTING_DATE');
  }
  const date = new Date(sittingDate + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== sittingDate ||
      sittingDate < '2024-07-16' || date.getTime() > Date.now()) {
    throw new TypeError('INVALID_EP_SITTING_DATE');
  }
  return `${OFFICIAL_HOST}/doceo/document/PV-10-${sittingDate}-RCV_EN.xml`;
}

function nameIs(el, name) {
  return Boolean(el && el.name === name);
}
function descendants($, node, tagName) {
  return $(node).find('*').filter((_, el) => nameIs(el, tagName));
}
function positionMembers($, rollcall, resultTag) {
  const container = descendants($, rollcall, resultTag).first();
  if (!container.length) return [];
  return descendants($, container, 'PoliticalGroup.Member.Name').toArray();
}

/**
 * Parse a complete sitting RCV file. No parties/groups/names are retained.
 * Duplicate MEP ballots in one roll-call make that entire roll-call unsafe.
 * Result totals are not an official adopted/rejected determination.
 */
function parseOfficialRollCallXml(xml, sittingDate, sourceUrl = officialRcvUrl(sittingDate)) {
  if (typeof xml !== 'string' || xml.length < 50 || Buffer.byteLength(xml, 'utf8') > MAX_BYTES) {
    throw new Error('EP_RCV_INVALID_DOCUMENT');
  }
  if (!sourceUrl.startsWith(OFFICIAL_HOST + '/doceo/document/PV-10-' + sittingDate + '-RCV_')) {
    throw new Error('EP_RCV_UNTRUSTED_SOURCE');
  }
  const $ = cheerio.load(xml, { xmlMode: true, decodeEntities: true });
  const roots = $('*').filter((_, el) => nameIs(el, 'PV.RollCallVoteResults'));
  if (roots.length !== 1) throw new Error('EP_RCV_WRONG_DOCUMENT');
  const items = descendants($, roots[0], 'RollCallVote.Result').toArray();
  if (items.length === 0) throw new Error('EP_RCV_EMPTY');
  const result = [];
  const seenVoteIds = new Set();
  for (const item of items) {
    const identifier = $(item).attr('Identifier') || $(item).attr('identifier');
    if (!identifier || seenVoteIds.has(identifier)) throw new Error('EP_RCV_DUPLICATE_OR_MISSING_VOTE_ID');
    seenVoteIds.add(identifier);
    const subject = descendants($, item, 'RollCallVote.Description.Text').first().text().replace(/\s+/g, ' ').trim();
    if (!subject) continue; // never fabricate a subject
    const ballots = new Map();
    let ambiguous = false;
    for (const [tag, vote] of [
      ['Result.For', 'Favorevole'],
      ['Result.Against', 'Contrario'],
      ['Result.Abstention', 'Astenuto']
    ]) {
      for (const member of positionMembers($, item, tag)) {
        const id = canonicalMepId($(member).attr('MepId') || $(member).attr('mepid'));
        if (!id || ballots.has(id)) { ambiguous = true; break; }
        ballots.set(id, vote);
      }
      if (ambiguous) break;
    }
    if (!ambiguous && ballots.size > 0) {
      result.push({ identifier, subject, date: sittingDate, sourceUrl, ballots });
    }
  }
  return result;
}

/**
 * Only accept a final decision when a *separate official VOT/decision record*
 * confirms the exact roll-call identifier, subject and outcome. Descriptions
 * and majority counts alone are not proof of a final adoption or rejection.
 * verifiedDecisions must be populated by the dedicated official-source
 * validator; this module never invents it.
 */
function selectLatestVerifiedByMep(sittings, italianMepIds, verifiedDecisions) {
  const ids = new Set((italianMepIds || []).map(canonicalMepId).filter(Boolean));
  if (!ids.size) return new Map();
  const decisions = verifiedDecisions instanceof Map ? verifiedDecisions : new Map();
  const current = new Map();
  const chron = [];
  for (const sitting of sittings || []) {
    for (const vote of sitting || []) chron.push(vote);
  }
  chron.sort((a, b) => b.date.localeCompare(a.date) ||
    b.identifier.localeCompare(a.identifier, 'en', { numeric: true }));
  for (const vote of chron) {
    const official = decisions.get(`${vote.date}:${vote.identifier}`);
    if (!official || official.final !== true ||
        !['Approvato', 'Respinto'].includes(official.outcome) ||
        official.sourceType !== 'EP_OFFICIAL_VOT' ||
        typeof official.sourceUrl !== 'string' ||
        !official.sourceUrl.startsWith(OFFICIAL_HOST + '/doceo/') ||
        official.subject !== vote.subject) continue;
    for (const [mepId, choice] of vote.ballots) {
      if (!ids.has(mepId) || current.has(mepId)) continue;
      current.set(mepId, {
        mepId, voteId: vote.identifier, subject: vote.subject,
        date: vote.date, vote: choice, outcome: official.outcome,
        sourceUrl: vote.sourceUrl, outcomeSourceUrl: official.sourceUrl,
        verified: true
      });
    }
  }
  return current;
}

async function fetchOfficialSittingRcv(sittingDate, client = axios) {
  const url = officialRcvUrl(sittingDate);
  const cached = sessions.get(sittingDate);
  if (cached && cached.expires > Date.now()) return cached.votes;
  if (inflight.has(sittingDate)) return inflight.get(sittingDate);
  const job = (async () => {
    const res = await client.get(url, {
      timeout: 12000,
      responseType: 'text', maxContentLength: MAX_BYTES, maxBodyLength: MAX_BYTES,
      maxRedirects: 0, proxy: false,
      headers: { Accept: 'application/xml, text/xml', 'User-Agent': 'DEMOS/1.0 (official public roll-calls)' }
    });
    if (res.status !== 200) throw new Error('EP_RCV_HTTP_NOT_OK');
    const votes = parseOfficialRollCallXml(res.data, sittingDate, url);
    if (sessions.size >= 8) sessions.delete(sessions.keys().next().value);
    sessions.set(sittingDate, { votes, expires: Date.now() + CACHE_MS });
    return votes;
  })();
  inflight.set(sittingDate, job);
  try { return await job; } finally { inflight.delete(sittingDate); }
}

module.exports = {
  canonicalMepId,
  officialRcvUrl,
  parseOfficialRollCallXml,
  selectLatestVerifiedByMep,
  fetchOfficialSittingRcv
};
