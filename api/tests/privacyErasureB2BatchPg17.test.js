'use strict';
// Disposable GitHub Actions PostgreSQL 17 database ONLY. Synthetic rows and
// fake B2 exporter; never access Supabase, Render or real object storage.
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const {PrivacyErasureB2Journal}=require('../services/privacyErasureB2Journal');
const Ledger=require('../services/privacyErasureLedgerService');

const DATABASE_URL='postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_b2_export_ci';
const ROLE='gdpr_b2_partial_export_ci';
const VISIBLE='synthetic-b2-visible';
const HIDDEN='synthetic-b2-hidden';
const safe = process.env.GITHUB_ACTIONS==='true' &&
  process.env.GDPR_B2_BATCH_PG17_CI==='isolated' &&
  process.env.PGHOST==='127.0.0.1' &&
  process.env.PGPORT==='5432' &&
  process.env.PGDATABASE==='gdpr_b2_export_ci' &&
  process.env.PGUSER==='postgres' &&
  process.env.PGPASSWORD==='synthetic-only' &&
  !process.env.DATABASE_URL && !process.env.RENDER &&
  !process.env.SUPABASE_URL && !process.env.GDPR_LEDGER_B2_SECRET_ACCESS_KEY;
if(!safe) throw Error('GDPR_B2_BATCH_PG17_REFUSES_PROVIDER_DATABASE');

test('real PG17 partial RLS cannot make manual B2 export seem complete',async()=>{
  const admin=new Pool({connectionString:DATABASE_URL,ssl:false,max:2});
  let fakeWrites=0;
  const journal=new PrivacyErasureB2Journal({env:{
    GDPR_LEDGER_B2_ENABLED:'true',
    GDPR_LEDGER_B2_BUCKET:'synthetic-gdpr-b2-journal',
    GDPR_LEDGER_B2_REGION:'eu-central-003',
    GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
    GDPR_LEDGER_B2_ACCESS_KEY_ID:'synthetic-id',
    GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'synthetic-only',
    GDPR_LEDGER_B2_RETENTION_DAYS:'30'
  },client:{send(){throw Error('UNEXPECTED_B2_NETWORK');}}});
  journal.archiveEvent=async(event)=>{fakeWrites++;return {eventKey:event.event_key};};
  try {
    const version=await admin.query("SELECT current_database() AS db,current_setting('server_version_num')::int AS ver");
    assert.equal(version.rows[0].db,'gdpr_b2_export_ci');
    assert.equal(Math.floor(version.rows[0].ver/10000),17);
    await Ledger.ensureTable(admin);
    for(const userId of [VISIBLE,HIDDEN]){
      await Ledger.recordEvent(admin,{
        userId,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
        details:{origin:'synthetic'}
      });
    }
    await admin.query('CREATE ROLE '+ROLE+' NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('GRANT USAGE ON SCHEMA public TO '+ROLE);
    await admin.query('GRANT SELECT ON public.privacy_erasure_ledger TO '+ROLE);
    await admin.query('CREATE POLICY gdpr_b2_ci_partial_read ON public.privacy_erasure_ledger '+
      'FOR SELECT TO '+ROLE+" USING (subject_user_id='"+VISIBLE+"')");
    const conn=await admin.connect();
    try {
      await conn.query('BEGIN');
      await conn.query('SET LOCAL ROLE '+ROLE);
      assert.equal((await conn.query('SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger')).rows[0].n,1);
      await assert.rejects(journal.archiveBatch(conn,{limit:5}),
        /GDPR_B2_ARCHIVE_INCOMPLETE_VISIBILITY/);
      assert.equal(fakeWrites,0,'partial SQL history must not create remote objects');
    } finally {
      await conn.query('ROLLBACK');conn.release();
    }
    const complete=await journal.archiveBatch(admin,{limit:5});
    assert.equal(complete.exported,2);
    assert.equal(fakeWrites,2);
    const end=await journal.archiveBatch(admin,{limit:5,after:complete.cursor});
    assert.equal(end.exported,0);
    assert.equal(fakeWrites,2,'genuinely empty next page never writes B2');
    console.log('GDPR_B2_BATCH_PG17_SYNTHETIC_PASS');
  } finally {
    await admin.end();
  }
});
