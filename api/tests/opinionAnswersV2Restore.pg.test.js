'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {Client} = require('pg');

// Research-only: invented account IDs, data and "external" event replay.
// This is a database restore SIMULATION, not a B2/PITR restore or a live route.
// The gate MUST be closed OUTSIDE the restored database before traffic resumes.
const connectionString = process.env.OPINION_V2_PG_CI_URL;
const enabled = Boolean(connectionString && process.env.GITHUB_ACTIONS === 'true');
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const tables = ['ci_v2_restore_shadow','ci_v2_restore_legacy',
  'ci_v2_restore_ledger','ci_v2_restore_users','ci_v2_restore_gate'];

function assertDisposable() {
  if (!connectionString || process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('Only isolated PostgreSQL GitHub Actions research DB permitted');
  }
  const u = new URL(connectionString);
  if (!['127.0.0.1','localhost','::1'].includes(u.hostname) ||
      u.pathname !== '/opinion_answers_ci') {
    throw new Error('Refusing nonlocal/non-ephemeral PostgreSQL database');
  }
}
async function requireReady(db) {
  // In an integrated implementation, this gate must be enforced on EVERY
  // read/write path and authenticated before querying sensitive answers.
  const status = await db.query(
    'SELECT ready, replay_complete FROM ci_v2_restore_gate WHERE id=1 FOR SHARE'
  );
  if (status.rowCount !== 1 ||
      status.rows[0].ready !== true ||
      status.rows[0].replay_complete !== true) {
    throw new Error('GDPR_RESTORE_NOT_RECONCILED');
  }
}
async function readAnswers(db,userId) {
  await db.query('BEGIN');
  try {
    await requireReady(db);
    const r = await db.query(
      'SELECT u.consent,s.answers FROM ci_v2_restore_users u '+
      'LEFT JOIN ci_v2_restore_shadow s ON s.user_id=u.id WHERE u.id=$1', [userId]
    );
    if (!r.rowCount || !r.rows[0].consent) {
      await db.query('ROLLBACK');
      return null;
    }
    await db.query('COMMIT');
    return r.rows[0].answers;
  } catch(e) { await db.query('ROLLBACK');throw e; }
}
async function writeAnswers(db,userId,answer) {
  await db.query('BEGIN');
  try {
    await requireReady(db);
    await db.query('SELECT id FROM ci_v2_restore_users WHERE id=$1 FOR UPDATE',[userId]);
    const state=await db.query('SELECT consent FROM ci_v2_restore_users WHERE id=$1',[userId]);
    if(!state.rowCount || state.rows[0].consent !== true) {
      await db.query('ROLLBACK');
      return false;
    }
    await db.query(
      'INSERT INTO ci_v2_restore_shadow AS old (user_id,answers) '+
      'VALUES ($1,$2::jsonb) ON CONFLICT(user_id) DO UPDATE SET '+
      'answers=old.answers || EXCLUDED.answers',
      [userId, JSON.stringify({opinione_0:answer})]
    );
    await db.query('COMMIT');
    return true;
  } catch(e) { await db.query('ROLLBACK');throw e; }
}
async function replayExternal(db, events) {
  // A real cutover MUST independently attest a complete durable external
  // ledger capture and verified watermark before executing these steps.
  if (!Array.isArray(events) || events.length !== 2) {
    throw new Error('Synthetic test expects the complete two-event fixture');
  }
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query('SELECT id FROM ci_v2_restore_gate WHERE id=1 FOR UPDATE');
    await db.query('UPDATE ci_v2_restore_gate SET ready=false,replay_complete=false WHERE id=1');
    for(const e of events){
      await db.query(
        'INSERT INTO ci_v2_restore_ledger(event_key,subject_user_id,event_type) '+
        'VALUES($1,$2,$3) ON CONFLICT(event_key) DO NOTHING',
        [e.key,e.userId,e.type]
      );
      if(e.type==='political_consent_revoked') {
        await db.query('UPDATE ci_v2_restore_users SET consent=false WHERE id=$1',[e.userId]);
      } else if(e.type==='account_deleted') {
        // For this synthetic model delete both representations first, then
        // the user (real GDPR cleanup covers many more user-linked tables).
        await db.query('DELETE FROM ci_v2_restore_users WHERE id=$1',[e.userId]);
      } else {
        throw new Error('Unexpected synthetic event type');
      }
      await db.query('DELETE FROM ci_v2_restore_legacy WHERE user_id=$1',[e.userId]);
      await db.query('DELETE FROM ci_v2_restore_shadow WHERE user_id=$1',[e.userId]);
    }
    await db.query(
      'UPDATE ci_v2_restore_gate SET replay_complete=true,ready=true WHERE id=1'
    );
    await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}
}
test('synthetic restore gate blocks resurrected v2 answers until ledger replay',
  {skip:!enabled}, async t=>{
  assertDisposable();
  const a=new Client({connectionString,connectionTimeoutMillis:5000});
  const b=new Client({connectionString,connectionTimeoutMillis:5000});
  await a.connect();
  try {
    await b.connect();
    for(const table of tables) await a.query('DROP TABLE IF EXISTS '+table);
    await a.query('CREATE TABLE ci_v2_restore_gate (id integer PRIMARY KEY, ready boolean NOT NULL,replay_complete boolean NOT NULL)');
    await a.query('INSERT INTO ci_v2_restore_gate VALUES(1,false,false)');
    await a.query('CREATE TABLE ci_v2_restore_users (id uuid PRIMARY KEY, consent boolean NOT NULL)');
    await a.query('CREATE TABLE ci_v2_restore_legacy (user_id uuid PRIMARY KEY,answer text)');
    await a.query("CREATE TABLE ci_v2_restore_shadow (user_id uuid PRIMARY KEY,answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='object'))");
    await a.query('CREATE TABLE ci_v2_restore_ledger (event_key text PRIMARY KEY,subject_user_id uuid NOT NULL,event_type text NOT NULL)');
    for(let i=1;i<=3;i++){
      // Simulated OLD backup already contains personal data that were erased
      // after its snapshot. The consent boolean is stale.
      await a.query('INSERT INTO ci_v2_restore_users VALUES($1,true)',[uid(i)]);
      await a.query("INSERT INTO ci_v2_restore_legacy VALUES($1,'f')",[uid(i)]);
      await a.query("INSERT INTO ci_v2_restore_shadow VALUES($1,$2::jsonb)",
        [uid(i),'{"opinione_0":"f"}']);
    }
    const external=[
      {key:'revocation-after-snapshot',userId:uid(2),type:'political_consent_revoked'},
      {key:'deletion-after-snapshot',userId:uid(3),type:'account_deleted'}
    ];
    await t.test('restored-but-unreconciled state rejects both read and write',async()=>{
      await assert.rejects(readAnswers(a,uid(2)),/GDPR_RESTORE_NOT_RECONCILED/);
      await assert.rejects(readAnswers(a,uid(3)),/GDPR_RESTORE_NOT_RECONCILED/);
      await assert.rejects(writeAnswers(a,uid(2),'i'),/GDPR_RESTORE_NOT_RECONCILED/);
      assert.equal((await a.query('SELECT count(*)::int AS n FROM ci_v2_restore_shadow')).rows[0].n,3);
    });
    await t.test('incomplete external ledger fails closed without reopening gate',async()=>{
      await assert.rejects(replayExternal(a,external.slice(0,1)),/complete two-event fixture/);
      await assert.rejects(readAnswers(a,uid(1)),/GDPR_RESTORE_NOT_RECONCILED/);
    });
    await t.test('atomic replay removes deleted and revoked answers from BOTH tables',async()=>{
      await replayExternal(a,external);
      const left=await a.query('SELECT user_id FROM ci_v2_restore_shadow ORDER BY user_id');
      assert.deepEqual(left.rows.map(x=>x.user_id),[uid(1)]);
      const legacy=await a.query('SELECT user_id FROM ci_v2_restore_legacy ORDER BY user_id');
      assert.deepEqual(legacy.rows.map(x=>x.user_id),[uid(1)]);
      assert.equal(await readAnswers(a,uid(2)),null);
      assert.equal(await readAnswers(a,uid(3)),null);
      assert.deepEqual(await readAnswers(a,uid(1)),{opinione_0:'f'});
      assert.equal(await writeAnswers(a,uid(2),'i'),false);
      assert.equal(await writeAnswers(a,uid(3),'i'),false);
      assert.equal(await writeAnswers(a,uid(1),'c'),true);
      assert.deepEqual(await readAnswers(a,uid(1)),{opinione_0:'c'});
    });
    await t.test('replay is idempotent and never resurrects revoked accounts',async()=>{
      await replayExternal(a,external);
      assert.equal(await readAnswers(a,uid(2)),null);
      assert.equal(await readAnswers(a,uid(3)),null);
      const r=await a.query('SELECT count(*)::int AS n FROM ci_v2_restore_ledger');
      assert.equal(r.rows[0].n,2);
    });
    await t.test('new restore requires closing gate before any read or write',async()=>{
      await a.query('UPDATE ci_v2_restore_gate SET ready=false,replay_complete=false WHERE id=1');
      await assert.rejects(readAnswers(b,uid(1)),/GDPR_RESTORE_NOT_RECONCILED/);
      await assert.rejects(writeAnswers(b,uid(1),'f'),/GDPR_RESTORE_NOT_RECONCILED/);
    });
  } finally {
    for(const table of tables) await a.query('DROP TABLE IF EXISTS '+table);
    await b.end();
    await a.end();
  }
});
