'use strict';

/**
 * Official European Parliament Open Data API v2, roll-call DECISIONS.
 * Read-only. This supersedes document-XML fetching where the official
 * doCEO endpoint blocks automated clients. No historical database writer.
 */
const axios = require('axios');
const { canonicalMepId } = require('./europeanParliamentVerifiedRollCallReader');
const API_HOST = 'https://data.europarl.europa.eu';
const TTL = 6 * 60 * 60 * 1000;
const cache = new Map();
const pending = new Map();

function decisionUrl(sittingDate) {
  if (!/^20\d\d-(0[1-9]|1[012])-([012]\d|3[01])$/.test(String(sittingDate))) throw new Error('EP_INVALID_DATE');
  const valid = new Date(sittingDate + 'T00:00:00Z');
  if (Number.isNaN(valid.getTime()) || valid.toISOString().slice(0,10) !== sittingDate ||
      sittingDate < '2024-07-16' || valid > new Date()) throw new Error('EP_INVALID_DATE');
  return API_HOST + '/api/v2/meetings/MTG-PL-' + sittingDate + '/decisions';
}

function labelText(label) {
  if (typeof label === 'string') return label.trim();
  if (!label || typeof label !== 'object') return '';
  if (typeof label.it === 'string') return label.it.trim();
  if (typeof label.en === 'string') return label.en.trim();
  if (typeof label['@value'] === 'string') return label['@value'].trim();
  return '';
}

function exactMepId(value) {
  if (typeof value !== 'string' || !/^(?:person\/)?[1-9]\d*$/.test(value)) return null;
  return canonicalMepId(value);
}

function parseOfficialDecisionBallots(payload, sittingDate) {
  const url = decisionUrl(sittingDate);
  const data = payload?.data;
  if (!Array.isArray(data) || data.length === 0 || data.length > 1200) {
    throw new Error('EP_OFFICIAL_DECISIONS_MISSING_OR_TRUNCATED');
  }
  const records = [];
  const ids = new Set();
  for (const d of data) {
    if (d.decision_method !== 'def/ep-decision-methods/VOTE_ELECTRONIC_ROLLCALL') continue;
    if (d.had_activity_type !== 'def/ep-activities/PLENARY_OUTCOME') continue;
    if (!/^MTG-PL-20\d{2}-\d{2}-\d{2}-DEC-\d+$/.test(d.activity_id || '') ||
        !d.activity_id.startsWith('MTG-PL-' + sittingDate + '-DEC-')) continue;
    const outcome = d.decision_outcome === 'def/ep-statuses/ADOPTED' ? 'Approvato' :
                    d.decision_outcome === 'def/ep-statuses/REJECTED' ? 'Respinto' : null;
    if (!outcome) continue;
    if (ids.has(d.activity_id)) throw new Error('EP_DUPLICATED_OFFICIAL_DECISION_ID');
    ids.add(d.activity_id);
    const title = labelText(d.activity_label);
    // Heading can contain political groups; never expose or retain it as subject.
    const subject = title;
    if (!subject) continue;

    // "PLENARY_OUTCOME" and adopted/rejected alone do not establish
    // finality: an amendment can also be adopted/rejected.
    const finalityText = [title, labelText(d.referenceText)]
      .filter(Boolean).join(' ');
    // Official decisions mark final resolutions with "(as a whole)" or
    // "(insieme del testo)"; adopted/rejected amendments must not qualify.
    const final = /\bfinal vote\b|\bvotazione finale\b|\(\s*as a whole\s*\)|\(\s*insieme del testo\s*\)/i.test(finalityText);

    const ballots = new Map();
    let ambiguous = false;
    for (const [field, value] of [
      ['had_voter_favor', 'Favorevole'],
      ['had_voter_against', 'Contrario'],
      ['had_voter_abstention', 'Astenuto']
    ]) {
      const members = d[field];
      if (members == null) continue;
      if (!Array.isArray(members)) { ambiguous = true; break; }
      for (const person of members) {
        const id = exactMepId(person);
        if (!id || ballots.has(id)) { ambiguous = true; break; }
        ballots.set(id, value);
      }
      if (ambiguous) break;
    }
    if (ambiguous || ballots.size === 0) continue;
    // EP API represents official order as strings such as "22.0".
    const orderText = String(d.activity_order ?? '');
    const parsedOrder = /^\d+(?:\.0+)?$/.test(orderText) ? Number(orderText) : NaN;
    const officialOrder = Number.isSafeInteger(parsedOrder) && parsedOrder >= 0
      ? parsedOrder : null;

    records.push({
      voteId: d.activity_id, date: sittingDate, subject, outcome,
      sourceUrl: url, ballots, final, officialOrder, verified: true
    });
  }
  return records;
}

function selectLatestFinalRollCall(recordsBySitting, italianMepIds) {
  const italian = new Set((italianMepIds || []).map(exactMepId).filter(Boolean));
  const records = (recordsBySitting || []).flat().filter(v => v.final && v.verified);
  const recent = new Map();
  const unresolved = new Set();
  // Candidate updates are only comparable with official chronology. If same-day
  // order is absent for multiple candidates, no vote is published for that MEP.
  records.sort((a,b) => b.date.localeCompare(a.date) ||
    (b.officialOrder ?? -1) - (a.officialOrder ?? -1));
  for (const record of records) {
    for (const [mepId,vote] of record.ballots) {
      if (!italian.has(mepId) || unresolved.has(mepId)) continue;
      const prior = recent.get(mepId);
      if (prior?.date === record.date &&
          (prior.officialOrder === null || record.officialOrder === null ||
           prior.officialOrder === record.officialOrder)) {
        recent.delete(mepId);
        unresolved.add(mepId);
        continue;
      }
      if (prior) continue;
      recent.set(mepId,{
        verified:true, mepId, voteId:record.voteId,subject:record.subject,
        date:record.date,vote,outcome:record.outcome,sourceUrl:record.sourceUrl,
        officialOrder:record.officialOrder
      });
    }
  }
  return recent;
}

async function fetchOfficialDecisionBallots(sittingDate, client=axios) {
  const url = decisionUrl(sittingDate);
  const stored = cache.get(sittingDate);
  if (stored && stored.expires > Date.now()) return stored.records;
  if (pending.has(sittingDate)) return pending.get(sittingDate);
  const job = (async () => {
    const res = await client.get(url,{
      timeout:15000,responseType:'json',maxContentLength:6*1024*1024,
      maxBodyLength:6*1024*1024,maxRedirects:0,proxy:false,
      headers:{Accept:'application/ld+json'}
    });
    if (res.status !== 200) throw new Error('EP_OFFICIAL_API_UNAVAILABLE');
    const records = parseOfficialDecisionBallots(res.data,sittingDate);
    if (!records.length) throw new Error('EP_OFFICIAL_API_NO_VALID_ROLLCALLS');
    if (cache.size >= 3) cache.delete(cache.keys().next().value);
    cache.set(sittingDate,{records,expires:Date.now()+TTL});
    return records;
  })();
  pending.set(sittingDate,job);
  try { return await job; } finally { pending.delete(sittingDate); }
}

module.exports = {
  decisionUrl,labelText,parseOfficialDecisionBallots,
  selectLatestFinalRollCall,fetchOfficialDecisionBallots
};
