'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Client}=require('pg');
const manifest=require('../experiments/opinionAnswersV2HistoricalManifest.json');
const {
  assertLegacySchemaInventory
}=require('../experiments/opinionAnswersV2BackfillCandidate');
const {
  buildHybridAtomicAnswerUpsert,formatHybridLegacyGradePayload
}=require('../experiments/opinionAnswersV2HybridCandidate');
const {buildHybridAtomicAdminUpsert}=
  require('../experiments/opinionAnswersV2HybridAdminCandidate');
const {planNonDestructiveHybridRollback}=
  require('../experiments/opinionAnswersV2RollbackCandidate');

const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri&&process.env.GITHUB_ACTIONS==='true');
const SCHEMA='ci_hybrid_additive_rollback';
const UID='00000000-0000-4000-8000-000000000073';
const OTHER='00000000-0000-4000-8000-000000000074';
const history=manifest.historicalIds;
const first=history[0],last=history.at(-1),future='opinione_95_synthetic';
const published=new Set([...history,future]);
const migration=fs.readFileSync(path.join(__dirname,
  '../experiments/opinionAnswersV2AddOnlyColumn.sql'),'utf8');
const ddl=migration.split('\n')
  .filter(line=>!line.trim().startsWith('--')).join('\n').trim();
function disposable(){
  const u=new URL(uri);
  if(process.env.GITHUB_ACTIONS!=='true'||
      !['localhost','127.0.0.1','::1'].includes(u.hostname)||
      u.pathname!=='/opinion_answers_ci'){
    throw Error('Refusing a non-disposable database');
  }
}
const oldFields=[first,last];
async function row(db,id){
  return (await db.query('SELECT * FROM opinioni_risposte WHERE user_id=$1',[id]))
    .rows[0]||null;
}

test('add-only migration SQL is single nullable JSONB column with no data rewrite',()=>{
  assert.match(ddl,/^ALTER TABLE public\.opinioni_risposte\s+ADD COLUMN IF NOT EXISTS answers_extra jsonb;$/i);
  assert.equal(ddl.split(';').filter(x=>x.trim()).length,1);
  assert.doesNotMatch(ddl,/\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT|COPY|RENAME)\b/i);
  assert.doesNotMatch(ddl,/\b(NOT NULL|DEFAULT)\b/i);
});
test('application rollback plan never drops or overwrites future political answers',()=>{
  const flags={
    activePublishedIds:history,
    ingressPaused:true,
    inFlightWritesDrained:true,
    cacheInvalidationConfirmed:true,
    externalGdprRestoreGateConfirmed:true
  };
  const good=planNonDestructiveHybridRollback(flags);
  assert.equal(good.mechanicallyCompatible,true);
  assert.equal(good.rollbackAuthorized,false);
  assert.deepEqual(good.rollbackDatabaseStatements,[]);
  assert.equal(good.preserveColumn,'answers_extra');
  assert.equal(good.historicalColumnsRetained,94);
  for(const removed of [
    'ingressPaused','inFlightWritesDrained','cacheInvalidationConfirmed',
    'externalGdprRestoreGateConfirmed'
  ]){
    const report=planNonDestructiveHybridRollback({...flags,[removed]:false});
    assert.equal(report.mechanicallyCompatible,false,removed);
    assert.equal(report.rollbackAuthorized,false);
  }
  const liveFuture=planNonDestructiveHybridRollback({
    ...flags,activePublishedIds:[...history,future]
  });
  assert.equal(liveFuture.mechanicallyCompatible,false);
  assert.equal(liveFuture.futureActiveCount,1);
  assert.ok(liveFuture.blockers.includes(
    'FUTURE_OPINIONS_MUST_BE_UNPUBLISHED_BEFORE_OLD_API'
  ));
  const invalid=planNonDestructiveHybridRollback({
    ...flags,historicalIds:history.slice(0,-1)
  });
  assert.equal(invalid.mechanicallyCompatible,false);
  assert.ok(invalid.blockers.includes('HISTORICAL_94_COLUMN_MANIFEST_CHANGED'));
});

