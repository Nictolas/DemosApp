'use strict';

/**
 * Diagnostics only: inspect the last 8 elapsed EP plenary meetings and count
 * verified final votes among the official current Italian MEPs.
 * Print no names, IDs, ballots or political groups. Zero DB I/O.
 * Never claim complete chronology when even one newer source is unavailable.
 */
const {fetchCurrentItalianMepIds,fetchPastPlenarySittingDates}=
  require('../services/europeanParliamentOfficialDiscovery');
const {fetchOfficialDecisionBallots,selectLatestFinalRollCall}=
  require('../services/europeanParliamentOfficialDecisionReader');

(async()=>{
  const [dates,ids]=await Promise.all([
    fetchPastPlenarySittingDates(),fetchCurrentItalianMepIds()
  ]);
  const count=Math.min(8,dates.length),recent=new Map(),failed=[];
  const metrics=[];
  for (const date of dates.slice(0,count)) {
    try {
      const records=await fetchOfficialDecisionBallots(date);
      const decisions=records.filter(r=>r.final && r.verified);
      const newVotes=selectLatestFinalRollCall(
        [records],[...ids].filter(id=>!recent.has(id)).map(id=>'person/'+id));
      for(const [id,vote] of newVotes)recent.set(id,vote);
      metrics.push({date,rollCalls:records.length,wholeTextFinal:decisions.length,
        newlyRecovered:newVotes.size,cumulativeKnown:recent.size});
    }catch(e){
      failed.push({date,kind:/timeout/i.test(String(e.message))?'timeout':'source_unavailable'});
      // If any newer sitting is unavailable, the returned candidates are
      // STRICTLY exploratory: do not persist or serve as last verified.
      metrics.push({date,verified:false});
    }
  }
  const result={meetingsExamined:count,officialCurrentItalianIds:ids.size,
    candidateLatestBallots:recent.size,unknown:ids.size-recent.size,
    chronologyReliable:failed.length===0,failures:failed,
    metrics,persistenceWrites:0,personIdentifiersLogged:0};
  console.log('EP_RECENT_COVERAGE_READ_ONLY',JSON.stringify(result));
  if(failed.length) process.exitCode=2;
})().catch(e=>{
  console.error('EP_RECENT_COVERAGE_FAIL',String(e?.message||e).slice(0,125));
  process.exitCode=1;
});
