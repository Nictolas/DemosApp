'use strict';

/**
 * Read-only selection boundary for the shared PR #633 writer.
 * Query only verified identities of representatives followed by active
 * users; no names, parties, guessing, DML, notifications or logging.
 */
const {
  officialMepEvidenceMatches,
  prepareVettedEuropeanCurrentVoteCandidates
}=require('./europeanParliamentCurrentOnlyCandidateBridge');
const {
  collectRecentVerifiedItalianVotes
}=require('./europeanParliamentOfficialDiscovery');

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEP=/^[1-9]\d{0,8}$/;
const MAX_SELECTIONS=100;

// The inner EXISTS avoids materializing follower IDs. The reviewed link
// prevents name-only selections from becoming votes. No historical tables.
const SELECT_VERIFIED_SELECTED_MEP_LINKS=[
  'SELECT l.institution,',
  '       l.representative_id::text AS representative_id,',
  '       l.source_person_id, l.evidence_url, l.review_state,',
  '       l.reviewed_by::text AS reviewed_by,',
  '       l.reviewed_at::text AS reviewed_at,',
  '       l.verified_at::text AS verified_at',
  'FROM public.institutional_nominal_identity_links AS l',
  "WHERE l.institution = 'PE'",
  "  AND l.review_state = 'VERIFIED'",
  '  AND l.reviewed_by IS NOT NULL AND l.reviewed_at IS NOT NULL',
  '  AND EXISTS (',
  '    SELECT 1 FROM public.political_mandates AS m',
  '    WHERE m.user_id = l.representative_id',
  "      AND m.office_code = 'E' AND m.status = 'ACTIVE'",
  '  )',
  '  AND EXISTS (',
  '    SELECT 1 FROM public.user_representatives AS r',
  '    INNER JOIN public.users AS follower',
  "      ON follower.id = r.user_id AND follower.status = 'a'",
  "    WHERE lower(trim(to_jsonb(r)->>'rappresentante_europeo')) = l.representative_id::text",
  '  )',
  'ORDER BY l.source_person_id',
  'LIMIT 101'
].join('\n');

function verifySelectedLink(row) {
  const id=row?.source_person_id;
  const uuid=row?.representative_id;
  if(row?.institution!=='PE' ||
     typeof id!=='string' || !MEP.test(id) ||
     typeof uuid!=='string'||!UUID.test(uuid) ||
     row.review_state!=='VERIFIED' ||
     typeof row.reviewed_by!=='string' || !UUID.test(row.reviewed_by) ||
     !row.reviewed_at || !Number.isFinite(Date.parse(row.reviewed_at)) ||
     !row.verified_at || !Number.isFinite(Date.parse(row.verified_at)) ||
     !officialMepEvidenceMatches(row.evidence_url,id))
    throw Error('EP_SELECTED_INSTITUTIONAL_IDENTITY_NOT_VERIFIED');
}

async function fetchVerifiedSelectedEuropeanLinks(db) {
  if(!db || typeof db.query!=='function')
    throw Error('EP_SELECTED_READ_ONLY_DB_REQUIRED');
  const result=await db.query(SELECT_VERIFIED_SELECTED_MEP_LINKS);
  if(!result || !Array.isArray(result.rows) || result.rows.length>MAX_SELECTIONS)
    throw Error('EP_SELECTED_SOURCE_LINK_RESULTS_INVALID');
  const ids=new Set(),uuids=new Set();
  for(const row of result.rows) {
    verifySelectedLink(row);
    const uuid=row.representative_id.toLowerCase();
    if(ids.has(row.source_person_id)||uuids.has(uuid))
      throw Error('EP_SELECTED_DUPLICATE_INSTITUTIONAL_IDENTITY');
    ids.add(row.source_person_id);
    uuids.add(uuid);
  }
  return result.rows;
}

/** Preview only. PR #633 owns all production/staging vote mutations. */
async function prepareSelectedEuropeanCurrentOnlyPreview(db,options={}) {
  const links=await fetchVerifiedSelectedEuropeanLinks(db);
  const coverage=await (options.fetchVotes||collectRecentVerifiedItalianVotes)({
    targetMepIds:links.map(x=>x.source_person_id),
    now:options.now,client:options.client,
    maxSittings:options.maxSittings
  });
  return prepareVettedEuropeanCurrentVoteCandidates(coverage,links);
}

module.exports={
  SELECT_VERIFIED_SELECTED_MEP_LINKS,
  fetchVerifiedSelectedEuropeanLinks,
  prepareSelectedEuropeanCurrentOnlyPreview
};
