'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {
  LOCK_SUBJECT_SQL,executeAuthorizedHybridAdminMutation
}=require('../experiments/opinionAnswersV2AuthorizedWriteCandidate');

const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri&&process.env.GITHUB_ACTIONS==='true');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const SCHEMA='ci_v2_authorized_write';
const publishedIds=new Set(['opinione_0','opinione_94']);
const historicalIds=['opinione_0'];
const principalId=id(90);
function guard(){
  const url=new URL(uri);
  if(process.env.GITHUB_ACTIONS!=='true'||
    !['localhost','127.0.0.1','::1'].includes(url.hostname)||
    url.pathname!=='/opinion_answers_ci'){
    throw Error('Only disposable PostgreSQL 17 CI is permitted');
  }
}
function callback(client,principal){
  // Real implementation MUST verify the actor's admin role INSIDE the
  // authorized transaction and lock the role for its duration.
  return client.query(
    'SELECT role FROM users WHERE id=$1::uuid FOR SHARE',[principal]
  ).then(result=>result.rows.length===1 && result.rows[0].role==='ADMIN');
}
function args(client,subject,answerPatch,sourcePatch={}){
  return {
    client,userId:subject,principalId,answerPatch,sourcePatch,
    publishedIds,historicalIds,
    assertRestoreReady:async()=>true,
    assertActorAuthorized:callback
  };
}
async function stored(db,subject){
  return (await db.query('SELECT * FROM opinioni_risposte WHERE user_id=$1',[subject]))
    .rows[0]||null;
}
test('PostgreSQL: locked hybrid writer cannot resurrect revoked opinions',
  {skip:!enabled},async t=>{
    guard();
    const a=new Client({connectionString:uri,connectionTimeoutMillis:5000});
    const b=new Client({connectionString:uri,connectionTimeoutMillis:5000});
    await a.connect();await b.connect();
    try{
      await a.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE');
      await a.query('CREATE SCHEMA '+SCHEMA);
      for(const db of [a,b]){
        await db.query('SET search_path TO '+SCHEMA+',public');
      }
      await a.query('CREATE TABLE users ('+
        'id uuid PRIMARY KEY, role text NOT NULL,'+
        'political_opinions_consent boolean NOT NULL)');
      await a.query('CREATE TABLE user_consents ('+
        'user_id uuid PRIMARY KEY REFERENCES users(id),'+
        'political_opinions_consent boolean)');
      await a.query('CREATE TABLE opinioni_risposte ('+
        'user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,'+
        '"opinione_0" text,'+
        "answers_extra jsonb NOT NULL DEFAULT '{}'::jsonb,"+
        "fonti_opinioni jsonb NOT NULL DEFAULT '{}'::jsonb)");
      await a.query('INSERT INTO users VALUES ($1,$2,true)',
        [principalId,'ADMIN']);
      for(let n=1;n<=3;n++){
        await a.query('INSERT INTO users VALUES($1,$2,$3)',[
          id(n),'PERSON',n!==2
        ]);
        await a.query('INSERT INTO user_consents VALUES($1,true)',[id(n)]);
      }

      await t.test('one transaction creates historical/new answer and source after fresh consent',async()=>{
        const result=await executeAuthorizedHybridAdminMutation(args(
          a,id(1),{opinione_0:'f',opinione_94:'c'},
          {opinione_94:'legal explanation'}
        ));
        assert.deepEqual(result,{saved:true,answerCount:2,sourceCount:1});
        const row=await stored(a,id(1));
        assert.equal(row.opinione_0,'f');
        assert.deepEqual(row.answers_extra,{opinione_94:'c'});
        assert.deepEqual(row.fonti_opinioni,{opinione_94:'legal explanation'});
      });

      await t.test('explicit deny beats base grant: no answer or source UPDATE',async()=>{
        await a.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1',[id(1)]);
        const before=await stored(a,id(1));
        await assert.rejects(
          executeAuthorizedHybridAdminMutation(args(
            a,id(1),{opinione_0:'c',opinione_94:'f'},
            {opinione_94:'must not be written'}
          )),
          error=>error.code==='POLITICAL_CONSENT_REQUIRED'
        );
        assert.deepEqual(await stored(a,id(1)),before);
      });

      await t.test('explicit grant beats base false when role is authorized',async()=>{
        const result=await executeAuthorizedHybridAdminMutation(args(
          a,id(2),{opinione_94:'i'},{}
        ));
        assert.equal(result.saved,true);
        const row=await stored(a,id(2));
        assert.equal(row.opinione_0,null);
        assert.deepEqual(row.answers_extra,{opinione_94:'i'});
      });

      await t.test('admin role revocation makes all writes fail before subject lock',async()=>{
        await b.query("UPDATE users SET role='READER' WHERE id=$1",[principalId]);
        const before=await stored(a,id(2));
        await assert.rejects(
          executeAuthorizedHybridAdminMutation(args(
            a,id(2),{opinione_94:'f'},{}
          )),
          error=>error.code==='ADMIN_NOT_AUTHORIZED'
        );
        assert.deepEqual(await stored(a,id(2)),before);
        await b.query("UPDATE users SET role='ADMIN' WHERE id=$1",[principalId]);
      });

      await t.test('revocation wins FOR UPDATE race, post-lock consent rejects late writer',async()=>{
        // Seed an old answer before the revoker takes the subject lock.
        await a.query(
          'INSERT INTO opinioni_risposte(user_id,"opinione_0",answers_extra) '+
          "VALUES($1,'f',$2::jsonb) ON CONFLICT(user_id) DO UPDATE "+
          'SET "opinione_0"=EXCLUDED."opinione_0",answers_extra=EXCLUDED.answers_extra',
          [id(3),JSON.stringify({opinione_94:'c'})]
        );
        await b.query('BEGIN');
        await b.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[id(3)]);
        await b.query('UPDATE users SET political_opinions_consent=false WHERE id=$1',[id(3)]);
        await b.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1',[id(3)]);
        await b.query('DELETE FROM opinioni_risposte WHERE user_id=$1',[id(3)]);

        let signal;
        const attemptedLock=new Promise(resolve=>{signal=resolve;});
        const intercepted={
          query:(sql,params)=>{
            if(sql===LOCK_SUBJECT_SQL)signal();
            return a.query(sql,params);
          }
        };
        // B holds the subject row while A attempts to lock it. A cannot
        // read consent in a stale locking statement: a SECOND statement
        // after B commits must observe false and block any UPSERT.
        const attemptedWrite=executeAuthorizedHybridAdminMutation(args(
          intercepted,id(3),{opinione_0:'c',opinione_94:'f'},
          {opinione_94:'must not resurrect'}
        ));
        await attemptedLock;
        await b.query('COMMIT');
        await assert.rejects(attemptedWrite,
          error=>error.code==='POLITICAL_CONSENT_REQUIRED');
        assert.equal(await stored(a,id(3)),null);
      });

      await t.test('new consent after deletion starts from empty history, no resurrection',async()=>{
        await b.query('UPDATE users SET political_opinions_consent=true WHERE id=$1',[id(3)]);
        await b.query('UPDATE user_consents SET political_opinions_consent=true WHERE user_id=$1',[id(3)]);
        assert.equal(await stored(a,id(3)),null);
        const out=await executeAuthorizedHybridAdminMutation(args(
          a,id(3),{opinione_94:'i'},{}
        ));
        assert.equal(out.saved,true);
        const record=await stored(a,id(3));
        assert.equal(record.opinione_0,null);
        assert.deepEqual(record.answers_extra,{opinione_94:'i'});
        assert.deepEqual(record.fonti_opinioni,{});
      });
    }finally{
      await a.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE').catch(()=>{});
      await a.end();await b.end();
    }
  }
);
