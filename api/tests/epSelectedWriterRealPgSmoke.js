'use strict';

/**
 * Actual PostgreSQL 16 integration of the PR #635 selection reader
 * and the current PR #633 shared writer, only on a disposable fixture.
 * EP_SCHEMA_FIXTURE_ONLY=true and local DB 'ep_bridge_ci_fixture' required.
 * All vote DML is rolled back. No production, no staging, no accounts.
 */
const assert=require('node:assert/strict');
const path=require('node:path');
const {Client}=require('pg');
const {
  prepareSelectedEuropeanCurrentOnlyPreview
}=require('../services/europeanParliamentSelectedCurrentOnlyReader');

async function main() {
  assert.equal(process.env.EP_SCHEMA_FIXTURE_ONLY,'true',
    'EP_PG_SHARED_WRITER_SYNTHETIC_FIXTURE_ONLY');
  assert.equal(process.env.PGDATABASE,'ep_bridge_ci_fixture',
    'EP_PG_SHARED_WRITER_DB_NAME_REQUIRED');
  assert.ok(['127.0.0.1','localhost'].includes(process.env.PGHOST),
    'EP_PG_SHARED_WRITER_LOCAL_ONLY');
  assert.ok(process.env.EP_CURRENT_WRITER_PATH,'EP_SHARED_WRITER_NOT_FETCHED');
  const writer=require(path.resolve(process.env.EP_CURRENT_WRITER_PATH));
  const db=new Client();
  const target='00000000-0000-4000-8000-000000000103';
  const personId='234567';
  const day='2026-10-22';
  const official='https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+day+'/decisions';
  const candidate=(date,order)=>({
    verified:true,mepId:personId,date,officialOrder:order,
    voteId:'MTG-PL-'+date+'-DEC-'+String(900000+order),
    subject:'Synthetic final whole-text nominal roll call',
    vote:'Favorevole',outcome:'Approvato',
    sourceUrl:'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+date+'/decisions'
  });
  let sourceRequests=0;
  await db.connect();
  try {
    await db.query('BEGIN');
    const preview=await prepareSelectedEuropeanCurrentOnlyPreview(db,{
      fetchVotes:async options=>{
        sourceRequests++;
        assert.deepEqual(options.targetMepIds,[personId]);
        return {
          selectedOnly:true,latestSitting:day,checkedSittings:[day],
          covered:1,totalItalianMepIds:1,incomplete:false,
          current:new Map([[personId,candidate(day,40)]])
        };
      }
    });
    assert.equal(sourceRequests,1);
    assert.equal(preview.prepared,1);
    assert.equal(preview.writesPerformed,0);
    const vote=preview.candidates[0];
    assert.equal(vote.representativeKey,'demos:'+target);
    assert.equal(vote.sourcePersonId,personId);
    assert.equal(vote.sourceUrl,official);
    assert.equal(writer.assertVerifiedVote(vote).representativeKey,'demos:'+target);

    const first=await writer.upsertVerifiedCurrentVote(db,vote);
    assert.equal(first.changed,true);
    const same=await writer.upsertVerifiedCurrentVote(db,vote);
    assert.equal(same.changed,false,'identical official decision is idempotent');

    const older=await writer.upsertVerifiedCurrentVote(db,{
      ...vote,ballotId:'MTG-PL-2026-10-21-DEC-900038',
      voteDate:'2026-10-21',ballotOrder:38,
      sourceUrl:'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-2026-10-21/decisions'
    });
    assert.equal(older.changed,false,'older sitting cannot displace current vote');

    const olderOrder=await writer.upsertVerifiedCurrentVote(db,{
      ...vote,ballotId:'MTG-PL-'+day+'-DEC-900039',
      ballotOrder:39
    });
    assert.equal(olderOrder.changed,false,'earlier order in same sitting must not displace');
    const newerOrder=await writer.upsertVerifiedCurrentVote(db,{
      ...vote,ballotId:'MTG-PL-'+day+'-DEC-900041',ballotOrder:41
    });
    assert.equal(newerOrder.changed,true);

    const result=await db.query(
      'SELECT representative_key,source_person_id,ballot_id,vote_date::text AS date '+
      'FROM public.institutional_current_nominal_votes WHERE institution=$1',
      ['PE']
    );
    assert.equal(result.rows.length,1,'only one PE current row may exist');
    assert.equal(result.rows[0].representative_key,'demos:'+target);
    assert.equal(result.rows[0].source_person_id,personId);
    assert.equal(result.rows[0].ballot_id,'MTG-PL-'+day+'-DEC-900041');
    assert.equal(result.rows[0].date,day);

    await db.query(
      'UPDATE public.institutional_nominal_identity_links '+
      "SET review_state='PENDING',reviewed_by=NULL,reviewed_at=NULL "+
      "WHERE institution='PE' AND representative_id=$1",
      [target]
    );
    const missing=await prepareSelectedEuropeanCurrentOnlyPreview(db,{
      client:{get:async()=>{sourceRequests++;throw Error('SHOULD_SKIP_API');}}
    });
    assert.equal(missing.prepared,0);
    assert.equal(missing.writesPerformed,0);
    assert.equal(sourceRequests,1,'no official API HTTP with zero verified selected links');

    console.log('EP_CANONICAL_SELECTED_CURRENT_WRITER_PG16_SYNTHETIC_PASS',
      JSON.stringify({
        approvedSyntheticIdentities:1,canonicalSelected:1,
        firstWrite:true,duplicateIgnored:true,olderIgnored:true,
        sameDayOlderIgnored:true,newerOrderReplaced:true,
        currentRows:1,identityRevocationStopsPreview:true,
        officialApiHttpCalls:0
      }));
  } finally {
    await db.query('ROLLBACK').catch(()=>{});
    const r=await db.query(
      'SELECT count(*)::int AS rows FROM public.institutional_current_nominal_votes'
    );
    assert.equal(r.rows[0].rows,0,'ROLLBACK must leave no current vote rows');
    await db.end();
  }
}
main().catch(e=>{
  console.error('EP_CANONICAL_SELECTED_CURRENT_WRITER_PG16_SYNTHETIC_FAIL',
    String(e?.message||e).slice(0,200));
  process.exitCode=1;
});
