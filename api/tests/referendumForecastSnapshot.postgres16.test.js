'use strict';

// Runs the ACTUAL JavaScript snapshot service against disposable PostgreSQL 16/17.
// Never load an application .env file, production pool, or remote endpoints.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { captureReferendumForecastSnapshots, bucketStart } =
  require('../services/referendumForecastSnapshotService');

const CI_DATABASE = 'postgresql://postgres:civic_ci_only@127.0.0.1:5432/civic_ci';
const USER = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('real snapshot JS: 9 suppressed, 10 published, revote updates, freeze immutable, rollback', async () => {
  assert.equal(process.env.CIVIC_TEST_DATABASE_URL, CI_DATABASE, 'NO_REMOTE_DB');
  assert.equal(process.env.DATABASE_URL || '', '', 'NO_APPLICATION_DB');
  assert.equal(process.env.DEMOS_UNIFIED_STAGING_PREFLIGHT_GO || '', '', 'NO_STAGING_GO');
  const client = new Client({connectionString:CI_DATABASE,connectionTimeoutMillis:5000});
  await client.connect();
  const versionResult = await client.query('SHOW server_version_num');
  const pgMajor = Math.floor(Number(versionResult.rows[0].server_version_num) / 10000);
  assert.ok([16,17].includes(pgMajor),'POSTGRES_ENGINE_UNSUPPORTED');
  assert.equal(String(pgMajor),process.env.CIVIC_CI_POSTGRES_MAJOR,'POSTGRES_ENGINE_MISMATCH');
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    const now = new Date();
    const futureOpen = new Date(now.getTime() + 24 * 3600 * 1000);
    const futureClose = new Date(now.getTime() + 48 * 3600 * 1000);
    for(let n=303;n<=310;n++){
      await client.query('INSERT INTO public.users(id) VALUES($1)',[USER(n)]);
    }
    const ballot = await client.query(
      'INSERT INTO public.civic_ballots ' +
      '(civic_process_id,ballot_kind,question_text,yes_meaning,no_meaning,' +
      'opens_at,closes_at,timezone,source_id,source_url) ' +
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      ['00000000-0000-4000-8000-00000000b001','referendum',
       'Synthetic vote only','Yes','No',futureOpen,futureClose,'Europe/Rome',
       'staging-fixture-js-service','https://example.invalid/ci']);
    const id = ballot.rows[0].id;
    for(let i=0;i<9;i++){
      await client.query(
        'INSERT INTO public.civic_ballot_positions(civic_ballot_id,user_id,choice) VALUES ($1,$2,$3)',
        [id,USER(301+i),i<6?'YES':'NO']);
    }
    const run = () => captureReferendumForecastSnapshots({pool:client,now,retentionDays:30});
    const below = await run();
    assert.equal(below.captured,0);
    assert.equal(below.suppressed,1);
    assert.deepEqual(below.errors,[]);
    let rows = await client.query('SELECT * FROM public.civic_ballot_forecast_snapshots');
    assert.equal(rows.rowCount,0,'Below-ten aggregate must not be persisted');

    await client.query(
      'INSERT INTO public.civic_ballot_positions(civic_ballot_id,user_id,choice) VALUES($1,$2,$3)',
      [id,USER(310),'ABSTAIN']);
    const first = await run();
    assert.equal(first.captured,1);
    assert.equal(first.suppressed,0);
    assert.deepEqual(first.errors,[]);
    rows = await client.query(
      'SELECT total_responses,yes_count,no_count,abstain_count,is_frozen,bucket_start '+
      'FROM public.civic_ballot_forecast_snapshots WHERE civic_ballot_id=$1',[id]);
    assert.equal(rows.rowCount,1);
    assert.deepEqual(
      [rows.rows[0].total_responses,rows.rows[0].yes_count,
       rows.rows[0].no_count,rows.rows[0].abstain_count,rows.rows[0].is_frozen],
      [10,6,3,1,false]);
    assert.equal(new Date(rows.rows[0].bucket_start).toISOString(),bucketStart(now).toISOString());

    await client.query(
      'UPDATE public.civic_ballot_positions SET choice=$1 WHERE civic_ballot_id=$2 AND user_id=$3',
      ['NO',id,USER(301)]);
    const updated = await run();
    assert.equal(updated.captured,1);
    assert.deepEqual(updated.errors,[]);
    rows = await client.query(
      'SELECT total_responses,yes_count,no_count,abstain_count FROM '+
      'public.civic_ballot_forecast_snapshots WHERE civic_ballot_id=$1',[id]);
    assert.equal(rows.rowCount,1,'Revote must not create a duplicate bucket');
    assert.deepEqual(
      [rows.rows[0].total_responses,rows.rows[0].yes_count,
       rows.rows[0].no_count,rows.rows[0].abstain_count],[10,5,4,1]);

    const opensAt = new Date(now.getTime()-3600*1000);
    await client.query('UPDATE public.civic_ballots SET opens_at=$1,status=$2 WHERE id=$3',
                       [opensAt,'closed',id]);
    const frozen = await run();
    assert.equal(frozen.captured,1);
    assert.deepEqual(frozen.errors,[]);
    const freezeQuery = 'SELECT total_responses,yes_count,no_count,abstain_count,is_frozen '+
                        'FROM public.civic_ballot_forecast_snapshots '+
                        'WHERE civic_ballot_id=$1 AND bucket_start=$2';
    const frozenRow = await client.query(freezeQuery,[id,opensAt]);
    assert.equal(frozenRow.rowCount,1);
    assert.deepEqual(
      [frozenRow.rows[0].total_responses,frozenRow.rows[0].yes_count,
       frozenRow.rows[0].no_count,frozenRow.rows[0].abstain_count,
       frozenRow.rows[0].is_frozen],[10,5,4,1,true]);

    await client.query(
      'UPDATE public.civic_ballot_positions SET choice=$1 WHERE civic_ballot_id=$2 AND user_id=$3',
      ['YES',id,USER(301)]);
    const attempted = await run();
    assert.equal(attempted.captured,0);
    assert.deepEqual(attempted.errors,[]);
    const unchanged = await client.query(freezeQuery,[id,opensAt]);
    assert.deepEqual(
      [unchanged.rows[0].total_responses,unchanged.rows[0].yes_count,
       unchanged.rows[0].no_count,unchanged.rows[0].abstain_count,
       unchanged.rows[0].is_frozen],[10,5,4,1,true]);
  } finally {
    if(inTransaction) await client.query('ROLLBACK');
    try {
      const counts = await client.query(
        'SELECT (SELECT COUNT(*)::int FROM public.users) AS users,'+
        '(SELECT COUNT(*)::int FROM public.civic_ballots) AS ballots,'+
        '(SELECT COUNT(*)::int FROM public.civic_ballot_positions) AS positions,'+
        '(SELECT COUNT(*)::int FROM public.civic_ballot_forecast_snapshots) AS snapshots,'+
        '(SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1) AS blocked');
      assert.deepEqual(counts.rows,[{users:2,ballots:0,positions:0,snapshots:0,blocked:true}]);
    } finally {
      await client.end();
    }
  }
});
