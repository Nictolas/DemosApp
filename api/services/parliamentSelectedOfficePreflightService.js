'use strict';

// PROD-041: bounded, READ-ONLY identity/office preflight for selected MPs.
// Never auto-approves IDs, edits mandates/selections, stores DOB, or attributes votes.
// Openpolis is useful for screening; institutional evidence is needed for approval.
const axios=require('axios');
const cheerio=require('cheerio');
const { memberNameVariants }=require('./parliamentLatestVoteNotificationsService');

const MONTHS=new Map(Object.entries({
  gennaio:'01',febbraio:'02',marzo:'03',aprile:'04',maggio:'05',giugno:'06',
  luglio:'07',agosto:'08',settembre:'09',ottobre:'10',novembre:'11',dicembre:'12'
}));
const MAX_SELECTED=12;
const memo=new Map();
const CACHE_MS=24*60*60*1000;
let scanOffset=0; // Small in-memory cursor: bounded fair coverage of new/old selections.

function norm(value) {
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase().replace(/\s+/g,' ');
}
function slug(value){return norm(value).replace(/ /g,'-');}
function birthIso(input){
  if(input instanceof Date && Number.isFinite(input.getTime()))return input.toISOString().slice(0,10);
  return /^\d{4}-\d\d-\d\d$/.test(String(input||''))?String(input):null;
}
function isTrustedProfile(url){
  try{
    const u=new URL(url);
    return u.protocol==='https:' && u.hostname==='parlamento19.openpolis.it' &&
      !u.username&&!u.password&&!u.search&&!u.hash&&
      /^\/persone\/[a-z0-9-]{4,120}\/?$/.test(u.pathname);
  }catch{return false;}
}
function profileCandidates(rep){
  const name=slug(rep.nome+' '+rep.cognome);
  const dob=birthIso(rep.data_nascita);
  if(!name||!dob)return [];
  const urls=[
    'https://parlamento19.openpolis.it/persone/'+name+'-'+dob,
    'https://parlamento19.openpolis.it/persone/'+name+'-none'
  ];
  return urls.filter(isTrustedProfile);
}
function profileEvidence(html,rep,expectedOffice,url){
  if(!isTrustedProfile(url)||!['it.camera','it.senato'].includes(expectedOffice)||
     typeof html!=='string'||html.length>1500000||html.length<200)
    return {state:'UNAVAILABLE'};
  const $=cheerio.load(html);
  const actualName=norm($('h1').first().text());
  // A documented institutional alias (Peppe/Giuseppe De Cristofaro) is
  // acceptable, but no generic fuzzy name matching or guesswork.
  if(!actualName||!memberNameVariants(rep).has(actualName))return {state:'NAME_MISMATCH'};
  // A public name is not sufficient; require agreement with independently
  // stored public date of birth AND the current parliamentary office label.
  const dob=birthIso(rep.data_nascita);
  if(!dob)return {state:'DOB_MISSING'};
  // Openpolis separates office and "dal" across adjacent HTML nodes.
  // Cheerio .text() concatenates them ("Senatoredal"); add an actual
  // whitespace for each removed HTML tag before parsing the visible header.
  const body=$('body').clone();
  body.find('script,style,noscript').remove();
  const separated=(body.html()||'').replace(/<[^>]+>/g,' ');
  const text=cheerio.load('<div>'+separated+'</div>')('div').text()
    .replace(/\s+/g,' ').trim();
  const i=text.toLowerCase().indexOf($('h1').first().text().trim().toLowerCase());
  if(i<0)return {state:'UNAVAILABLE'};
  const header=text.slice(i,i+2600);
  const birth=header.match(/\bNato il\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/i);
  if(!birth)return {state:'DOB_UNAVAILABLE'};
  const sourceDob=birth[3]+'-'+MONTHS.get(birth[2].toLowerCase())+'-'+birth[1].padStart(2,'0');
  if(sourceDob!==dob)return {state:'DOB_MISMATCH'};
  const officeMatches=[...header.matchAll(/\b(Deputato|Senatore)\s+dal\s+\d{1,2}\/\d{1,2}\/\d{4}\b/gi)];
  if(officeMatches.length!==1)return {state:'OFFICE_UNAVAILABLE'};
  const office=officeMatches[0][1].toLowerCase()==='deputato'?'it.camera':'it.senato';
  return office===expectedOffice
    ? {state:'CANDIDATE_ONLY',office,profileUrl:url}
    : {state:'OFFICE_MISMATCH',office,profileUrl:url};
}
async function getProfile(url,fetchPage){
  const cached=memo.get(url);
  if(cached&&cached.expires>Date.now())return cached.html;
  const html=await fetchPage(url);
  if(typeof html!=='string'||html.length>1500000)throw Error('PROFILE_INVALID_RESPONSE');
  if(memo.size>=64)memo.delete(memo.keys().next().value);
  memo.set(url,{html,expires:Date.now()+CACHE_MS});
  return html;
}
async function fetchPageDefault(url){
  const response=await axios.get(url,{timeout:6000,maxRedirects:0,maxContentLength:1500000,
    headers:{'User-Agent':'DEMOS/1.0 (read-only representative office preflight; https://demos.community)'},
    validateStatus:s=>s===200,responseType:'text'});
  return response.data;
}
const SELECTED_UNREVIEWED_SQL=[
  'SELECT DISTINCT p.id, p.nome, p.cognome, p.data_nascita,',
  'ps.political_office_id AS expected_office',
  'FROM public.political_selections ps',
  'JOIN public.users follower ON follower.id=ps.user_id AND lower(follower.status)=\'a\'',
  'JOIN public.users p ON p.id=ps.selected_user_id',
  'LEFT JOIN public.institutional_nominal_identity_links link',
  'ON link.representative_id=p.id AND link.institution=CASE',
  "WHEN ps.political_office_id='it.camera' THEN 'Camera' ELSE 'Senato' END",
  'WHERE ps.selection_kind=\'representative\'',
  "AND ps.political_office_id IN ('it.camera','it.senato')",
  "AND (link.review_state IS DISTINCT FROM 'VERIFIED' OR link.reviewed_by IS NULL)",
  'AND EXISTS(SELECT 1 FROM public.political_mandates m',
  'WHERE m.user_id=p.id AND m.status=\'ACTIVE\'',
  "AND m.office_code=CASE WHEN ps.political_office_id='it.camera' THEN 'C' ELSE 'S' END",
  'AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now()))',
  'ORDER BY p.id, ps.political_office_id',
  'LIMIT '+MAX_SELECTED+' OFFSET $1'
].join(' ');

