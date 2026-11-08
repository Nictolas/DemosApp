'use strict';

/** Gate against today's real official PE API; no DB, personal names or group labels. */
const {fetchCurrentItalianMepIds,fetchPastPlenarySittingDates}=
 require('../services/europeanParliamentOfficialDiscovery');
const {fetchOfficialDecisionBallots,selectLatestFinalRollCall}=
 require('../services/europeanParliamentOfficialDecisionReader');

(async()=>{
 const dates=await fetchPastPlenarySittingDates();
 const italian=await fetchCurrentItalianMepIds();
 const latest=dates[0];
 const votes=await fetchOfficialDecisionBallots(latest);
 const finals=votes.filter(v=>v.final&&v.verified);
 if(!finals.length)throw new Error('EP_LATEST_SITTING_NO_VERIFIED_FINAL_ROLLCALL');
 const current=selectLatestFinalRollCall([votes],[...italian].map(id=>'person/'+id));
 if(current.size<20)throw new Error('EP_LATEST_SITTING_NOT_ENOUGH_ITALIAN_BALLOTS');
 if(dates.length<5)throw new Error('EP_LATEST_DISCOVERY_TOO_FEW_SITTINGS');
 console.log('EP_LATEST_OFFICIAL_REAL_PASS',JSON.stringify({
   mostRecentPastSitting:latest,pastSittingsDiscovered:dates.length,
   currentItalianMepIds:italian.size,
   officialRollCalls:votes.length,verifiedWholeTextFinalVotes:finals.length,
   currentExplicitItalianVotes:current.size,missingOrNoExplicitVote:italian.size-current.size,
   persistenceWrites:0,partiesOrGroupsInOutput:false,source:'European Parliament Open Data API v2'
 }));
})().catch(e=>{console.error('EP_LATEST_OFFICIAL_REAL_FAIL',String(e.message||e).slice(0,120));process.exitCode=1;});
