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
  if (client===axios && rosterCache.ids && rosterCache.expires>Date.now()) return new Set(rosterCache.ids);
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
      if(client===axios){rosterCache.ids=ids;rosterCache.expires=Date.now()+TTL;}
      return new Set(ids);
    }
  }
  throw new Error('EP_DISCOVERY_ROSTER_TRUNCATED');
}

async function fetchPastPlenarySittingDates(now=new Date(),client=axios) {
  const cutoff=dateOnly(now),year=cutoff.slice(0,4);
  // Never share injected test/client responses with the production Axios cache.
  const cacheable=client===axios;
  let promise=cacheable?inflight.get(year):null;
  if (!promise) {
    const cached=cacheable?sessionCache.get(year):null;
    if (cached?.expires>Date.now()) return parsePastPlenarySittings(cached.payload,now);
    promise=(async()=>{
      const url=BASE+'/meetings?year='+year+'&limit=250&offset=0';
      const res=await client.get(url,requestConfig());
      if (res.status!==200) throw new Error('EP_DISCOVERY_MEETINGS_UNAVAILABLE');
      parsePastPlenarySittings(res.data,now);
      if(cacheable)sessionCache.set(year,{payload:res.data,expires:Date.now()+TTL});
      return res.data;
    })();
    if(cacheable)inflight.set(year,promise);
  }
  try {return parsePastPlenarySittings(await promise,now);}
  finally{if(cacheable)inflight.delete(year);}
}

/**
 * A fresh year can have no elapsed sittings yet, or too few for current
 * Italian MEPs whose last verified roll-call was in December. Consult the
 * preceding year only if the current year's sittings are insufficient.
 * Never substitute the older year after a transport or malformed-data error.
 */
async function fetchRecentPlenarySittings(now=new Date(),client=axios,minimum=20){
  if(!Number.isSafeInteger(minimum)||minimum<1||minimum>20)
    throw Error('EP_DISCOVERY_WINDOW_INVALID');
  const cutoff=dateOnly(now);
  const year=Number(cutoff.slice(0,4));
  let dates=[];
  try {
    dates=await fetchPastPlenarySittingDates(now,client);
  } catch(error){
    if(error?.message!=='EP_DISCOVERY_NO_PAST_SITTINGS') throw error;
  }
  if(dates.length>=minimum)return dates;
  // The last 2024-2029 legislature was elected in July 2024. Do not scan
  // beyond the term boundary or treat votes in a previous term as current.
  const prior=year-1;
  if(prior<2024)return dates;
  const previousEnd=new Date(Date.UTC(prior,11,31,23,59,59));
  let previous=[];
  try {
    previous=await fetchPastPlenarySittingDates(previousEnd,client);
  } catch(error){
    if(error?.message!=='EP_DISCOVERY_NO_PAST_SITTINGS') throw error;
  }
  const combined=[...new Set([...dates,...previous])].sort().reverse();
  if(!combined.length)throw Error('EP_DISCOVERY_NO_PAST_SITTINGS');
  return combined;
}

/**
 * PR #633 decision: nominal refresh is limited to selected representatives
 * with independently approved MepId↔DEMOS links. A selection must provide
 * the exact institutional numeric MepId; never a name or political group.
 * The no-argument form remains a full official-source 76-MEP QA audit.
 */
function validateSelectedMepIds(input) {
  if(input===undefined)return null;
  if(!Array.isArray(input)&&!(input instanceof Set))
    throw Error('EP_SELECTED_ID_LIST_REQUIRED');
  if(input.size>100||input.length>100)
    throw Error('EP_SELECTED_ID_LIST_TOO_LARGE');
  const ids=new Set();
  for(const raw of input){
    if(typeof raw!=='string'||!/^[1-9]\\d{0,8}$/.test(raw))
      throw Error('EP_SELECTED_MEP_ID_INVALID');
    if(ids.has(raw))throw Error('EP_SELECTED_MEP_ID_DUPLICATE');
    ids.add(raw);
  }
  return ids;
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
  const selected=validateSelectedMepIds(options.targetMepIds);
  if(selected!==null && selected.size===0) {
    // Nobody follows an already-verified MEP. The shared writer should not
    // run; also avoid even the public roster/meeting API calls.
    return {selectedOnly:true,latestSitting:null,checkedSittings:[],
      covered:0,totalItalianMepIds:0,incomplete:false,current:new Map()};
  }
  const [sittings,officialItalianIds]=await Promise.all([
    fetchRecentPlenarySittings(now,client,maxSittings),
    fetchCurrentItalianMepIds(client)
  ]);
  if(selected && [...selected].some(id=>!officialItalianIds.has(id)))
    throw Error('EP_SELECTED_MEP_NOT_IN_OFFICIAL_CURRENT_ITALIAN_ROSTER');
  const ids=selected||officialItalianIds;
  const current=new Map(), scanned=[];
  const reader=options.fetchDecisions||fetchOfficialDecisionBallots;
  for (const date of sittings.slice(0,maxSittings)) {
    const records=await reader(date,client); // fail closed if no verified official data
    scanned.push(date);
    const missing=[...ids].filter(id=>!current.has(id));
    // If an official whole-text roll-call names a missing Italian MEP but
    // its order is unknown or conflicts with another vote in this sitting,
    // an older ballot must NEVER be presented as that person's "latest".
    const finalRecords=records.filter(r=>r?.verified===true&&r?.final===true);
    const expectedSource='https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+date+'/decisions';
    for (const r of finalRecords) {
      if(r.date!==date || r.sourceUrl!==expectedSource || !(r.ballots instanceof Map))
        throw Error('EP_OFFICIAL_CHRONOLOGY_UNVERIFIABLE');
      if((!Number.isSafeInteger(r.officialOrder)||r.officialOrder<0) &&
         missing.some(id=>r.ballots.has(id)))
        throw Error('EP_OFFICIAL_CHRONOLOGY_UNVERIFIABLE');
    }
    const found=selectLatestFinalRollCall([records],missing.map(id=>'person/'+id));
    if(missing.some(id=>!found.has(id)&&finalRecords.some(r=>r.ballots.has(id))))
      throw Error('EP_OFFICIAL_CHRONOLOGY_UNVERIFIABLE');
    for (const [id,vote] of found) {
      if (!current.has(id)) current.set(id,vote);
    }
    if (current.size===ids.size) break;
  }
  return {
    selectedOnly:selected!==null,
    latestSitting:sittings[0],
    checkedSittings:scanned,
    covered:current.size,totalItalianMepIds:ids.size,
    incomplete:current.size!==ids.size,
    current
  };
}

module.exports={
  exactPersonId,parsePastPlenarySittings,parseItalianCurrentMepIds,
  validateSelectedMepIds,
  fetchCurrentItalianMepIds,fetchPastPlenarySittingDates,fetchRecentPlenarySittings,
  collectRecentVerifiedItalianVotes
};
