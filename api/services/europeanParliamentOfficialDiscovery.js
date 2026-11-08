'use strict';

/**
 * Official-source discovery for DEMOS PE. No database, no writer, no group
 * metadata and no name-based identity assignment. A cron/sync job and its
 * single-current-vote persistence belong to PR #633.
 */
const axios=require('axios');
const {fetchOfficialDecisionBallots,selectLatestFinalRollCall}=
  require('./europeanParliamentOfficialDecisionReader');

const BASE='https://data.europarl.europa.eu/api/v2';
const MAX_PAGE=500;
const sessionCache=new Map();
const inflight=new Map();
const rosterCache={expires:0,ids:null};
const TTL=6*60*60*1000;

function dateOnly(now) {
  const v=now instanceof Date?now:new Date(now);
  if (Number.isNaN(v.getTime())) throw new Error('EP_DISCOVERY_INVALID_CLOCK');
  return v.toISOString().slice(0,10);
}
function exactPersonId(value) {
  const text=String(value||'');
  const match=text.match(/^person\/([1-9]\d{0,8})$/);
  return match?match[1]:null;
}
function listRecords(payload) {
  return Array.isArray(payload?.data)?payload.data:null;
}
function requestConfig() {
  return {timeout:15000,responseType:'json',maxContentLength:8*1024*1024,
    maxRedirects:0,proxy:false,headers:{Accept:'application/ld+json'}};
}

/** Filter future announced meetings and accept only exact sitting IDs. */
function parsePastPlenarySittings(payload, now) {
  const rows=listRecords(payload);
  if (!rows || rows.length===0 || rows.length>=250)
    throw new Error('EP_DISCOVERY_INCOMPLETE_MEETINGS');
  const cutoff=dateOnly(now);
  const found=new Set();
  for (const row of rows) {
    const id=row?.activity_id||row?.id;
    if (typeof id!=='string') continue;
    const match=id.match(/^MTG-PL-(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/);
    if (!match) continue;
    const day=match[1];
    if (Number.isNaN(Date.parse(day+'T00:00:00Z')) ||
        new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day ||
        day>cutoff || day<'2024-07-16') continue;
    found.add(day);
  }
  if (!found.size) throw new Error('EP_DISCOVERY_NO_PAST_SITTINGS');
  return [...found].sort().reverse();
}

/** Filter current Italian membership exclusively on institutional country code. */
function parseItalianCurrentMepIds(rows) {
  if (!Array.isArray(rows) || rows.length<300 || rows.length>1500)
    throw new Error('EP_DISCOVERY_ROSTER_INCOMPLETE');
  const all=new Set(), ital=new Set();
  for (const entry of rows) {
    const id=exactPersonId(entry?.id);
    if (!id || all.has(id)) throw new Error('EP_DISCOVERY_ROSTER_AMBIGUOUS_ID');
    all.add(id);
    if (entry['api:country-of-representation']==='IT') ital.add(id);
  }
  if (ital.size<50 || ital.size>100)
    throw new Error('EP_DISCOVERY_ITALIAN_ROSTER_INCOMPLETE');
  return ital;
}

async function fetchCurrentItalianMepIds(client=axios) {
  if (rosterCache.ids && rosterCache.expires>Date.now()) return new Set(rosterCache.ids);
  const rows=[];
  for (let offset=0;offset<1500;offset+=MAX_PAGE) {
    const url=BASE+'/meps/show-current?limit='+MAX_PAGE+'&offset='+offset;
    const res=await client.get(url,requestConfig());
    if (res.status!==200 || !listRecords(res.data))
      throw new Error('EP_DISCOVERY_ROSTER_UNAVAILABLE');
    const page=listRecords(res.data);
    rows.push(...page);
    if (page.length<MAX_PAGE) {
      const ids=parseItalianCurrentMepIds(rows);
      rosterCache.ids=ids;rosterCache.expires=Date.now()+TTL;
      return new Set(ids);
    }
  }
  throw new Error('EP_DISCOVERY_ROSTER_TRUNCATED');
}

async function fetchPastPlenarySittingDates(now=new Date(),client=axios) {
  const cutoff=dateOnly(now),year=cutoff.slice(0,4);
  let promise=inflight.get(year);
  if (!promise) {
    const cached=sessionCache.get(year);
    if (cached?.expires>Date.now()) return parsePastPlenarySittings(cached.payload,now);
    promise=(async()=>{
      const url=BASE+'/meetings?year='+year+'&limit=250&offset=0';
      const res=await client.get(url,requestConfig());
      if (res.status!==200) throw new Error('EP_DISCOVERY_MEETINGS_UNAVAILABLE');
      parsePastPlenarySittings(res.data,now);
      sessionCache.set(year,{payload:res.data,expires:Date.now()+TTL});
      return res.data;
    })();
    inflight.set(year,promise);
  }
  try {return parsePastPlenarySittings(await promise,now);}
  finally{inflight.delete(year);}
}

/**
 * A bounded, non-persistent collection of verified current explicit votes.
 * Missing voters remain unknown. If a source fails, fail the whole batch
 * instead of silently asserting older votes are the newest.
 */
async function collectRecentVerifiedItalianVotes(options={}) {
  const now=options.now||new Date();
  const client=options.client||axios;
  const maxSittings=Math.min(Math.max(options.maxSittings||10,1),20);
  const [sittings,ids]=await Promise.all([
    fetchPastPlenarySittingDates(now,client),
    fetchCurrentItalianMepIds(client)
  ]);
  const current=new Map(), scanned=[];
  const reader=options.fetchDecisions||fetchOfficialDecisionBallots;
  for (const date of sittings.slice(0,maxSittings)) {
    const records=await reader(date,client); // fail closed if no verified official data
    scanned.push(date);
    const missing=[...ids].filter(id=>!current.has(id));
    const found=selectLatestFinalRollCall([records],missing.map(id=>'person/'+id));
    for (const [id,vote] of found) {
      if (!current.has(id)) current.set(id,vote);
    }
    if (current.size===ids.size) break;
  }
  return {
    latestSitting:sittings[0],
    checkedSittings:scanned,
    covered:current.size,totalItalianMepIds:ids.size,
    incomplete:current.size!==ids.size,
    current
  };
}

module.exports={
  exactPersonId,parsePastPlenarySittings,parseItalianCurrentMepIds,
  fetchCurrentItalianMepIds,fetchPastPlenarySittingDates,collectRecentVerifiedItalianVotes
};
