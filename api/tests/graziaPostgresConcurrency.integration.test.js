'use strict';
// Disposable PostgreSQL 17 integration test. It refuses non-local or non-synthetic DB URLs.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');

test('Grazia production router: real PostgreSQL transactions enforce one pending per account and review',async t=>{
  const raw=process.env.CIVIC_TEST_DATABASE_URL;
  if(!raw){t.skip('CIVIC_TEST_DATABASE_URL not provided; never connect to production');return;}
  const dest=new URL(raw);
  if(dest.hostname!=='127.0.0.1'||dest.port!=='5432'||dest.pathname!=='/demos_civic_ci'||
     process.env.CIVIC_TEST_MODE!=='isolated-synthetic'){
    throw Error('Unsafe PostgreSQL target: only 127.0.0.1:5432/demos_civic_ci is permitted');
  }
  const {Pool}=require('pg');
  const express=require('express');
  const pool=new Pool({connectionString:raw,max:18,connectionTimeoutMillis:8000});
  const A='11111111-1111-4111-8111-111111111111';
  const B='22222222-2222-4222-8222-222222222222';
  const ADMIN='33333333-3333-4333-8333-333333333333';
  let server;
  try {
    const setup=[
      "CREATE TABLE users(id uuid PRIMARY KEY,is_admin boolean NOT NULL DEFAULT false,status varchar(1) NOT NULL DEFAULT 'a')",
      "CREATE TABLE richieste_grazia(id varchar(255) PRIMARY KEY,utente_id varchar(255) NOT NULL,nome text NOT NULL,url_prova text,status varchar(50),data_creazione timestamptz NOT NULL DEFAULT now(),note text)",
      "CREATE TABLE grazia_carcerati(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nome text NOT NULL,attivo boolean NOT NULL DEFAULT true)",
      "CREATE UNIQUE INDEX grazia_carcerati_nome_key ON grazia_carcerati(lower(btrim(nome)))",
      "CREATE TABLE voti_grazia(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),userid uuid,nome text,timestamp timestamptz)",
      "CREATE TABLE notifiche_demos(id uuid PRIMARY KEY,id_utente uuid,titolo text,testo text,data_creazione timestamptz,data date)",
      "INSERT INTO users(id,is_admin,status) VALUES ('"+A+"',false,'a'),('"+B+"',false,'a'),('"+ADMIN+"',true,'a')",
      "INSERT INTO grazia_carcerati(nome,attivo) VALUES ('Persona sintetica già approvata',true)"
    ];
    for(const sql of setup)await pool.query(sql);
    const dbPath=require.resolve('../config/database');
    const authPath=require.resolve('../middleware/auth');
    const midPolitical=require.resolve('../middleware/politicalConsent');
    const midCivic=require.resolve('../middleware/civicIdentity');
    const midValidation=require.resolve('../middleware/validation');
    const midCooldown=require.resolve('../services/preferenceCooldownService');
    require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{getPool:()=>pool}};
    const verifyToken=(req,res,next)=>{
      const identity=req.headers.authorization;
      const id=identity==='Bearer a'?A:identity==='Bearer b'?B:identity==='Bearer admin'?ADMIN:null;
      if(!id)return res.status(401).json({success:false});
      req.user={id,isAdmin:id===ADMIN};req.userId=id;next();
    };
    const requireAdmin=(req,res,next)=>req.user?.isAdmin?next():res.status(403).json({success:false});
    const pass=(_req,_res,next)=>next();
    require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{verifyToken,requireAdmin,pool}};
    require.cache[midPolitical]={id:midPolitical,filename:midPolitical,loaded:true,exports:{requirePoliticalConsent:pass}};
    require.cache[midCivic]={id:midCivic,filename:midCivic,loaded:true,exports:{requireVerifiedCivicIdentity:pass}};
    require.cache[midValidation]={id:midValidation,filename:midValidation,loaded:true,exports:{validateInput:()=>pass}};
    require.cache[midCooldown]={id:midCooldown,filename:midCooldown,loaded:true,exports:{
      getPreferenceCooldown:async()=>({isBlocked:false,unlockDate:null}),
      assertPreferenceChangeAllowed:async()=>{},
      recordPreferenceChange:async()=>{},
      sendCooldownError:()=>false
    }};
    const app=express();app.use(express.json());app.use('/api/grazia',require('../routes/grazia'));
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const req=async(url,as,method='GET',body)=>{
      const response=await fetch(base+url,{method,headers:{
        ...(as?{authorization:'Bearer '+as}:{}),'content-type':'application/json'},
        body:body?JSON.stringify(body):undefined});
      return {status:response.status,json:await response.json()};
    };
    const fixture={nome:'Persona sintetica da approvare',urlProva:'https://example.org/fonte/pubblica'};
    const submissions=await Promise.all(
      Array.from({length:12},()=>req('/api/grazia','a','POST',fixture))
    );
    assert.equal(submissions.filter(x=>x.status===202).length,1,'exactly one simultaneous proposal accepted');
    assert.equal(submissions.filter(x=>x.status===409).length,11,'remaining concurrent submissions denied');
    const accepted=submissions.find(x=>x.status===202);
    const id=accepted.json.richiesta.id;
    const actualPending=await pool.query("SELECT COUNT(*)::integer AS n FROM richieste_grazia WHERE utente_id=$1 AND status='pending'",[A]);
    assert.equal(actualPending.rows[0].n,1);
    const notices=await pool.query('SELECT id_utente,titolo,testo FROM notifiche_demos');
    assert.equal(notices.rows.length,1,'a single admin notification after commit');
    assert.equal(notices.rows[0].id_utente,ADMIN);
    assert.ok(!notices.rows[0].testo.includes(fixture.nome),'no third-party name in notification preview');

    assert.equal((await req('/api/grazia/richieste','a')).status,403);
    const queue=await req('/api/grazia/richieste','admin');
    assert.equal(queue.status,200);
    assert.equal(queue.json.length,1);
    assert.equal(queue.json[0].id,id);
    assert.equal((await req('/api/grazia/mia-proposta','b')).json.richiesta,null);
    const own=await req('/api/grazia/mia-proposta','a');
    assert.equal(own.json.richiesta.status,'pending');

    const noContent=await req('/api/grazia');
    assert.equal(noContent.status,200);
    assert.equal(noContent.json.classifica.some(x=>x.nome===fixture.nome),false,'pending not public');

    const approved=await req('/api/grazia/richiesta/'+id+'/accetta','admin','POST');
    assert.equal(approved.status,200,JSON.stringify(approved.json));
    assert.equal(approved.json.status,'approved');
    assert.equal((await req('/api/grazia/richiesta/'+id+'/accetta','admin','POST')).status,409);
    const existing=await pool.query('SELECT COUNT(*)::integer AS n FROM grazia_carcerati WHERE nome=$1 AND attivo=true',[fixture.nome]);
    assert.equal(existing.rows[0].n,1);
    const resultNotice=await pool.query("SELECT COUNT(*)::integer AS n FROM notifiche_demos WHERE id_utente=$1",[A]);
    assert.equal(resultNotice.rows[0].n,1,'decision notification belongs only to proposer');
    const published=await req('/api/grazia');
    assert.equal(published.json.classifica.some(x=>x.nome===fixture.nome),true);
    assert.deepEqual(published.json.richieste,[],'raw personal voting rows not returned');

    const rejectedBody={nome:'Persona sintetica non ammessa',urlProva:'https://example.org/fonte/rifiuto'};
    const submitted=await req('/api/grazia','a','POST',rejectedBody);
    assert.equal(submitted.status,202,'moderated account may propose again after decision');
    const rejected=await req('/api/grazia/richiesta/'+submitted.json.richiesta.id+'/rifiuta','admin','POST');
    assert.equal(rejected.status,200);
    const banned=await pool.query('SELECT COUNT(*)::integer AS n FROM grazia_carcerati WHERE nome=$1',[rejectedBody.nome]);
    assert.equal(banned.rows[0].n,0,'rejection never writes to public catalog');
  } finally {
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
