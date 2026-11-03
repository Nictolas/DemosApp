'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {buildHybridAtomicAdminUpsert}=
  require('../experiments/opinionAnswersV2HybridAdminCandidate');

const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri && process.env.GITHUB_ACTIONS==='true');
const userId=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const published=new Set(['opinione_0','opinione_1','opinione_94','opinione_95']);
const historicalIds=['opinione_0','opinione_1'];
const TABLE='ci_hybrid_admin_opinions';
function refuseNonCi(){
  const p=new URL(uri);
  if(process.env.GITHUB_ACTIONS!=='true'||
      !['localhost','127.0.0.1','::1'].includes(p.hostname)||
      p.pathname!=='/opinion_answers_ci'){
    throw Error('Refusing PostgreSQL outside disposable CI');
  }
}
function statement(subject,answerPatch,sourcePatch){
  const q=buildHybridAtomicAdminUpsert({
    userId:subject,answerPatch,sourcePatch,publishedIds:published,historicalIds
  });
  if(!q)return null;
  return {
    text:q.sql.replaceAll('opinioni_risposte',TABLE),
    values:q.params
  };
}
async function read(db,subject){
  const r=await db.query('SELECT * FROM '+TABLE+' WHERE user_id=$1',[subject]);
  return r.rows[0]||null;
}
test('PG17 atomic hybrid ADMIN source+answer patch under concurrent writers',
  {skip:!enabled},async t=>{
    refuseNonCi();
    const a=new Client({connectionString:uri,connectionTimeoutMillis:5000});
    const b=new Client({connectionString:uri,connectionTimeoutMillis:5000});
    await a.connect();await b.connect();
    try{
      await a.query('DROP TABLE IF EXISTS '+TABLE);
      await a.query(
        'CREATE TABLE '+TABLE+' ('+
        'user_id uuid PRIMARY KEY,"opinione_0" text,"opinione_1" text,'+
        "answers_extra jsonb DEFAULT '{}'::jsonb,"+
        "fonti_opinioni jsonb NOT NULL DEFAULT '{}'::jsonb)"
      );

      await t.test('first-time POST persists old+future answers and both sources atomically',async()=>{
        const r=await a.query(statement(userId(1),
          {opinione_0:'f',opinione_94:'c'},
          {opinione_0:'source-old',opinione_94:'source-future'}
        ));
        assert.equal(r.rowCount,1);
        const data=await read(a,userId(1));
        assert.equal(data.opinione_0,'f');
        assert.deepEqual(data.answers_extra,{opinione_94:'c'});
        assert.deepEqual(data.fonti_opinioni,{
          opinione_0:'source-old',opinione_94:'source-future'
        });
      });

      await t.test('two overlapping updates to DIFFERENT source IDs preserve both values',async()=>{
        await Promise.all([
          a.query(statement(userId(1),{opinione_1:'i'},{
            opinione_1:'second-old-source'
          })),
          b.query(statement(userId(1),{opinione_95:'f'},{
            opinione_95:'second-future-source'
          }))
        ]);
        const data=await read(a,userId(1));
        assert.equal(data.opinione_0,'f');
        assert.equal(data.opinione_1,'i');
        assert.deepEqual(data.answers_extra,{
          opinione_94:'c',opinione_95:'f'
        });
        assert.deepEqual(data.fonti_opinioni,{
          opinione_0:'source-old',opinione_94:'source-future',
          opinione_1:'second-old-source',opinione_95:'second-future-source'
        });
      });

      await t.test('one removal and an overlapping source insert do not clobber unrelated keys',async()=>{
        await Promise.all([
          a.query(statement(userId(1),undefined,{opinione_0:null})),
          b.query(statement(userId(1),undefined,{opinione_94:'updated-future-source'}))
        ]);
        const data=await read(a,userId(1));
        assert.deepEqual(data.fonti_opinioni,{
          opinione_94:'updated-future-source',
          opinione_1:'second-old-source',opinione_95:'second-future-source'
        });
        assert.equal(data.opinione_0,'f');
        assert.equal(data.opinione_1,'i');
        assert.equal(data.answers_extra.opinione_94,'c');
      });

      await t.test('unmentioned archived source survives active opinion changes',async()=>{
        await a.query(
          'UPDATE '+TABLE+" SET fonti_opinioni=fonti_opinioni || $2::jsonb WHERE user_id=$1",
          [userId(1),JSON.stringify({opinione_archived:'archive unchanged'})]
        );
        await a.query(statement(userId(1),{opinione_0:'c'},{
          opinione_1:'source now changed'
        }));
        const data=await read(a,userId(1));
        assert.equal(data.opinione_0,'c');
        assert.equal(data.fonti_opinioni.opinione_archived,'archive unchanged');
        assert.equal(data.fonti_opinioni.opinione_1,'source now changed');
      });

      await t.test('source removal with no existing row does not insert an empty record',async()=>{
        const result=await a.query(statement(userId(2),undefined,{
          opinione_0:null,opinione_95:''
        }));
        assert.equal(result.rowCount,0);
        assert.equal(await read(a,userId(2)),null);
      });

      await t.test('source-only addition creates exactly one row, future answers remain unset',async()=>{
        const result=await a.query(statement(userId(2),undefined,{
          opinione_94:'one legal reference'
        }));
        assert.equal(result.rowCount,1);
        const data=await read(a,userId(2));
        assert.equal(data.opinione_0,null);
        assert.deepEqual(data.answers_extra,{});
        assert.deepEqual(data.fonti_opinioni,{opinione_94:'one legal reference'});
      });

      await t.test('transaction rollback on a later ledger failure undoes both answer and source changes',async()=>{
        const before=await read(a,userId(1));
        await a.query('BEGIN');
        try{
          await a.query(statement(userId(1),{opinione_0:'i',opinione_95:'i'},{
            opinione_94:null,opinione_1:'should rollback'
          }));
          await assert.rejects(a.query('SELECT 1/0'),/division by zero/);
          await a.query('ROLLBACK');
        }catch(error){await a.query('ROLLBACK');throw error;}
        assert.deepEqual(await read(a,userId(1)),before);
      });
    }finally{
      await a.query('DROP TABLE IF EXISTS '+TABLE).catch(()=>{});
      await a.end();await b.end();
    }
  }
);
