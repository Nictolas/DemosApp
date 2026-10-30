'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const {Pool} = require('pg');
const {getAllOpinions, getOpinionsForGrade} = require('../services/opinionCatalog');
const {checkOpinionCatalogParity}=require('../scripts/checkOpinionCatalogParity');

// This test MUST NOT connect to a personal account, staging or production.
// The database is a disposable PostgreSQL service started inside GitHub Actions.
const url = process.env.OPINION_TEST_DATABASE_URL;
const enabled = Boolean(url);
if(enabled) {
  const parsed=new URL(url);
  if(parsed.hostname!=='127.0.0.1' || parsed.pathname!=='/demos_opinion_ci')
    throw new Error('Refusing to test against any non-local or non-disposable database');
}

test('real PostgreSQL: Android Opinions N/R/CO/E save, readback and concurrent revocation', {skip:!enabled,timeout:30000}, async()=>{
  const root=path.resolve(__dirname,'..');
  const authPath=require.resolve(path.join(root,'middleware/auth.js'));
  const jwtPath=require.resolve(path.join(root,'utils/jwt.js'));
  const compatibilityPath=require.resolve(path.join(root,'routes/compatibility.js'));
  const answersPath=require.resolve(path.join(root,'routes/opinioni/user-answers.js'));
  const originals=new Map([authPath,jwtPath,compatibilityPath,answersPath].map(p=>[p,require.cache[p]]));
  const userId='synthetic-pg-android-user';
  const database=new Pool({connectionString:url,max:5,connectionTimeoutMillis:5000});
  const opinionIds=getAllOpinions().map(x=>x.id);
  let server;
  let holdConsentCheck=null;
  try{
    assert.equal(opinionIds.length,94);
    assert.ok(opinionIds.every(id=>/^[a-z][a-z0-9_]{0,62}$/.test(id)));
    await database.query('CREATE TABLE users (id TEXT PRIMARY KEY, status TEXT NOT NULL, ruolo TEXT, political_opinions_consent BOOLEAN)');
    await database.query('CREATE TABLE user_consents (user_id TEXT PRIMARY KEY, political_opinions_consent BOOLEAN)');
    await database.query('CREATE TABLE opinioni_risposte (user_id TEXT PRIMARY KEY, '+
      opinionIds.map(id=>'"'+id+'" TEXT').join(', ')+')');
    await database.query('INSERT INTO users (id,status,ruolo,political_opinions_consent) VALUES ($1,$2,$3,$4)',
      [userId,'a','E',true]);

    // Exercise schema-only preflight against actual ephemeral PostgreSQL 17.
    assert.deepEqual(await checkOpinionCatalogParity(database,{schemaOnly:true}),
      {published:94,checkedColumns:94,mode:'schema-only'});
    const observedSql=[];
    const guardedPool={
      query: async(sql,values=[])=>{
        if(String(sql).includes('information_schema.columns')) throw Error('Save must not query schema metadata');
        observedSql.push(String(sql));
        const data=await database.query(sql,values);
        if(holdConsentCheck && String(sql).includes('AS granted') && !String(sql).includes('FOR UPDATE OF u')){
          const latch=holdConsentCheck;holdConsentCheck=null;
          latch.notify();
          await latch.release;
        }
        return data;
      },
      connect:()=>database.connect()
    };
    require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{
      pool:guardedPool,
      verifyToken:(req,res,next)=>{
        if(req.headers.authorization!=='Bearer synthetic-ci-token')return res.status(401).json({success:false});
        req.userId=userId;req.user={id:userId,isPolitician:false,isCandidate:false};req.userRole='E';next();
      },
      requireAdmin:(_req,_res,next)=>next()
    }};
    require.cache[jwtPath]={id:jwtPath,filename:jwtPath,loaded:true,exports:{
      verifyAccessToken:token=>{
        if(token!=='synthetic-ci-token')throw Error('Invalid synthetic JWT');
        return {userId};
      }
    }};
    delete require.cache[compatibilityPath];
    delete require.cache[answersPath];
    const app=express();app.use(express.json());
    app.use('/api',require(compatibilityPath));
    app.use('/api/opinioni',require(answersPath));
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const auth={authorization:'Bearer synthetic-ci-token'};
    // Keep the local test transport separate from the browser's mocked fetch.
    const localFetch=globalThis.fetch.bind(globalThis);
    const apiGet=async(grade)=>{
      const before=observedSql.length;
      const response=await localFetch(base+'/api/opinioni-list?grado='+grade,{headers:auth});
      assert.equal(response.status,200,'GET '+grade);
      const statements=observedSql.slice(before);
      assert.equal(statements.length,1,'GET must perform exactly one DB request');
      assert.match(statements[0],/LEFT JOIN LATERAL/);
      assert.match(statements[0],/FROM opinioni_risposte a/);
      assert.doesNotMatch(statements[0],/fonti_opinioni|SELECT \*/i);
      const selectedColumns=[...statements[0].matchAll(/a\."([a-z0-9_]+)"/g)].map(x=>x[1]).sort();
      assert.deepEqual(selectedColumns,getOpinionsForGrade(grade).map(op=>op.id).sort(),
        'GET must select only the answer columns published at this grade');
      return response.json();
    };
    assert.equal((await fetch(base+'/api/opinioni-list?grado=N')).status,401);
    const chosen={};
    for(const grade of ['N','R','CO','E']){
      const payload=await apiGet(grade);
      assert.equal(payload.data.length,getOpinionsForGrade(grade).length);
      assert.ok(payload.data.length>0);
      assert.ok(payload.data.every(row=>row.userAnswer===null));
      chosen[payload.data[0].id]='f';
    }
    // Also preserve 401 for inactive accounts with an existing answers row.
    await database.query("UPDATE users SET status='x' WHERE id=$1",[userId]);
    const inactive=await localFetch(base+'/api/opinioni-list?grado=N',{headers:auth});
    assert.equal(inactive.status,401);
    await database.query("UPDATE users SET status='a' WHERE id=$1",[userId]);
    const answers=Object.keys(chosen);
    assert.ok(answers.length>=2);
    const post=()=>fetch(base+'/api/opinioni/salva',{
      method:'POST',headers:{...auth,'content-type':'application/json'},
      body:JSON.stringify({opinioni:chosen})
    });
    const deniedUnknown=await localFetch(base+'/api/opinioni/salva',{
      method:'POST',headers:{...auth,'content-type':'application/json'},
      body:JSON.stringify({opinioni:{nonexistent_opinion_qa:'f'}})
    });
    assert.equal(deniedUnknown.status,400);
    const saved=await post();
    const result=await saved.json();
    assert.equal(saved.status,200);
    assert.equal(result.savedCount,answers.length);
    assert.equal(result.errorCount,0);
    for(const grade of ['N','R','CO','E']){
      const payload=await apiGet(grade);
      for(const [id,answer] of Object.entries(chosen)){
        const row=payload.data.find(q=>q.id===id);
        if(row)assert.equal(row.userAnswer,answer);
      }
    }

    // Run the actual frontend save/readback implementation against the
    // candidate Express routes and disposable PostgreSQL, not an HTTP
    // implementation re-created in this test.
    const clientRoot=path.resolve(__dirname,'../../client');
    const {build}=require(require.resolve('esbuild', {paths:[path.join(clientRoot,'node_modules/vite'),clientRoot]}));
    const compiled=await build({
      entryPoints:[path.join(clientRoot,'src/lib/saveAndVerifyOpinions.ts')],
      tsconfig:path.join(clientRoot,'tsconfig.json'),
      bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'
    });
    assert.equal(compiled.outputFiles.length,1);
    const Module=require('node:module');
    const clientModule=new Module(path.join(clientRoot,'__synthetic_opinions_client.cjs'),module);
    clientModule.filename=path.join(clientRoot,'__synthetic_opinions_client.cjs');
    clientModule.paths=module.paths;
    clientModule._compile(compiled.outputFiles[0].text,clientModule.filename);
    const {saveAndVerifyOpinions}=clientModule.exports;
    assert.equal(typeof saveAndVerifyOpinions,'function');
    const priorWindow=globalThis.window;
    const priorStorage=globalThis.localStorage;
    const actualFetch=globalThis.fetch;
    let frontendRequests=0;
    const store=new Map([['auth_token','synthetic-ci-token']]);
    try {
      globalThis.window={location:{hostname:'synthetic-ci.invalid'}};
      globalThis.localStorage={getItem:k=>store.get(k)||null};
      globalThis.fetch=async(input,options)=>{
        const target=new URL(String(input));
        if(target.origin!=='https://api.demos.community' ||
           !target.pathname.startsWith('/api/opinioni')){
          throw new Error('Blocked non-synthetic browser request: '+target.origin+target.pathname);
        }
        frontendRequests++;
        return actualFetch(base+target.pathname+target.search,options);
      };
      const national=chosen[ (await apiGet('N')).data[0].id ]!==undefined
        ? (await apiGet('N')).data[0].id
        : (await apiGet('N')).data.find(x=>Object.hasOwn(chosen,x.id)).id;
      assert.ok(national);
      await saveAndVerifyOpinions('N',{[national]:'c'});
      assert.equal((await apiGet('N')).data.find(x=>x.id===national).userAnswer,'c');
      assert.equal(frontendRequests,1,
        'ACK-only client must submit exactly one POST without reading personal answers again');

      // The server's COMMIT has already been verified independently via
      // apiGet above. An incomplete/false server ACK must be rejected without
      // allowing another personal answer GET or mutating the actual server.
      const previousAnswer=(await apiGet('N')).data.find(x=>x.id===national).userAnswer;
      const normalBrowserFetch=globalThis.fetch;
      globalThis.fetch=async(input,options)=>{
        const target=new URL(String(input));
        if(target.pathname==='/api/opinioni/salva'){
          frontendRequests++;
          return new Response(JSON.stringify({
            success:true,savedCount:0,errorCount:0
          }),{status:200,headers:{'content-type':'application/json'}});
        }
        return normalBrowserFetch(input,options);
      };
      await assert.rejects(
        saveAndVerifyOpinions('N',{[national]:'i'}),
        /server non ha confermato/
      );
      globalThis.fetch=normalBrowserFetch;
      assert.equal((await apiGet('N')).data.find(x=>x.id===national).userAnswer,previousAnswer);
    }finally{
      globalThis.fetch=actualFetch;
      if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;
      if(priorStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=priorStorage;
    }

    // Simulate a concurrent revoke after the first read but before the
    // writer acquires a lock. The real PostgreSQL row lock must reject it.
    await database.query('DELETE FROM opinioni_risposte WHERE user_id=$1',[userId]);
    let notify,unblock;
    const seen=new Promise(resolve=>{notify=resolve});
    const release=new Promise(resolve=>{unblock=resolve});
    holdConsentCheck={notify,release};
    const pendingWrite=post();
    try{
      await Promise.race([
        seen,
        new Promise((_,reject)=>setTimeout(()=>reject(Error('Did not reach consent precheck')),7000))
      ]);
      const revoke=await database.connect();
      try{
        await revoke.query('BEGIN');
        await revoke.query('UPDATE users SET political_opinions_consent=false WHERE id=$1',[userId]);
        await revoke.query('DELETE FROM opinioni_risposte WHERE user_id=$1',[userId]);
        await revoke.query('COMMIT');
      }catch(error){await revoke.query('ROLLBACK');throw error}
      finally{revoke.release();}
    }finally{unblock();}
    const after=await pendingWrite;
    const denied=await after.json();
    assert.equal(after.status,403);
    assert.equal(denied.consent_required,true);
    const persisted=await database.query('SELECT count(*)::int AS n FROM opinioni_risposte WHERE user_id=$1',[userId]);
    assert.equal(persisted.rows[0].n,0);
  }finally{
    if(holdConsentCheck)holdConsentCheck.release?.();
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const [p,old] of originals){if(old)require.cache[p]=old;else delete require.cache[p];}
    await database.end();
  }
});
