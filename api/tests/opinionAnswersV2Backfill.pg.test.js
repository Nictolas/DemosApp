'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {
  validateLegacyIds,assertLegacySchemaInventory,legacyRowToAnswers,rollbackCoverage,rollbackParity
}=require('../experiments/opinionAnswersV2BackfillCandidate');

// RESEARCH ONLY. Run exclusively on synthetic PostgreSQL 17 in GitHub Actions.
// All operations are on disposable ci_v2_bf_* tables (not public users).
const connectionString=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(connectionString && process.env.GITHUB_ACTIONS==='true');
const ids=validateLegacyIds(Array.from({length:94},(_,i)=>'opinione_'+i));
const uid=(n)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const names=['ci_v2_bf_shadow','ci_v2_bf_legacy','ci_v2_bf_replay','ci_v2_bf_users'];

async function backfill(db,id,{afterLock}={}) {
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL lock_timeout='5s'");
    const locked=await db.query('SELECT id FROM ci_v2_bf_users WHERE id=$1 FOR UPDATE',[id]);
    if (!locked.rowCount) {await db.query('ROLLBACK');return 'missing-user';}
    if (afterLock) await afterLock();
    // A separate READ COMMITTED query AFTER acquiring the users lock is
    // mandatory; the locked SELECT itself may have a stale snapshot.
    const consent=await db.query('SELECT consent FROM ci_v2_bf_users WHERE id=$1',[id]);
    if (!consent.rows[0].consent) {await db.query('ROLLBACK');return 'no-consent';}
    // This synthetic table models an *external*, durable GDPR erasure journal
    // that has been REPLAYED into the restored DB before writes resume.
    const erased=await db.query('SELECT 1 FROM ci_v2_bf_replay WHERE user_id=$1',[id]);
    if (erased.rowCount) {await db.query('ROLLBACK');return 'erased';}
    const already=await db.query('SELECT answers FROM ci_v2_bf_shadow WHERE user_id=$1 FOR UPDATE',[id]);
    const selection='SELECT '+ids.map(id=>'"'+id+'"').join(',')+
      ' FROM ci_v2_bf_legacy WHERE user_id=$1';
    const legacy=await db.query(selection,[id]);
    if (already.rowCount) {
      const same=legacy.rowCount && rollbackParity(already.rows[0].answers,legacy.rows[0],ids).canRollbackWithoutLoss;
      await db.query('COMMIT');
      return same ? 'already' : 'conflict';
    }
    if (!legacy.rowCount) {await db.query('COMMIT');return 'no-legacy';}
    const answers=legacyRowToAnswers(legacy.rows[0],ids);
    if (!Object.keys(answers).length) {await db.query('COMMIT');return 'empty';}
    const inserted=await db.query(
      'INSERT INTO ci_v2_bf_shadow(user_id,answers) VALUES($1,$2::jsonb) '+
      'ON CONFLICT (user_id) DO NOTHING RETURNING user_id',
      [id,JSON.stringify(answers)]
    );
    await db.query('COMMIT');
    return inserted.rowCount ? 'copied' : 'already';
  } catch(e) {await db.query('ROLLBACK');throw e;}
}
async function revoke(db,id) {
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query('SELECT id FROM ci_v2_bf_users WHERE id=$1 FOR UPDATE',[id]);
    await db.query('UPDATE ci_v2_bf_users SET consent=false WHERE id=$1',[id]);
    // In a REAL release every political data table, backups and GDPR
    // erasure ledger must be covered; these are invented tables only.
    await db.query('DELETE FROM ci_v2_bf_shadow WHERE user_id=$1',[id]);
    await db.query('DELETE FROM ci_v2_bf_legacy WHERE user_id=$1',[id]);
    await db.query('COMMIT');
  } catch(e) {await db.query('ROLLBACK');throw e;}
}
async function shadow(db,id) {
  const r=await db.query('SELECT answers FROM ci_v2_bf_shadow WHERE user_id=$1',[id]);
  return r.rowCount ? r.rows[0].answers : null;
}
function disposableUrl() {
  if(!connectionString)throw Error('Missing isolated CI connection');
  const u=new URL(connectionString);
  if(!['127.0.0.1','localhost','::1'].includes(u.hostname) ||
      u.pathname!=='/opinion_answers_ci') {
    throw Error('Refusing any nonlocal / non-ephemeral PostgreSQL database');
  }
}
test('synthetic v2 backfill: idempotence, consent, erasure and rollback gates',
  {skip:!enabled},async t=>{
  disposableUrl();
  const a=new Client({connectionString,connectionTimeoutMillis:5000});
  const b=new Client({connectionString,connectionTimeoutMillis:5000});
  await a.connect();
  try {
    await b.connect();
    for(const name of names) await a.query('DROP TABLE IF EXISTS '+name);
    await a.query('CREATE TABLE ci_v2_bf_users(id uuid PRIMARY KEY,consent boolean NOT NULL)');
    await a.query('CREATE TABLE ci_v2_bf_replay(user_id uuid PRIMARY KEY)');
    await a.query('CREATE TABLE ci_v2_bf_legacy ('+
      'user_id uuid PRIMARY KEY REFERENCES ci_v2_bf_users(id),'+
      ids.map(id=>'"'+id+'" text').join(',')+
      ',fonti_opinioni jsonb)');
    // Read only schema metadata to attest ALL legacy columns, including
    // archived IDs, before any personal-data backfill could begin.
    const inventory=await a.query(
      "SELECT column_name, data_type FROM information_schema.columns "+
      "WHERE table_schema='public' AND table_name='ci_v2_bf_legacy'"
    );
    assert.equal(assertLegacySchemaInventory(ids,inventory.rows).coveredIds,94);
    await a.query('CREATE TABLE ci_v2_bf_shadow ('+
      'user_id uuid PRIMARY KEY REFERENCES ci_v2_bf_users(id),'+
      "answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(answers)='object'))");

    for(let i=1;i<=9;i++){
      await a.query('INSERT INTO ci_v2_bf_users VALUES($1,$2)',[uid(i),i!==2]);
    }
    for(let i=1;i<=9;i++){
      const value=i===5 ? 'invalid' : 'f';
      await a.query('INSERT INTO ci_v2_bf_legacy(user_id,"opinione_0",fonti_opinioni) '+
        "VALUES($1,$2,$3::jsonb)",[uid(i),i===3?null:value,JSON.stringify({source:'synthetic'})]);
    }
    await a.query('UPDATE ci_v2_bf_legacy SET "opinione_1"=$2,"opinione_93"=$3 WHERE user_id=$1',
      [uid(1),'c','i']);
    await a.query('INSERT INTO ci_v2_bf_shadow(user_id,answers) VALUES($1,$2::jsonb)',
      [uid(4),JSON.stringify({opinione_0:'i',opinione_94:'c'})]);
    // This is the journal REPLAYED after a simulated restore, not the source.
    await a.query('INSERT INTO ci_v2_bf_replay VALUES($1)',[uid(6)]);

    await t.test('copy all non-null legacy values without querying the catalog table',async()=>{
      assert.equal(await backfill(a,uid(1)),'copied');
      assert.deepEqual(await shadow(a,uid(1)),{
        opinione_0:'f',opinione_1:'c',opinione_93:'i'
      });
      assert.equal(await backfill(a,uid(1)),'already');
    });
    await t.test('skip revoked, empty, existing v2 and erased-on-restore accounts',async()=>{
      assert.equal(await backfill(a,uid(2)),'no-consent');
      assert.equal(await backfill(a,uid(3)),'empty');
      assert.equal(await backfill(a,uid(4)),'conflict');
      assert.deepEqual(await shadow(a,uid(4)),{opinione_0:'i',opinione_94:'c'});
      assert.equal(await backfill(a,uid(6)),'erased');
      assert.equal(await shadow(a,uid(2)),null);
      assert.equal(await shadow(a,uid(3)),null);
      assert.equal(await shadow(a,uid(6)),null);
    });
    await t.test('detect legacy changes after initial backfill without overwriting either side',async()=>{
      await a.query('UPDATE ci_v2_bf_legacy SET "opinione_0"=$2 WHERE user_id=$1',[uid(1),'i']);
      assert.equal(await backfill(a,uid(1)),'conflict');
      assert.equal((await shadow(a,uid(1))).opinione_0,'f');
      await a.query('UPDATE ci_v2_bf_legacy SET "opinione_0"=$2 WHERE user_id=$1',[uid(1),'f']);
      assert.equal(await backfill(a,uid(1)),'already');
    });
    await t.test('invalid legacy value aborts atomically and preserves source',async()=>{
      await assert.rejects(()=>backfill(a,uid(5)),/Unexpected legacy answer/);
      assert.equal(await shadow(a,uid(5)),null);
      const legacy=await a.query('SELECT "opinione_0" AS answer FROM ci_v2_bf_legacy WHERE user_id=$1',[uid(5)]);
      assert.equal(legacy.rows[0].answer,'invalid');
    });
    await t.test('revocation after backfill removes both legacy and shadow',async()=>{
      assert.equal(await backfill(a,uid(7)),'copied');
      await revoke(b,uid(7));
      assert.equal(await shadow(a,uid(7)),null);
      assert.equal(await backfill(a,uid(7)),'no-consent');
    });
    await t.test('revocation holds user lock and a queued backfill cannot resurrect data',async()=>{
      await b.query('BEGIN');
      await b.query('SELECT id FROM ci_v2_bf_users WHERE id=$1 FOR UPDATE',[uid(8)]);
      const pending=backfill(a,uid(8));
      await b.query('UPDATE ci_v2_bf_users SET consent=false WHERE id=$1',[uid(8)]);
      await b.query('DELETE FROM ci_v2_bf_legacy WHERE user_id=$1',[uid(8)]);
      await b.query('DELETE FROM ci_v2_bf_shadow WHERE user_id=$1',[uid(8)]);
      await b.query('COMMIT');
      assert.equal(await pending,'no-consent');
      assert.equal(await shadow(a,uid(8)),null);
    });
    await t.test('backfill holds user lock and queued revocation clears migrated data',async()=>{
      let release,mark;
      const locked=new Promise(resolve=>{mark=resolve;});
      const continueWork=new Promise(resolve=>{release=resolve;});
      const pending=backfill(a,uid(9),{afterLock:async()=>{mark();await continueWork;}});
      await locked;
      const pendingRevoke=revoke(b,uid(9));
      release();
      assert.equal(await pending,'copied');
      await pendingRevoke;
      assert.equal(await shadow(a,uid(9)),null);
    });
    await t.test('legacy rollback is blocked for a 95th opinion not in old columns',async()=>{
      const old=rollbackCoverage(await shadow(a,uid(1)),ids);
      assert.deepEqual(old,{canRollbackWithoutLoss:true,unrepresentable:[]});
      const future=rollbackCoverage(await shadow(a,uid(4)),ids);
      assert.deepEqual(future,{canRollbackWithoutLoss:false,unrepresentable:['opinione_94']});
    });
    await t.test('rollback blocks older-ID drift, not only 95th ID coverage',async()=>{
      const legacy=(await a.query(
        'SELECT '+ids.map(id=>'"'+id+'"').join(',')+
        ' FROM ci_v2_bf_legacy WHERE user_id=$1',[uid(1)]
      )).rows[0];
      const current=await shadow(a,uid(1));
      assert.deepEqual(rollbackParity(current,legacy,ids),{
        canRollbackWithoutLoss:true,unrepresentable:[],divergentIds:[]
      });
      await a.query(
        'UPDATE ci_v2_bf_shadow SET answers=answers || $2::jsonb WHERE user_id=$1',
        [uid(1),JSON.stringify({opinione_0:'i'})]
      );
      assert.deepEqual(rollbackParity(await shadow(a,uid(1)),legacy,ids),{
        canRollbackWithoutLoss:false,unrepresentable:[],divergentIds:['opinione_0']
      });
      await a.query(
        'UPDATE ci_v2_bf_shadow SET answers=answers || $2::jsonb WHERE user_id=$1',
        [uid(1),JSON.stringify({opinione_0:'f'})]
      );
      assert.equal(rollbackParity(await shadow(a,uid(4)),legacy,ids).canRollbackWithoutLoss,false);
    });
    await t.test('source JSONB in legacy remains untouched by this answer-only proof',async()=>{
      const r=await a.query('SELECT fonti_opinioni FROM ci_v2_bf_legacy WHERE user_id=$1',[uid(1)]);
      assert.deepEqual(r.rows[0].fonti_opinioni,{source:'synthetic'});
    });
  } finally {
    for(const name of names) await a.query('DROP TABLE IF EXISTS '+name);
    await b.end();
    await a.end();
  }
});
