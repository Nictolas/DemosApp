'use strict';

// Uses ONLY the disposable GitHub Actions PG17 service with invented accounts.
// Does not touch production schema, Supabase, Render, secrets or real B2.
const test=require('node:test');
const assert=require('node:assert/strict');
const { Pool }=require('pg');
const {
  SyntheticExternalJournal, SyntheticDatabase,
  restoreSyntheticSnapshot
}=require('./fixtures/gdprDurableRecoveryPrototype');

const url=process.env.TEST_DATABASE_URL || '';
const safe=process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GDPR_OUTBOX_WORKER_CI === 'isolated' &&
  !process.env.DATABASE_URL &&
  url === 'postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';

if (!safe) {
  test('durable recovery PG17 experiment requires disposable synthetic CI only',
    {skip:'Exact GitHub Actions PostgreSQL 17 guard not satisfied'},()=>{});
} else {
  const pool=new Pool({connectionString:url,ssl:false,max:2});
  const schema='gdpr_recovery_model_ci';
  const alice={id:'fictional-alice',consent:true};
  const bob={id:'fictional-bob',consent:false};

  async function reset() {
    await pool.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');
    await pool.query('CREATE SCHEMA '+schema);
    await pool.query('CREATE TABLE '+schema+
      '.accounts(id text PRIMARY KEY, consent boolean NOT NULL)');
    await pool.query('CREATE TABLE '+schema+
      '.ledger(event_id text PRIMARY KEY, action text NOT NULL, subject text NOT NULL)');
    await pool.query('INSERT INTO '+schema+
      '.accounts(id,consent) VALUES ($1,$2),($3,$4)',
      [alice.id,alice.consent,bob.id,bob.consent]);
  }
  async function atomicWrite(op) {
    const client=await pool.connect();
    let tx=false;
    try {
      await client.query('BEGIN');
      tx=true;
      if(op.action==='account_deleted') {
        await client.query('DELETE FROM '+schema+'.accounts WHERE id=$1',[op.subject]);
      } else {
        await client.query('UPDATE '+schema+
          '.accounts SET consent=$2 WHERE id=$1',
          [op.subject,op.action==='political_consent_granted']);
      }
      await client.query('INSERT INTO '+schema+
        '.ledger(event_id,action,subject) VALUES ($1,$2,$3)',
        [op.id,op.action,op.subject]);
      await client.query('COMMIT');
      tx=false;
    } catch(e) {if(tx)await client.query('ROLLBACK');throw e;}
    finally{client.release();}
  }
  async function restoreOldSnapshot() {
    // Synthetic stand-in for restoring the earlier snapshot: not pg_restore.
    await pool.query('TRUNCATE '+schema+'.ledger');
    await pool.query('TRUNCATE '+schema+'.accounts');
    await pool.query('INSERT INTO '+schema+
      '.accounts(id,consent) VALUES ($1,$2),($3,$4)',
      [alice.id,alice.consent,bob.id,bob.consent]);
  }
  async function replay(operations) {
    const client=await pool.connect();
    let tx=false;
    try {
      await client.query('BEGIN');
      tx=true;
      for(const op of operations) {
        const existing=await client.query('SELECT 1 FROM '+schema+
          '.ledger WHERE event_id=$1',[op.id]);
        if(existing.rowCount)continue;
        if(op.action==='account_deleted') {
          await client.query('DELETE FROM '+schema+'.accounts WHERE id=$1',[op.subject]);
        } else {
          const update=await client.query('UPDATE '+schema+
            '.accounts SET consent=$2 WHERE id=$1',
            [op.subject,op.action==='political_consent_granted']);
          if(update.rowCount !== 1)throw Error('SYNTHETIC_REPLAY_UNKNOWN_ACCOUNT');
        }
        await client.query('INSERT INTO '+schema+
          '.ledger(event_id,action,subject) VALUES($1,$2,$3)',
          [op.id,op.action,op.subject]);
      }
      await client.query('COMMIT');
      tx=false;
    }catch(e){if(tx)await client.query('ROLLBACK');throw e;}
    finally{client.release();}
  }
  async function rows() {
    return (await pool.query('SELECT id,consent FROM '+schema+
      '.accounts ORDER BY id')).rows;
  }
  function operation(id,action,subject=alice.id) {
    return {id,action,subject};
  }
  function seals(journal) {
    journal.seal();
    return {writersFenced:true,ingressBlocked:true,providersQuarantined:true,
      independentWitness:journal.witness.current()};
  }

  test('PG17 COMMIT then synthetic older snapshot: witnessed deletion is re-applied',async()=>{
    await reset();
    const journal=new SyntheticExternalJournal();
    const deletion=operation('delete-pg17','account_deleted');
    journal.prepare(deletion);
    await atomicWrite(deletion);
    journal.commit(deletion);
    const flags=seals(journal);
    await restoreOldSnapshot();
    assert.deepEqual(await rows(),[alice,bob]);
    const model=restoreSyntheticSnapshot(
      new SyntheticDatabase({[alice.id]:{exists:true,consent:true},
        [bob.id]:{exists:true,consent:false}}),journal,flags);
    assert.equal(model.productionRecoveryReady,false);
    const operations=journal.verify();
    await replay(operations);
    assert.deepEqual(await rows(),[bob]);
    await replay(operations);
    assert.deepEqual(await rows(),[bob],'idempotent SQL replay');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM '+schema+
      '.ledger')).rows[0].n,1);
  });

  test('PG17 COMMIT without external finalize: restored old state must remain NO-GO',async()=>{
    await reset();
    const journal=new SyntheticExternalJournal();
    const deletion=operation('unconfirmed-pg17','account_deleted');
    journal.prepare(deletion);
    await atomicWrite(deletion);
    assert.deepEqual(await rows(),[bob]);
    await restoreOldSnapshot();
    const flags=seals(journal);
    assert.throws(()=>restoreSyntheticSnapshot(
      new SyntheticDatabase({[alice.id]:{exists:true,consent:true},
        [bob.id]:{exists:true,consent:false}}),journal,flags),
      {code:'GDPR_MODEL_AMBIGUOUS_INTENT'});
    assert.deepEqual(await rows(),[alice,bob],
      'no traffic/admission claim; original snapshot not silently presented as recovered');
  });

  test('PG17 replay preserves a later committed grant after an earlier revocation',async()=>{
    await reset();
    const journal=new SyntheticExternalJournal();
    const revoke=operation('revoke-pg17','political_consent_revoked');
    const grant=operation('grant-pg17','political_consent_granted');
    for(const current of [revoke,grant]){
      journal.prepare(current);
      await atomicWrite(current);
      journal.commit(current);
    }
    const flags=seals(journal);
    await restoreOldSnapshot();
    const model=restoreSyntheticSnapshot(
      new SyntheticDatabase({[alice.id]:{exists:true,consent:true},
        [bob.id]:{exists:true,consent:false}}),journal,flags);
    assert.equal(model.database.accounts[alice.id].consent,true);
    await replay(journal.verify());
    assert.deepEqual(await rows(),[alice,bob],
      'a newer authorized grant must survive an older revoke');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM '+schema+
      '.ledger')).rows[0].n,2);
  });

  test('PG17 distinct accounts can COMMIT concurrently, with reverse journal finalization',async()=>{
    await reset();
    const journal=new SyntheticExternalJournal();
    const first=operation('delete-a-parallel','account_deleted');
    const second=operation('revoke-b-parallel','political_consent_revoked',bob.id);
    journal.prepare(first);
    journal.prepare(second);
    // Two actual PostgreSQL connections/transactions, one subject each.
    await Promise.all([atomicWrite(first),atomicWrite(second)]);
    journal.commit(second);
    journal.commit(first);
    const flags=seals(journal);
    await restoreOldSnapshot();
    const model=restoreSyntheticSnapshot(
      new SyntheticDatabase({[alice.id]:{exists:true,consent:true},
        [bob.id]:{exists:true,consent:false}}),journal,flags);
    assert.equal(model.productionRecoveryReady,false);
    assert.equal(model.replayed,2);
    await replay(journal.verify());
    assert.deepEqual(await rows(),[{id:bob.id,consent:false}]);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM '+schema+
      '.ledger')).rows[0].n,2);
  });

  test('PG17 original confirmed row can support TEST-ONLY ambiguous finalization',async()=>{
    await reset();
    const journal=new SyntheticExternalJournal();
    const pending=operation('ambiguous-live-primary','account_deleted');
    journal.prepare(pending);
    const witness=journal.witness.current();
    await atomicWrite(pending);
    const committed=(await pool.query('SELECT event_id,action,subject FROM '+schema+
      '.ledger WHERE event_id=$1',[pending.id])).rows;
    assert.equal(committed.length,1);
    // This is intentionally a fixture adapter, not a trusted production SQL
    // attestation. A real system must authenticate the original writer/pool.
    const marked=new SyntheticDatabase({[alice.id]:{exists:true,consent:true}});
    if(committed[0].event_id===pending.id &&
        committed[0].action===pending.action &&
        committed[0].subject===pending.subject) marked.apply(pending);
    const outcome=journal.finalizeAmbiguousFromOriginalPrimary(marked,pending,{
      originalPrimaryVerified:true,writersFenced:true,
      independentWitness:witness
    });
    assert.equal(outcome.externallyFinalized,true);
    const flags=seals(journal);
    await restoreOldSnapshot();
    const restored=restoreSyntheticSnapshot(
      new SyntheticDatabase({[alice.id]:{exists:true,consent:true},
        [bob.id]:{exists:true,consent:false}}),journal,flags);
    await replay(journal.verify());
    assert.equal(restored.productionRecoveryReady,false);
    assert.deepEqual(await rows(),[bob]);
  });

  test.after(async()=>{
    try {await pool.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');}
    finally {await pool.end();}
  });
}
