'use strict';

/**
 * Read-only bridge between an already verified latest PE roll-call per MepId
 * and an independently vetted DEMOS UUID <-> MepId identity registry.
 *
 * It prepares ONLY current single-row candidates for PR #633's shared writer.
 * It does not read users by name, query the database, upsert, create tables,
 * retain ballot history or publish anything.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEP=/^[1-9]\d{0,8}$/;

function officialMepEvidenceMatches(evidenceUrl, rawMepId) {
  const mepId=String(rawMepId||'');
  if(!MEP.test(mepId)||typeof evidenceUrl!=='string')return false;
  let url;
  try {url=new URL(evidenceUrl);} catch {return false;}
  if(url.protocol!=='https:' || url.username || url.password ||
     url.search || url.hash || url.port) return false;
  // Canonical European Parliament Open Data person identifier.
  if(url.hostname==='data.europarl.europa.eu')
    return url.pathname==='/person/'+mepId ||
      url.pathname==='/person/'+mepId+'/';
  // European Parliament official MEP profile path embeds the exact ID.
  if(url.hostname==='www.europarl.europa.eu'){
    const match=url.pathname.match(/^\/meps\/[a-z]{2}\/([1-9]\d{0,8})(?:\/|$)/);
    return !!match && match[1]===mepId;
  }
  return false;
}

function candidateFromVerifiedBallot(mepId,uuid,ballot) {
  if(!ballot||ballot.verified!==true||ballot.mepId!==mepId ||
      !/^20\d{2}-\d{2}-\d{2}$/.test(String(ballot.date||'')) ||
      !Number.isSafeInteger(ballot.officialOrder) || ballot.officialOrder<0 ||
      !/^MTG-PL-20\d{2}-\d{2}-\d{2}-DEC-\d+$/.test(String(ballot.voteId||'')) ||
      !ballot.voteId.startsWith('MTG-PL-'+ballot.date+'-DEC-') ||
      !['Favorevole','Contrario','Astenuto'].includes(ballot.vote) ||
      !['Approvato','Respinto'].includes(ballot.outcome) ||
      typeof ballot.subject!=='string' || !ballot.subject.trim() ||
      ballot.subject.length>2000 ||
      ballot.sourceUrl!=='https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+ballot.date+'/decisions')
    throw Error('EP_CURRENT_VERIFIED_BALLOT_REQUIRED');
  return Object.freeze({
    institution:'PE',representativeKey:'demos:'+uuid.toLowerCase(),
    sourcePersonId:mepId,ballotId:ballot.voteId,voteDate:ballot.date,
    ballotOrder:ballot.officialOrder,status:ballot.vote,
    ballotTitle:ballot.subject,ballotOutcome:ballot.outcome,
    sourceUrl:ballot.sourceUrl,sourceType:'pe_ufficiale',
    verified:true
  });
}

function prepareVettedEuropeanCurrentVoteCandidates(coverage,links) {
  if(!coverage||coverage.incomplete!==false ||
     !(coverage.current instanceof Map) ||
     !Number.isSafeInteger(coverage.totalItalianMepIds) ||
     coverage.totalItalianMepIds<50 || coverage.totalItalianMepIds>100 ||
     coverage.current.size!==coverage.totalItalianMepIds ||
     coverage.covered!==coverage.current.size ||
     !Array.isArray(coverage.checkedSittings) ||
     !coverage.checkedSittings.length)
    throw Error('EP_CURRENT_FULL_SOURCE_COVERAGE_REQUIRED');
  if(!Array.isArray(links)||links.length>100)
    throw Error('EP_CURRENT_VETTED_LINKS_INVALID');
  const seenPeople=new Set(),seenUuids=new Set(),candidates=[];
  for(const l of links){
    const mep=String(l?.source_person_id||'');
    const uuid=String(l?.representative_id||'').toLowerCase();
    if(l?.institution!=='PE'||!MEP.test(mep)||!UUID.test(uuid) ||
       !officialMepEvidenceMatches(l.evidence_url,mep) ||
       // PROD-041 PR #633: a newly linked person is PENDING, not vetted.
       // Only an authorized, independently reviewed identity is eligible.
       l.review_state!=='VERIFIED' ||
       !UUID.test(String(l.reviewed_by||'')) ||
       !l.reviewed_at || Number.isNaN(Date.parse(l.reviewed_at)) ||
       !l.verified_at || Number.isNaN(Date.parse(l.verified_at)))
      throw Error('EP_CURRENT_UNVETTED_IDENTITY_LINK');
    if(seenPeople.has(mep)||seenUuids.has(uuid))
      throw Error('EP_CURRENT_DUPLICATE_IDENTITY_LINK');
    seenPeople.add(mep);seenUuids.add(uuid);
    const ballot=coverage.current.get(mep);
    if(!ballot)throw Error('EP_CURRENT_ID_NOT_IN_LIVE_ROSTER');
    candidates.push(candidateFromVerifiedBallot(mep,uuid,ballot));
  }
  // These are preview candidates, not a command to write them.
  return Object.freeze({
    vettedLinks:links.length,prepared:candidates.length,
    withoutCertifiedIdentity:coverage.current.size-candidates.length,
    writesPerformed:0,candidates:Object.freeze(candidates)
  });
}

module.exports={
  officialMepEvidenceMatches,candidateFromVerifiedBallot,
  prepareVettedEuropeanCurrentVoteCandidates
};