test('PG17: 94 original TEXT answers survive migration, app rollback and reactivation',
  {skip:!enabled},async t=>{
  disposable();
  const db=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  await db.connect();
  try{
    await db.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE');
    await db.query('CREATE SCHEMA '+SCHEMA);
    await db.query('SET search_path TO '+SCHEMA+',public');
    const columns=history.map(id=>'"'+id+'" text').join(',');
    await db.query('CREATE TABLE opinioni_risposte('+
      'user_id uuid PRIMARY KEY,'+columns+','+
      "fonti_opinioni jsonb NOT NULL DEFAULT '{}'::jsonb)"
    );
    await db.query('INSERT INTO opinioni_risposte'+
      '(user_id,"'+first+'","'+last+'",fonti_opinioni) '+
      'VALUES($1,$2,$3,$4::jsonb)',
      [UID,'f','c',JSON.stringify({[first]:'legacy-source',
        archived_original:'archived-evidence'})]
    );
    await db.query('INSERT INTO opinioni_risposte'+
      '(user_id,"'+first+'") VALUES($1,$2)',[OTHER,'i']);
    const original=await row(db,UID);
    const otherOriginal=await row(db,OTHER);

    await t.test('idempotent add-only SQL adds nullable JSONB without changing existing rows',async()=>{
      const sql=ddl.replace('public.opinioni_risposte',
        SCHEMA+'.opinioni_risposte');
      await db.query('BEGIN');
      try{
        await db.query("SET LOCAL lock_timeout = '2s'");
        await db.query(sql);
        await db.query('COMMIT');
      }catch(e){await db.query('ROLLBACK');throw e;}
      await db.query(sql);
      const firstAfter=await row(db,UID);
      const secondAfter=await row(db,OTHER);
      assert.deepEqual({...firstAfter,answers_extra:undefined},
        {...original,answers_extra:undefined});
      assert.deepEqual({...secondAfter,answers_extra:undefined},
        {...otherOriginal,answers_extra:undefined});
      assert.equal(firstAfter.answers_extra,null);
      assert.equal(secondAfter.answers_extra,null);
      const cols=await db.query(
        'SELECT column_name,data_type FROM information_schema.columns '+
        'WHERE table_schema=$1 AND table_name=$2',
        [SCHEMA,'opinioni_risposte']
      );
      const checked=assertLegacySchemaInventory(history,cols.rows);
      assert.equal(checked.coveredIds,94);
      assert.equal(cols.rows.filter(x=>x.column_name==='answers_extra').length,1);
    });

    await t.test('mixed future + old answer writes keep 94 columns and sources in same row',async()=>{
      const q=buildHybridAtomicAnswerUpsert({
        [first]:'c',[future]:'f'
      },published,history,UID);
      const saved=await db.query(q.sql,q.params);
      assert.equal(saved.rowCount,1);
      const after=await row(db,UID);
      assert.equal(after[first],'c');
      assert.equal(after[last],'c');
      assert.deepEqual(after.answers_extra,{[future]:'f'});
      assert.equal(after.fonti_opinioni[first],'legacy-source');
      assert.equal(after.fonti_opinioni.archived_original,'archived-evidence');

      const source=buildHybridAtomicAdminUpsert({
        userId:UID,publishedIds:published,historicalIds:history,
        sourcePatch:{[future]:'future-evidence'}
      });
      await db.query(source.sql,source.params);
      const withSource=await row(db,UID);
      assert.equal(withSource.fonti_opinioni[future],'future-evidence');
      assert.equal(withSource.fonti_opinioni.archived_original,'archived-evidence');
    });

    await t.test('old-code-only fallback still writes historic answer, never erases future document',async()=>{
      const rollback=planNonDestructiveHybridRollback({
        activePublishedIds:history,
        ingressPaused:true,inFlightWritesDrained:true,
        cacheInvalidationConfirmed:true,
        externalGdprRestoreGateConfirmed:true
      });
      assert.equal(rollback.mechanicallyCompatible,true);
      // Simulated OLD backend SQL contains no answers_extra reference.
      const legacySelect=await db.query(
        'SELECT "'+first+'","'+last+'" FROM opinioni_risposte WHERE user_id=$1',
        [UID]
      );
      assert.deepEqual(legacySelect.rows,[{[first]:'c',[last]:'c'}]);
      await db.query('UPDATE opinioni_risposte SET "'+first+
        '"=$2 WHERE user_id=$1',[UID,'i']);
      const after=await row(db,UID);
      assert.equal(after[first],'i');
      assert.equal(after[last],'c');
      assert.deepEqual(after.answers_extra,{[future]:'f'});
      assert.equal(after.fonti_opinioni[future],'future-evidence');
      assert.equal(after.fonti_opinioni.archived_original,'archived-evidence');
      const oldCatalog=history.map((id,index)=>({
        id,text:'Legacy question '+index,gradi_opinione:['N']
      }));
      const legacyPayload=formatHybridLegacyGradePayload(
        after,oldCatalog,history,'N'
      );
      assert.equal(legacyPayload.total,94);
      assert.equal(JSON.stringify(legacyPayload).includes(future),false);
      assert.equal(legacyPayload.data[0].userAnswer,'i');
    });

    await t.test('reactivation re-exposes retained future answer without modifying any row',async()=>{
      const before=await row(db,UID);
      const resumed=formatHybridLegacyGradePayload(
        before,[
          {id:first,text:'Historic question',gradi_opinione:['N']},
          {id:future,text:'Future question',gradi_opinione:['N']}
        ],history,'N'
      );
      assert.deepEqual(resumed.data.map(x=>x.userAnswer),['i','f']);
      assert.deepEqual(await row(db,UID),before);
    });

    await t.test('revoke deletes whole row including overflow/sources, no stale future answers',async()=>{
      const gone=await db.query(
        'DELETE FROM opinioni_risposte WHERE user_id=$1',[UID]
      );
      assert.equal(gone.rowCount,1);
      assert.equal(await row(db,UID),null);
      const other=await row(db,OTHER);
      assert.equal(other[first],'i');
      assert.equal(other.answers_extra,null);
    });
  }finally{
    await db.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE').catch(()=>{});
    await db.end();
  }
});
