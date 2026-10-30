'use strict';
// Isolated HTTP regression: no real DB, credentials, personal answers or network
// access beyond an ephemeral localhost Express listener.
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const express=require('express');
const {getOpinionsForGrade}=require('../services/opinionCatalog');

test('legacy /api/opinioni/opinioni-list returns stable catalog IDs with one scoped SQL answer projection',async()=>{
  const root=path.resolve(__dirname,'..');
  const authPath=require.resolve(path.join(root,'middleware/auth.js'));
  const routePath=require.resolve(path.join(root,'routes/opinioni/compatibility.js'));
  const originalAuth=require.cache[authPath];
  const originalRoute=require.cache[routePath];
  const queries=[];
  const pool={async query(sql,params) {
    assert.deepEqual(params,['synthetic-catalog-user']);
    queries.push(String(sql));
    const match=[...String(sql).matchAll(/"([a-z][a-z0-9_]*)"/g)].map(x=>x[1]);
    const row=Object.fromEntries(match.map(id=>[id,null]));
    // The answer column is keyed by stable catalog ID, never display text.
    if(match.length)row[match[0]]='f';
    return {rows:[row]};
  }};
  let server;
  try {
    require.cache[authPath]={id:authPath,filename:authPath,loaded:true,
      exports:{pool,verifyToken:(req,res,next)=>{
        if(req.headers.authorization!=='Bearer synthetic-test')return res.sendStatus(401);
        req.userId='synthetic-catalog-user';next();
      }}};
    delete require.cache[routePath];
    const app=express();
    app.use('/api/opinioni',require(routePath));
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();
    const origin='http://127.0.0.1:'+address.port;
    assert.equal((await fetch(origin+'/api/opinioni/opinioni-list?grado=N')).status,401);
    for(const grade of ['N','R','CO','E']){
      const before=queries.length;
      const response=await fetch(origin+'/api/opinioni/opinioni-list?grado='+grade,{
        headers:{authorization:'Bearer synthetic-test'}
      });
      assert.equal(response.status,200);
      const body=await response.json();
      const expected=getOpinionsForGrade(grade);
      assert.equal(body.total,expected.length);
      assert.deepEqual(new Set(body.data.map(x=>x.id)),
        new Set(expected.map(x=>x.id)));
      assert.deepEqual(body.data.map(x=>x.id).sort(),expected.map(x=>x.id).sort());
      assert.equal(queries.length,before+1,'exactly one SQL SELECT of personal answers');
      assert.doesNotMatch(queries.at(-1),/opinioni_domande|SELECT\s+\*/i);
      assert.match(queries.at(-1),/FROM opinioni_risposte WHERE user_id = \$1/);
      const columns=[...queries.at(-1).matchAll(/"([a-z][a-z0-9_]*)"/g)]
        .map(m=>m[1]).sort();
      assert.deepEqual(columns,expected.map(x=>x.id).sort(),
        'query only the answers for the requested electoral grade');
      const answered=body.data.filter(x=>x.userAnswer==='f');
      assert.equal(answered.length,1);
      const firstColumn=queries.at(-1).match(/"([a-z][a-z0-9_]*)"/)?.[1];
      assert.equal(answered[0].id,firstColumn,
        'the saved answer must use the SQL/canonical ID rather than text slug');
    }
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    if(originalAuth)require.cache[authPath]=originalAuth;
    else delete require.cache[authPath];
    if(originalRoute)require.cache[routePath]=originalRoute;
    else delete require.cache[routePath];
  }
});
