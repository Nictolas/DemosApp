'use strict';
// Isolated PostgreSQL 16 + real #525/#494/#552 HTTP handlers. No production services.
// Query-level ownership test: this does NOT attest production RLS.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const {Pool}=require('pg');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const ADMIN='33333333-3333-4333-8333-333333333333';

test('real PostgreSQL HTTP: inbox writer retry and two-user private feed/latest isolation',async t=>{
  if(process.env.CI!=='true'||!process.env.DEMOS_TEST_DATABASE_URL){
    t.skip('Disposable CI PostgreSQL required');return;
  }
  const u=new URL(process.env.DEMOS_TEST_DATABASE_URL);
  for(const [key,want] of Object.entries({protocol:'postgresql:',hostname:'127.0.0.1',port:'5432',pathname:'/demos_ci_notifiche',username:'demos_ci'})){
    assert.equal(u[key],want,'Not permitted to connect outside disposable CI database');
  }
  const db=new Pool({connectionString:u.toString(),max:6,connectionTimeoutMillis:3000});
  const cache=[];
  let server;
  try{
    const r=await db.query("SELECT to_regclass('public.notifiche_demos') AS notices, to_regclass('public.users') AS users");
    assert.equal(r.rows[0].notices,null,'CI must start with a fresh notices table');
    assert.equal(r.rows[0].users,null,'CI must start with a fresh users table');
    await db.query('CREATE TABLE public.users (id UUID PRIMARY KEY, email TEXT, nome TEXT, cognome TEXT, status TEXT, comune_residenza TEXT, rappresentante_camera UUID, rappresentante_senato UUID, rappresentante_comune UUID)');
    await db.query('CREATE TABLE public.notifiche_demos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), id_utente UUID, titolo TEXT NOT NULL, testo TEXT NOT NULL, data DATE, data_creazione TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    await db.query('INSERT INTO users (id,email,nome,cognome,status) VALUES ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10),($11,$12,$13,$14,$15)',[
      A,'a@example.invalid','A','Test','A',B,'b@example.invalid','B','Test','A',ADMIN,'admin@example.invalid','Admin','Test','A'
    ]);
    const migration=fs.readFileSync(path.join(__dirname,'../../sql/manual/20261101_notifications_inbox_idempotency.sql'),'utf8');
    await db.query(migration);
    await db.query('INSERT INTO notifiche_demos (id_utente,titolo,testo,data_creazione) VALUES (NULL,$1,$2,$3),($4,$5,$6,$7),($8,$9,$10,$11)',[
      'Public synthetic','Visible to both','2000-01-01T10:00:00Z',
      A,'A confidential','A_ONLY_SECRET','2000-01-01T11:00:00Z',
      B,'B confidential','B_ONLY_SECRET','2000-01-01T12:00:00Z'
    ]);
    // Pass the real PostgreSQL pool to the actual handler queries for users
    // and notices. Other notification streams are absent in this tiny CI fixture.
    const shim={
      async query(statement,values=[]){
        const sql=String(statement);
        if(/\b(?:FROM|INTO)\s+(?:public\.)?users\b/i.test(sql)||
           /\b(?:FROM|INTO)\s+(?:public\.)?notifiche_demos\b/i.test(sql)||
           (sql.includes('information_schema.columns')&&sql.includes("table_name = 'notifiche_demos'"))){
          return db.query(statement,values);
        }
        if(sql.includes('notifiche_avvistamenti')&&sql.includes('information_schema.tables'))return {rows:[{exists:false}]};
        return {rows:[]};
      }
    };
    const mock=(name,exports)=>{
      const id=require.resolve(name);cache.push([id,require.cache[id]]);
      require.cache[id]={id,filename:id,loaded:true,exports};
    };
    mock('../config/database',{getPool:()=>shim});
    mock('../middleware/auth',{
      verifyToken:(req,res,next)=>{
        const token=req.headers.authorization;
        const id=token==='Bearer synthetic-a'?A:token==='Bearer synthetic-b'?B:token==='Bearer synthetic-admin'?ADMIN:null;
        if(!id)return res.status(401).json({success:false,error:'Unauthenticated'});
        req.user={id,isAdmin:id===ADMIN,role:id===ADMIN?'AD':'U'};req.userId=id;next();
      },
      requireAdmin:(req,res,next)=>req.user?.isAdmin?next():res.sendStatus(403)
    });
    mock('../services/accountCapabilitiesService',{getAccountSubject:()=>({})});
    mock('../services/currentSupporterPushService',{sendPushToCurrentSupporters:async()=>({})});
    mock('../services/politicalJurisdictionRegistryService',{resolvePoliticalOffice:()=>null});
    mock('../services/firebaseAdmin',{getFirebaseAdmin:()=>null});
    const app=express();app.use(express.json());
    app.use('/api/comunicazioni',require('../routes/comunicazioni'));
    app.use('/api/notifiche',require('../routes/notifiche'));
    server=app.listen(0,'127.0.0.1');
    if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const call=async(uri,user,method='GET',body)=>{
      const response=await fetch(base+uri,{
        method,headers:{...(user?{authorization:'Bearer synthetic-'+user}:{}),...(body?{'content-type':'application/json'}:{})},
        body:body?JSON.stringify(body):undefined
      });
      const bodyText=await response.text();
      let result;
      try{result=JSON.parse(bodyText);}catch{result=bodyText;}
      return {status:response.status,data:result};
    };
    assert.equal((await call('/api/notifiche',null)).status,401);
    assert.equal((await call('/api/notifiche/ultima',null)).status,401);
    assert.equal((await call('/api/comunicazioni/send-user-notification','a','POST',{
      userId:B,titolo:'Rejected',idempotencyKey:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    })).status,403);
    for(const actor of ['a','b']){
      const feed=await call('/api/notifiche',actor);
      assert.equal(feed.status,200);
      const messages=(feed.data.notifiche||[]).map(x=>x.messaggio);
      assert.ok(messages.includes('Visible to both'));
      assert.ok(messages.includes(actor==='a'?'A_ONLY_SECRET':'B_ONLY_SECRET'));
      assert.ok(!messages.includes(actor==='a'?'B_ONLY_SECRET':'A_ONLY_SECRET'));
      const latest=await call('/api/notifiche/ultima',actor);
      assert.equal(latest.status,200);
      assert.equal(latest.data.data.messaggio,actor==='a'?'A_ONLY_SECRET':'B_ONLY_SECRET');
    }
    const key='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const payload={userId:A,titolo:'New private notice',messaggio:'A_NEW_SECRET',idempotencyKey:key};
    const sent=await call('/api/comunicazioni/send-user-notification','admin','POST',payload);
    assert.equal(sent.status,200);
    assert.equal(sent.data.data.inbox_salvata,true);
    assert.equal(sent.data.data.push_inviato,false);
    const retry=await call('/api/comunicazioni/send-user-notification','admin','POST',payload);
    assert.equal(retry.status,200);
    assert.equal(retry.data.data.duplicata_evitata,true);
    assert.equal(retry.data.data.push_non_ritentato,true);
    const other=await call('/api/comunicazioni/send-user-notification','admin','POST',{...payload,userId:B,messaggio:'B_FORGED_MESSAGE'});
    assert.equal(other.status,409);
    const count=await db.query('SELECT COUNT(*)::integer AS n FROM notifiche_demos WHERE idempotency_key=$1::uuid',[key]);
    assert.equal(count.rows[0].n,1);
    const a=await call('/api/notifiche','a'),b=await call('/api/notifiche','b');
    assert.equal(a.status,200);assert.equal(b.status,200);
    assert.ok(JSON.stringify(a.data).includes('A_NEW_SECRET'));
    assert.ok(!JSON.stringify(b.data).includes('A_NEW_SECRET'));
    assert.ok(!JSON.stringify(b.data).includes('B_FORGED_MESSAGE'));
    const lastA=await call('/api/notifiche/ultima','a');
    const lastB=await call('/api/notifiche/ultima','b');
    assert.equal(lastA.status,200);assert.equal(lastB.status,200);
    assert.equal(lastA.data.data.messaggio,'A_NEW_SECRET');
    assert.equal(lastB.data.data.messaggio,'B_ONLY_SECRET');
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const [name,previous] of cache.reverse())if(previous)require.cache[name]=previous;else delete require.cache[name];
    await db.query('DROP TABLE IF EXISTS public.notifiche_demos').catch(()=>{});
    await db.query('DROP TABLE IF EXISTS public.users').catch(()=>{});
    await db.end();
  }
});