async function preflightSelectedParliamentaryOffices(pool,options={}){
  // Feature flag defaults off; never used to mutate production or grant VERIFIED.
  if(process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED!=='true')
    return {enabled:false,checked:0,officeMismatches:0,birthDateMismatches:0,candidates:0,unresolved:0};
  let {rows}=await pool.query(SELECTED_UNREVIEWED_SQL,[scanOffset]);
  if(!rows.length&&scanOffset){
    scanOffset=0;
    ({rows}=await pool.query(SELECTED_UNREVIEWED_SQL,[0]));
  }
  scanOffset=rows.length===MAX_SELECTED?scanOffset+rows.length:0;
  const result={enabled:true,checked:0,officeMismatches:0,birthDateMismatches:0,candidates:0,unresolved:0};
  for(const rep of rows){
    let decision={state:'UNAVAILABLE'};
    const urls=profileCandidates(rep);
    for(const url of urls){
      try{
        const html=await getProfile(url,options.fetchPage||fetchPageDefault);
        const outcome=profileEvidence(html,rep,rep.expected_office,url);
        if(outcome.state==='NAME_MISMATCH'||outcome.state==='UNAVAILABLE')continue;
        decision=outcome;
        break;
      }catch{/* A missing/broken external page is NOT a validated identity. */}
    }
    result.checked++;
    if(decision.state==='OFFICE_MISMATCH')result.officeMismatches++;
    else if(decision.state==='DOB_MISMATCH')result.birthDateMismatches++;
    else if(decision.state==='CANDIDATE_ONLY')result.candidates++;
    else result.unresolved++;
  }
  // No names, individual DOBs or IDs in logs or persisted reports.
  return result;
}
module.exports={norm,profileCandidates,profileEvidence,preflightSelectedParliamentaryOffices,SELECTED_UNREVIEWED_SQL};
