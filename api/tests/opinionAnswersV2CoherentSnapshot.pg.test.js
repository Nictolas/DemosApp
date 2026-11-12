'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {
  buildCoherentHybridRegionSnapshotQuery,planSnapshotPublication
}=require('../experiments/opinionAnswersV2CoherentSnapshotCandidate');

const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri&&process.env.GITHUB_ACTIONS==='true');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const published=new Set(['opinione_0','opinione_94']);
const tables=['ci_coherent_answers','ci_coherent_consents','ci_coherent_users'];
function guard(){
  const u=new URL(uri);
  if(!['127.0.0.1','localhost','::1'].includes(u.hostname) ||
     u.pathname!=='/opinion_answers_ci' ||
     process.env.GITHUB_ACTIONS!=='true'){
    throw Error('Refusing PostgreSQL outside disposable CI');
  }
}
async function drop(db){
  for(const name of tables)await db.query('DROP TABLE IF EXISTS '+name);
}
async function snapshot(db,opinionId){
  const spec=buildCoherentHybridRegionSnapshotQuery(
    opinionId,published,['opinione_0']
  );
  const sql=spec.sql
    .replaceAll('FROM opinioni_risposte orr','FROM ci_coherent_answers orr')
    .replaceAll('JOIN users u','JOIN ci_coherent_users u')
    .replaceAll('JOIN user_consents uc','JOIN ci_coherent_consents uc');
  const rows=(await db.query(sql,spec.params)).rows;
  return planSnapshotPublication(rows);
}

test('disposable PG17: single statement national/regional snapshot is coherent',
  {skip:!enabled},async t=>{
  guard();
  const db=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  await db.connect();
  try{
    await drop(db);
    await db.query('CREATE TABLE ci_coherent_users('+
      'id uuid PRIMARY KEY, account_type text NOT NULL,'+
      'political_opinions_consent boolean NOT NULL, regione_residenza text)');
    await db.query('CREATE TABLE ci_coherent_consents('+
      'user_id uuid PRIMARY KEY REFERENCES ci_coherent_users(id),'+
      'political_opinions_consent boolean)');
    await db.query('CREATE TABLE ci_coherent_answers('+
      'user_id uuid PRIMARY KEY REFERENCES ci_coherent_users(id),'+
      '"opinione_0" text, answers_extra jsonb)');
    // Ten Toscana persons all in favor, one Lazio person opposed,
    // plus an excluded organization and an explicitly denied subject.
    for(let i=1;i<=13;i++){
      const isToscana=i<=10;
      const region=isToscana?'TO':(i===11?'LA':'LO');
      const type=i===12?'O':(i%2===0?'P':'PERSON');
      await db.query('INSERT INTO ci_coherent_users VALUES($1,$2,true,$3)',
        [uid(i),type,region]);
      await db.query('INSERT INTO ci_coherent_answers VALUES($1,$2,$3::jsonb)',
        [uid(i),i===11?'c':'f',
          JSON.stringify({opinione_94:i===11?'c':'f',opinione_archived:'i'})]);
    }
    await db.query('INSERT INTO ci_coherent_consents VALUES($1,false)',
      [uid(13)]);
    await t.test('one snapshot for old and future opinion yields same safe plan',async()=>{
      for(const id of ['opinione_0','opinione_94']){
        const {national,regions,publication}=await snapshot(db,id);
        assert.deepEqual(national,{
          favorevole:'10',contrario:'1',indeciso:'0'
        });
        assert.equal(regions.length,20);
        assert.equal(publication.publishNational,false);
        assert.deepEqual(publication.visibleRegions,[]);
        assert.ok(publication.suppressedRegions.includes('TO'));
        assert.ok(publication.suppressedRegions.includes('LA'));
      }
    });
    await t.test('new full region still cannot expose hidden single contrary answer',async()=>{
      await db.query('INSERT INTO ci_coherent_users VALUES($1,$2,true,$3)',
        [uid(14),'P','LO']);
      await db.query('INSERT INTO ci_coherent_answers VALUES($1,$2,$3::jsonb)',
        [uid(14),'f',JSON.stringify({opinione_94:'f'})]);
      // One Lombardy user alone does not qualify as a large second region.
      let result=await snapshot(db,'opinione_94');
      assert.deepEqual(result.publication.visibleRegions,[]);
      for(let i=15;i<=23;i++){
        await db.query('INSERT INTO ci_coherent_users VALUES($1,$2,true,$3)',
          [uid(i),'P','LO']);
        await db.query('INSERT INTO ci_coherent_answers VALUES($1,$2,$3::jsonb)',
          [uid(i),'f',JSON.stringify({opinione_94:'f'})]);
      }
      result=await snapshot(db,'opinione_94');
      assert.deepEqual(result.publication.visibleRegions,[]);
      assert.equal(result.publication.publishNational,false);
      assert.equal(result.publication.suppressedForDifferencing,true);
      assert.ok(result.publication.suppressedRegions.includes('LA'));
    });
    await t.test('unmapped regional answers invalidate public snapshot',async()=>{
      await db.query('INSERT INTO ci_coherent_users VALUES($1,$2,true,$3)',
        [uid(24),'P','XX']);
      await db.query('INSERT INTO ci_coherent_answers VALUES($1,$2,$3::jsonb)',
        [uid(24),'f',JSON.stringify({opinione_94:'f'})]);
      await assert.rejects(snapshot(db,'opinione_94'),/Unknown or duplicated region/);
      await db.query('DELETE FROM ci_coherent_answers WHERE user_id=$1',[uid(24)]);
      await db.query('DELETE FROM ci_coherent_users WHERE id=$1',[uid(24)]);
    });
    await t.test('revocation immediately changes coherent snapshot in next statement',async()=>{
      await db.query('BEGIN');
      try{
        await db.query('SELECT id FROM ci_coherent_users WHERE id=$1 FOR UPDATE',[uid(1)]);
        await db.query('UPDATE ci_coherent_users SET political_opinions_consent=false WHERE id=$1',[uid(1)]);
        await db.query('DELETE FROM ci_coherent_answers WHERE user_id=$1',[uid(1)]);
        await db.query('COMMIT');
      }catch(error){await db.query('ROLLBACK');throw error;}
      const result=await snapshot(db,'opinione_0');
      assert.deepEqual(result.national,{
        favorevole:'19',contrario:'1',indeciso:'0'
      });
      assert.equal(result.publication.publishNational,false);
      assert.deepEqual(result.publication.visibleRegions,[]);
      assert.ok(result.publication.suppressedRegions.includes('LA'));
    });
  }finally{
    await drop(db);
    await db.end();
  }
});
