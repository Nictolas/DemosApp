'use strict';

/**
 * Read-side projection only. Migration, MEP->DEMOS crosswalk and current vote
 * writer are owned by PR #633 ("Ultimo voto per rappresentante").
 * No historical records, new table or write queries are created here.
 */
const { fetchOfficialDecisionBallots, decisionUrl } =
  require('./europeanParliamentOfficialDecisionReader');
const { officialMepEvidenceMatches } =
  require('./europeanParliamentCurrentOnlyCandidateBridge');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // A vote is not attributable merely because a writable row bears a
  // DEMOS UUID. Require a separately vetted, unique EU identity link.
  // The link must connect that exact UUID and that exact official MepId,
  // never name/surname or a permissive match. No historical joins.
  let rows;
  try {
    ({rows}=await db.query(
      'SELECT c.source_person_id, c.ballot_id, c.vote_date::text AS vote_date, ' +
      'c.ballot_order, c.vote, c.source_url, c.source_type, ' +
      'x.evidence_url AS identity_evidence_url ' +
      'FROM public.institutional_current_nominal_votes AS c ' +
      'INNER JOIN public.institutional_nominal_identity_links AS x ' +
      "ON x.institution = 'PE' AND x.representative_id = $1::uuid " +
      "AND x.review_state = 'VERIFIED' " +
      'AND x.reviewed_by IS NOT NULL AND x.reviewed_at IS NOT NULL ' +
      'AND x.source_person_id = c.source_person_id ' +
      "WHERE c.institution = 'PE' AND c.representative_key = $2 " +
      "AND (x.evidence_url LIKE 'https://data.europarl.europa.eu/%' " +
      "OR x.evidence_url LIKE 'https://www.europarl.europa.eu/%') " +
      'LIMIT 1',
      [representativeUuid.toLowerCase(),'demos:'+representativeUuid.toLowerCase()]
    ));
  } catch {
    // Absent migration, database error or permission denied: no guessed vote.
    return null;
  }
  if (!Array.isArray(rows)||rows.length!==1) return null;
  if (!officialMepEvidenceMatches(
    rows[0].identity_evidence_url,rows[0].source_person_id
  )) return null;
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
