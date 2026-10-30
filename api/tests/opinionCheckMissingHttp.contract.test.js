'use strict';
// Actual HTTP contract of the mounted check-missing router, with a synthetic
// identity and answer pool. No JWT secrets, Supabase, Render or personal data.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const express=require('express');

test('personal check-missing GETs never permit HTTP caching and reject invalid requests before SQL',async()=>{
  const root=path.resolve(__dirname,'..');
  const authPath=require.resolve(path.join(root,'middleware/auth.js'));
  const routePath=require.resolve(path.join(root,'routes/opinioni/check-missing.js'));
  const originals=new Map([authPath,routePath].map(p=>[p,require.cache[p]]));
  const calls=[];
  let failDb=false;
  const pool={async query(sql,params){
    calls.push({sql:String(sql),params});
    if(failDb)throw new Error('SYNTHETIC_PRIVATE_SQL_DETAIL');
    assert.match(String(sql),/FROM opinioni_risposte/);
    assert.doesNotMatch(String(sql),/information_schema|opinioni_domande|SELECT\s+\*/i);
    assert.deepEqual(params,['synthetic-opinions-user']);
    return {rows:[]};
  }};
  const verifyToken=(req,res,next)=>{
    if(req.headers.authorization!=='Bearer synthetic-token'){
      return res.status(401).json({success:false,error:'Token richiesto'});
    }
    req.user={id:'synthetic-opinions-user'};
    next();
  };
  let server;
  try {
    require.cache[authPath]={
      id:authPath,filename:authPath,loaded:true,exports:{pool,verifyToken}
    };
    delete require.cache[routePath];
    const app=express();
    app.use('/api/opinioni',require(routePath));
    server=await new Promise(resolve=>{
      const s=app.listen(0,'127.0.0.1',()=>resolve(s));
    });
    const base='http://127.0.0.1:'+server.address().port;
    const checked=async(endpoint,token=true)=>{
      const response=await fetch(base+endpoint,token?{
        headers:{authorization:'Bearer synthetic-token'}
      }:{});
      assert.equal(response.headers.get('cache-control'),
        'private, no-store, max-age=0',
        'Personal completion response must never be persisted by HTTP caches');
      return {status:response.status,body:await response.json()};
    };
    const unauth=await checked('/api/opinioni/check-missing-all',false);
    assert.equal(unauth.status,401);
    assert.equal(calls.length,0,'401 must never touch personal SQL');

    const invalid=await checked('/api/opinioni/check-missing/UNKNOWN');
    assert.equal(invalid.status,400);
    assert.equal(calls.length,0,'Invalid grade must never touch personal SQL');

    const province=await checked('/api/opinioni/check-missing/C');
    assert.equal(province.status,200);
    assert.equal(province.body.success,true);
    assert.equal(province.body.data.grado,'C');
    assert.ok(province.body.data.opinioniMancanti>0);
    assert.equal(calls.length,1,'One personal SELECT; no schema read');

    const all=await checked('/api/opinioni/check-missing-all');
    assert.equal(all.status,200);
    assert.equal(all.body.success,true);
    assert.ok(Object.hasOwn(all.body.data.byGrado,'N'));
    assert.ok(Object.hasOwn(all.body.data.byGrado,'R'));
    assert.ok(Object.hasOwn(all.body.data.byGrado,'CO'));
    assert.equal(calls.length,5,'Four grade SELECTs plus prior provincial SELECT');

    failDb=true;
    const broken=await checked('/api/opinioni/check-missing/C');
    assert.equal(broken.status,500,'DB failures must not invent a completion percentage');
    assert.equal(broken.body.success,false);
    assert.doesNotMatch(JSON.stringify(broken.body),/SYNTHETIC_PRIVATE_SQL_DETAIL|42703/);
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const [p,cached] of originals){
      if(cached)require.cache[p]=cached;
      else delete require.cache[p];
    }
  }
});
