'use strict';

/**
 * Read-side projection only. Migration, MEP->DEMOS crosswalk and current vote
 * writer are owned by PR #633 ("Ultimo voto per rappresentante").
 * No historical records, new table or write queries are created here.
 */
const { fetchOfficialDecisionBallots, decisionUrl } =
  require('./europeanParliamentOfficialDecisionReader');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function projectVerifiedEuropeanCurrentVote(row, officialRecords) {
  if (!row || !Array.isArray(officialRecords)) return null;
  const date=String(row.vote_date||'');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  let source;
  try { source=decisionUrl(date); } catch { return null; }
  // Require the canonical official endpoint, not an arbitrary external URL.
  if (row.source_url !== source || row.source_type!=='pe_ufficiale' ||
      !/^[1-9]\d{0,8}$/.test(String(row.source_person_id||''))) return null;
  const match=officialRecords.filter(x=>x.voteId===row.ballot_id && x.final===true &&
      x.verified===true && x.date===date);
  if (match.length!==1 || !Number.isSafeInteger(match[0].officialOrder) ||
      match[0].officialOrder!==Number(row.ballot_order) ||
      match[0].ballots.get(row.source_person_id)!==row.vote ||
      !['Favorevole','Contrario','Astenuto'].includes(row.vote) ||
      !['Approvato','Respinto'].includes(match[0].outcome) ||
      !match[0].subject || match[0].sourceUrl!==source) return null;
  return {
    verified:true,mepId:row.source_person_id,voteId:match[0].voteId,
    subject:match[0].subject,date,vote:row.vote,
    outcome:match[0].outcome,sourceUrl:source
  };
}

async function readVerifiedEuropeanCurrentVote(db, representativeUuid, options={}) {
  if (!UUID.test(String(representativeUuid||''))) return null;
  // One indexed SELECT for the selected representative. Never match by name.
  let rows;
  try {
    ({rows}=await db.query(
      'SELECT source_person_id, ballot_id, vote_date::text AS vote_date, ' +
      'ballot_order, vote, source_url, source_type ' +
      'FROM public.institutional_current_nominal_votes ' +
      "WHERE institution = 'PE' AND representative_key = $1 LIMIT 1",
      ['demos:'+representativeUuid.toLowerCase()]
    ));
  } catch {
    // Absent migration, database error or permission denied: no guessed vote.
    return null;
  }
  if (!Array.isArray(rows)||rows.length!==1) return null;
  const fetchDecisions=options.fetchDecisions||fetchOfficialDecisionBallots;
  const date=String(rows[0].vote_date||'');
  try {
    // Official source is cached per sitting (6h), so many readers share two
    // network calls. Recheck exact position and finality before exposing data.
    const records=await fetchDecisions(date);
    return projectVerifiedEuropeanCurrentVote(rows[0],records);
  } catch { return null; }
}

module.exports={projectVerifiedEuropeanCurrentVote,readVerifiedEuropeanCurrentVote};
