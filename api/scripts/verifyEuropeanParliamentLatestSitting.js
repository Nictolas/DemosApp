'use strict';

/**
 * Manual release gate: official MEP roster + plenary discovery + most recent
 * explicitly verified whole-text roll-call for EVERY current Italian MEP.
 * No names, parties, person IDs or ballots are printed; no database writes.
 * Fails closed on incomplete coverage or an unavailable institutional source.
 */
const {collectRecentVerifiedItalianVotes}=
  require('../services/europeanParliamentOfficialDiscovery');

(async()=>{
  const result=await collectRecentVerifiedItalianVotes({maxSittings:20});
  const {latestSitting,checkedSittings,covered,totalItalianMepIds,incomplete,current}=result;
  if(incomplete || covered!==totalItalianMepIds || covered<50 ||
      !checkedSittings.length || checkedSittings[0]!==latestSitting)
    throw new Error('EP_LAST_VERIFIED_VOTE_COVERAGE_INCOMPLETE');
  const valid=[...current].every(([id,record])=>
    id===record.mepId && record.verified===true &&
    /^(?:Favorevole|Contrario|Astenuto)$/.test(record.vote) &&
    /^(?:Approvato|Respinto)$/.test(record.outcome) &&
    /^MTG-PL-20\d{2}-\d{2}-\d{2}-DEC-\d+$/.test(record.voteId) &&
    Number.isSafeInteger(record.officialOrder) && record.officialOrder>=0 &&
    record.sourceUrl===
      'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+record.date+'/decisions'
  );
  if(!valid)throw new Error('EP_LAST_VERIFIED_VOTE_RECORD_SHAPE_INVALID');
  console.log('EP_LAST_VERIFIED_COVERAGE_REAL_PASS',JSON.stringify({
    latestSitting,checkedSittings:checkedSittings.length,
    currentItalianMepIds:totalItalianMepIds,
    independentlyVerifiedIndividualLastVotes:covered,
    unknown:totalItalianMepIds-covered,
    zeroPastBallotRowsStored:true,
    persistenceWrites:0,personIdentifiersLogged:0,
    source:'European Parliament Open Data API v2'
  }));
})().catch(e=>{
  console.error('EP_LAST_VERIFIED_COVERAGE_REAL_FAIL',String(e?.message||e).slice(0,130));
  process.exitCode=1;
});
