'use strict';
// Disposable PostgreSQL 17 integration test. It refuses non-local or non-synthetic DB URLs.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

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
    // Only the disposable test catalogue: no production schema operations.
    const draft=fs.readFileSync(
      path.join(__dirname,'../migrations/20261104_grazia_withdrawal_audit.sql'),'utf8');
    await pool.query(draft);
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
    assert.deepEqual(Object.keys(queue.json[0]).sort(), ['createdAt','id','nome','urlProva'].sort(),
      'Admin moderation queue must not return the proposal owner identifier');
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

    // A vote that passed the preliminary check must not get through if the
    // Admin deactivates the catalogue before the transactional FOR SHARE lock.
    const raceName='Persona sintetica ritirata durante il voto';
    await pool.query('INSERT INTO grazia_carcerati(nome,attivo) VALUES($1,true)',[raceName]);
    const catalogueLock=await pool.connect();
    const originalQuery=pool.query.bind(pool);
    let preliminaryChecked;
    const reachedPreliminary=new Promise(resolve=>{preliminaryChecked=resolve;});
    let raceResult;
    try {
      await catalogueLock.query('BEGIN');
      await catalogueLock.query('SELECT id FROM grazia_carcerati WHERE nome=$1 FOR UPDATE',[raceName]);
      pool.query=async function(sql,params,...rest){
        const result=await originalQuery(sql,params,...rest);
        if(typeof sql==='string' &&
          sql.includes('SELECT id FROM grazia_carcerati WHERE attivo = true AND LOWER(BTRIM(nome))') &&
          params?.[0]===raceName) preliminaryChecked();
        return result;
      };
      const pendingVote=req('/api/grazia/vota','b','POST',{voti:[raceName]});
      await Promise.race([
        reachedPreliminary,
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('Voting preliminary check never reached')),5000))
      ]);
      await catalogueLock.query('UPDATE grazia_carcerati SET attivo=false WHERE nome=$1',[raceName]);
      await catalogueLock.query('COMMIT');
      raceResult=await pendingVote;
    } finally {
      pool.query=originalQuery;
      await catalogueLock.query('ROLLBACK').catch(()=>{});
      catalogueLock.release();
    }
    assert.equal(raceResult.status,422,
      'a withdrawn candidate cannot receive a vote after a stale preliminary check');
    const lateVotes=await pool.query('SELECT count(*)::integer n FROM voti_grazia WHERE userid=$1 AND nome=$2',
      [B,raceName]);
    assert.equal(lateVotes.rows[0].n,0,'no late vote is inserted for the withdrawn candidate');

    // Withdrawal is owned by this original request, never subject_proposals.
    assert.equal((await req('/api/grazia/approvate','a')).status,403);
    assert.equal((await req('/api/grazia/ritiri-avvisi','b')).status,403);
    const approvedList=await req('/api/grazia/approvate','admin');
    assert.equal(approvedList.status,200);
    assert.equal(approvedList.json.richieste.some(x=>x.id===id),true);
    assert.deepEqual(Object.keys(approvedList.json.richieste.find(x=>x.id===id)).sort(),
      ['createdAt','id','nome'].sort(),'Admin listing must not include proposer UUID or source URL');
    await pool.query("INSERT INTO voti_grazia(userid,nome) VALUES($1,$2)",[A,fixture.nome]);
    const withdrawAttempts=await Promise.all(Array.from({length:3},()=>req(
      '/api/grazia/richiesta/'+id+'/ritira','admin','POST',{note:'Ritiro cautelativo sintetico'}
    )));
    assert.equal(withdrawAttempts.filter(x=>x.status===200).length,1,
      'concurrent withdrawal commits only once');
    assert.equal(withdrawAttempts.filter(x=>x.status===409).length,2,
      'subsequent withdrawals must not replace audit');
    assert.equal(withdrawAttempts.find(x=>x.status===200).json.notification_sent,true);
    const afterWithdraw=await pool.query(
      'SELECT status,withdrawn_at,withdrawn_by,withdraw_note,withdraw_notification_sent FROM richieste_grazia WHERE id=$1',[id]);
    assert.equal(afterWithdraw.rows[0].status,'approved',
      'existing Grazia status is preserved; derived personal state is withdrawn');
    assert.ok(afterWithdraw.rows[0].withdrawn_at);
    assert.equal(afterWithdraw.rows[0].withdrawn_by,ADMIN);
    assert.equal(afterWithdraw.rows[0].withdraw_note,'Ritiro cautelativo sintetico');
    assert.equal(afterWithdraw.rows[0].withdraw_notification_sent,true);
    assert.equal((await req('/api/grazia/mia-proposta','a')).json.richiesta.status,'withdrawn');
    assert.equal((await pool.query('SELECT attivo FROM grazia_carcerati WHERE nome=$1',[fixture.nome])).rows[0].attivo,false);
    assert.equal((await req('/api/grazia')).json.classifica.some(x=>x.nome===fixture.nome),false,
      'inactive catalogues cannot show in public ranking');
    assert.equal((await pool.query('SELECT COUNT(*)::integer n FROM voti_grazia WHERE nome=$1',
      [fixture.nome])).rows[0].n,1,'historic Grazia vote retained');
    assert.equal((await req('/api/grazia','b','POST',fixture)).status,409,
      'retired name may not be proposed by a second account');
    assert.equal((await req('/api/grazia/richiesta/'+id+'/accetta','admin','POST')).status,409,
      'no reactivation through the original approval route');
    const auditNone=await req('/api/grazia/ritiri-avvisi','admin');
    assert.deepEqual(auditNone.json.ritiri,[],'successful private notice has no pending recovery');

    // Dedicated failure path: an unavailable inbox cannot reverse unpublication.
    const second={nome:'Persona Grazia con avviso non disponibile',urlProva:'https://example.org/fonte/seconda'};
    const incoming=await req('/api/grazia','b','POST',second);
    assert.equal(incoming.status,202);
    const secondId=incoming.json.richiesta.id;
    assert.equal((await req('/api/grazia/richiesta/'+secondId+'/accetta','admin','POST')).status,200);
    await pool.query("CREATE FUNCTION reject_grazia_withdraw_notice() RETURNS trigger LANGUAGE plpgsql AS $t$ BEGIN IF NEW.titolo = 'DEMOS — Ritiro proposta Grazia' THEN RAISE EXCEPTION 'synthetic inbox outage'; END IF; RETURN NEW; END $t$");
    await pool.query('CREATE TRIGGER reject_grazia_withdraw_notice BEFORE INSERT ON notifiche_demos FOR EACH ROW EXECUTE FUNCTION reject_grazia_withdraw_notice()');
    const failure=await req('/api/grazia/richiesta/'+secondId+'/ritira','admin','POST',
      {note:'Ritiro urgente senza avviso'});
    assert.equal(failure.status,200);
    assert.equal(failure.json.notification_sent,false);
    assert.equal((await pool.query('SELECT attivo FROM grazia_carcerati WHERE nome=$1',[second.nome])).rows[0].attivo,false);
    const pendingNotice=await req('/api/grazia/ritiri-avvisi','admin');
    const item=pendingNotice.json.ritiri.find(x=>x.id===secondId);
    assert.ok(item,'Admin can review a failed notice on the original Grazia queue');
    assert.deepEqual(Object.keys(item).sort(),['id','withdrawn_at']);
    await pool.query('DROP TRIGGER reject_grazia_withdraw_notice ON notifiche_demos');
    await pool.query('DROP FUNCTION reject_grazia_withdraw_notice()');

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
