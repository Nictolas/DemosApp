'use strict';
const {
  fetchOfficialDecisionBallots
} = require('../services/europeanParliamentOfficialDecisionReader');

(async()=>{
  for (const date of ['2026-07-09','2026-10-22']) {
    const decisions=await fetchOfficialDecisionBallots(date);
    const verifiedIds=new Set(decisions.flatMap(d=>[...d.ballots.keys()]));
    const finals=decisions.filter(d=>d.final);
    console.log('EP_OFFICIAL_DECISIONS_LIVE',JSON.stringify({
      date,nominalRollCalls:decisions.length,uniqueMEPids:verifiedIds.size,
      finalDecisions:finals.length,finalDecisionsWithOrder:finals.filter(d=>d.officialOrder!==null).length,
      source:'European Parliament Open Data API v2',historicalDBWrites:0
    }));
    if (decisions.length<10 || verifiedIds.size<100) {
      throw new Error('EP_OFFICIAL_DECISIONS_MISSING_VOTER_EVIDENCE');
    }
    if (finals.length===0) {
      throw new Error('EP_OFFICIAL_DECISIONS_NO_EXPLICIT_FINALITY_EVIDENCE');
    }
  }
})().catch(error=>{console.error('EP_OFFICIAL_DECISIONS_GATE_FAILED',error.message);process.exitCode=1;});
