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
  // Only the disposable localhost PG17 target above can reach this point.
  // Synthetic CI must opt in explicitly, just like any deployment.
  const previousNominationFlag=process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED;
  const previousGraziaFlag=process.env.DEMOS_GRAZIA_NOMINATIONS_ENABLED;
  process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED='true';
  process.env.DEMOS_GRAZIA_NOMINATIONS_ENABLED='true';
  const {Pool}=require('pg');
  const express=require('express');
  const pool=new Pool({connectionString:raw,max:18,connectionTimeoutMillis:8000});
  const A='11111111-1111-4111-8111-111111111111';
  const B='22222222-2222-4222-8222-222222222222';
  const ADMIN='33333333-3333-4333-8333-333333333333';
  const C='44444444-4444-4444-8444-444444444444';
  const D='55555555-5555-4555-8555-555555555555';
  // The public GET decodes an optional JWT. The isolated PG17 CI job
  // intentionally does not install jsonwebtoken, so intercept only that
  // require from this router with a synthetic verifier (never real secrets).
  const Module=require('node:module');
  const originalModuleLoad=Module._load;
  const graziaFilename=require.resolve('../routes/grazia');
  Module._load=function(request,parent,isMain){
    if(request==='jsonwebtoken' && parent?.filename===graziaFilename){
      return {verify:token=>{
        if(token==='a')return {userId:A};
        if(token==='b')return {userId:B};
        throw Error('SYNTHETIC_INVALID_TOKEN');
      }};
    }
    return originalModuleLoad.call(this,request,parent,isMain);
  };
  let server;
  try {
    const setup=[
      "CREATE TABLE users(id uuid PRIMARY KEY,is_admin boolean NOT NULL DEFAULT false,status varchar(1) NOT NULL DEFAULT 'a')",
      "CREATE TABLE richieste_grazia(id varchar(255) PRIMARY KEY,utente_id varchar(255) NOT NULL,nome text NOT NULL,url_prova text,status varchar(50),data_creazione timestamptz NOT NULL DEFAULT now(),note text)",
      "CREATE TABLE grazia_carcerati(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nome text NOT NULL,attivo boolean NOT NULL DEFAULT true)",
      "CREATE UNIQUE INDEX grazia_carcerati_nome_key ON grazia_carcerati(lower(btrim(nome)))",
      "CREATE TABLE voti_grazia(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),userid uuid,nome text,timestamp timestamptz)",
      "CREATE TABLE preference_change_cooldowns(user_id uuid NOT NULL,scope text NOT NULL,last_changed_at timestamptz NOT NULL,PRIMARY KEY(user_id,scope))",
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
      const id=identity==='Bearer a'?A:identity==='Bearer b'?B:
        identity==='Bearer c'?C:identity==='Bearer d'?D:
        identity==='Bearer admin'?ADMIN:null;
      if(!id)return res.status(401).json({success:false});
      req.user={id,isAdmin:id===ADMIN};req.userId=id;next();
    };
    const requireAdmin=(req,res,next)=>req.user?.isAdmin?next():res.status(403).json({success:false});
    const pass=(_req,_res,next)=>next();
    require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{verifyToken,requireAdmin,pool}};
    require.cache[midPolitical]={id:midPolitical,filename:midPolitical,loaded:true,exports:{requirePoliticalConsent:pass}};
    require.cache[midCivic]={id:midCivic,filename:midCivic,loaded:true,exports:{requireVerifiedCivicIdentity:pass}};
    require.cache[midValidation]={id:midValidation,filename:midValidation,loaded:true,exports:{validateInput:()=>pass}};
    // Most legacy scenarios use the existing synthetic stub. For account D,
    // call the real cooldown service against disposable PG17 to verify that
    // two concurrent POSTs cannot both pass a stale 24-hour check.
    const genuineCooldown=require('../services/preferenceCooldownService');
    require.cache[midCooldown]={id:midCooldown,filename:midCooldown,loaded:true,exports:{
      getPreferenceCooldown:(db,options)=>options?.userId===D
        ? genuineCooldown.getPreferenceCooldown(db,options)
        : Promise.resolve({isBlocked:false,unlockDate:null}),
      assertPreferenceChangeAllowed:(db,options)=>options?.userId===D
        ? genuineCooldown.assertPreferenceChangeAllowed(db,options)
        : Promise.resolve(),
      recordPreferenceChange:(db,options)=>options?.userId===D
        ? genuineCooldown.recordPreferenceChange(db,options)
        : Promise.resolve(),
      sendCooldownError:genuineCooldown.sendCooldownError
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

    // Read-efficiency regression on actual PostgreSQL 17. The public feed is
    // unchanged, but two authenticated GETs should share the same metadata
    // probe and return the cooldown fallback in the vote query itself.
    const voteFixture='Voto personale sintetico non pubblicato';
    await pool.query('INSERT INTO voti_grazia(userid,nome,timestamp) VALUES($1,$2,$3)',
      [A,voteFixture,'2026-11-05T12:34:56Z']);
    const seenSQL=[];
    const trackedQuery=pool.query.bind(pool);
    pool.query=async function(sql,params,...rest){
      if(typeof sql==='string')seenSQL.push(sql);
      return trackedQuery(sql,params,...rest);
    };
    try{
      const first=await req('/api/grazia','a');
      const second=await req('/api/grazia','a');
      assert.equal(first.status,200);
      assert.equal(second.status,200);
      assert.deepEqual(first.json.mieiVoti,[voteFixture]);
      assert.deepEqual(second.json.mieiVoti,[voteFixture]);
      assert.equal(first.json.richieste.length,0);
      const anonymous=await req('/api/grazia');
      assert.deepEqual(anonymous.json.mieiVoti,[]);
      assert.equal(seenSQL.filter(sql=>sql.includes('FROM information_schema.columns')).length,1,
        'one column lookup per worker, not per authenticated GET');
      assert.equal(seenSQL.filter(sql=>sql.includes('FROM voti_grazia') &&
        sql.includes('MAX(timestamp) OVER ()')).length,2,
        'one personal vote query per authenticated GET with cooldown fallback');
      assert.equal(seenSQL.filter(sql=>sql.includes('SELECT MAX(timestamp)')).length,0,
        'no second timestamp aggregate query');
    }finally{
      pool.query=trackedQuery;
      await pool.query('DELETE FROM voti_grazia WHERE userid=$1 AND nome=$2',[A,voteFixture]);
    }

    // The vote checks an approved catalogue row inside its transaction.
    // Hold the Admin withdrawal row lock, then prove its FOR SHARE check is
    // genuinely waiting in disposable PostgreSQL before deactivating the row.
    const raceName='Persona sintetica ritirata durante il voto';
    await pool.query('INSERT INTO grazia_carcerati(nome,attivo) VALUES($1,true)',[raceName]);
    const catalogueLock=await pool.connect();
    let raceResult;
    try {
      await catalogueLock.query('BEGIN');
      await catalogueLock.query('SELECT id FROM grazia_carcerati WHERE nome=$1 FOR UPDATE',[raceName]);
      const pendingVote=req('/api/grazia/vota','b','POST',{voti:[raceName]});
      let waitingForAdmin=false;
      for(let attempt=0;attempt<150;attempt++){
        const waiters=await pool.query(
          `SELECT EXISTS (
             SELECT 1 FROM pg_stat_activity
             WHERE datname=current_database()
               AND state='active'
               AND wait_event_type='Lock'
               AND query LIKE '%FROM grazia_carcerati%'
               AND query LIKE '%FOR SHARE%'
           ) AS blocked`
        );
        if(waiters.rows[0].blocked){waitingForAdmin=true;break;}
        await new Promise(resolve=>setTimeout(resolve,30));
      }
      assert.equal(waitingForAdmin,true,'voting FOR SHARE must wait on Admin withdrawal');
      await catalogueLock.query('UPDATE grazia_carcerati SET attivo=false WHERE nome=$1',[raceName]);
      await catalogueLock.query('COMMIT');
      raceResult=await pendingVote;
    } finally {
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

    // INSERT ... SELECT is a valid zero-row write when the intended recipient
    // no longer has an active account. Never report notification_sent=true.
    const noRecipientFixture={nome:'Persona sintetica senza Admin attivo',urlProva:'https://example.org/fonte/senza-admin'};
    let noAdmin;
    await pool.query("UPDATE users SET status='x' WHERE id=$1",[ADMIN]);
    try {
      noAdmin=await req('/api/grazia','a','POST',noRecipientFixture);
    }finally{
      await pool.query("UPDATE users SET status='a' WHERE id=$1",[ADMIN]);
    }
    assert.equal(noAdmin.status,202,'proposal must commit independently of Admin availability');
    assert.equal(noAdmin.json.notification_sent,false,'zero active Admin rows means no inbox entry');
    const pendingWithoutAdmin=await pool.query(
      "SELECT id FROM richieste_grazia WHERE nome=$1 AND status='pending'",
      [noRecipientFixture.nome]
    );
    assert.equal(pendingWithoutAdmin.rows.length,1,'proposal persists without Admin notification');
    let noProposer;
    await pool.query("UPDATE users SET status='x' WHERE id=$1",[A]);
    try {
      noProposer=await req('/api/grazia/richiesta/'+noAdmin.json.richiesta.id+'/rifiuta','admin','POST');
    }finally{
      await pool.query("UPDATE users SET status='a' WHERE id=$1",[A]);
    }
    assert.equal(noProposer.status,200,'moderation decision commits if proposer is inactive');
    assert.equal(noProposer.json.status,'rejected');
    assert.equal(noProposer.json.notification_sent,false,'zero active proposer rows means no decision notice');
    const rejectedWithoutProposer=await pool.query(
      "SELECT status FROM richieste_grazia WHERE id=$1",[noAdmin.json.richiesta.id]
    );
    assert.equal(rejectedWithoutProposer.rows[0].status,'rejected');


    // Two distinct accounts racing on the same canonical subject must
    // produce exactly one pending request, never two competing moderators.
    await pool.query('INSERT INTO users(id,is_admin,status) VALUES ($1,false,$3),($2,false,$3)',[C,D,'a']);

    // Real disposable PG17 race: two different approved votes from one
    // account must serialize. Exactly one commits; the loser receives the
    // 24-hour cooldown rather than overwriting the winner. Use the genuine
    // cooldown service only for synthetic account D in this integration test.
    const raceCandidates=['Voto simultaneo sintetico A','Voto simultaneo sintetico B'];
    for(const name of raceCandidates){
      await pool.query('INSERT INTO grazia_carcerati(nome,attivo) VALUES($1,true)',[name]);
    }
    const simultaneousVotes=await Promise.all(raceCandidates.map(name=>
      req('/api/grazia/vota','d','POST',{voti:[name]})
    ));
    assert.deepEqual(simultaneousVotes.map(x=>x.status).sort((x,y)=>x-y),[200,409],
      'only one concurrent vote can pass the real 24-hour cooldown');
    const voteWinner=await pool.query('SELECT nome FROM voti_grazia WHERE userid=$1',[D]);
    assert.equal(voteWinner.rows.length,1,'one durable personal preference');
    assert.ok(raceCandidates.includes(voteWinner.rows[0].nome),
      'the winning preference matches one synthetic request');
    const savedCooldown=await pool.query(
      'SELECT last_changed_at FROM preference_change_cooldowns WHERE user_id=$1 AND scope=$2',
      [D,'grazia:preferenza']
    );
    assert.equal(savedCooldown.rows.length,1,'cooldown recorded exactly once for account D');
    const sameVote=await req('/api/grazia/vota','d','POST',{voti:[voteWinner.rows[0].nome]});
    assert.equal(sameVote.status,200,
      'idempotent resubmission is permitted without modifying the vote');
    const cooldownAfterNoop=await pool.query(
      'SELECT last_changed_at FROM preference_change_cooldowns WHERE user_id=$1 AND scope=$2',
      [D,'grazia:preferenza']
    );
    assert.equal(cooldownAfterNoop.rows[0].last_changed_at.getTime(),
      savedCooldown.rows[0].last_changed_at.getTime(),
      'idempotent POST must not restart the 24-hour cooldown');
    const rejectedClear=await req('/api/grazia/vota','d','POST',{voti:[]});
    assert.equal(rejectedClear.status,409,
      'the same account cannot clear its new vote during the cooldown');
    assert.equal(rejectedClear.json.error,'PREFERENCE_COOLDOWN',
      'the rejected change must have a stable cooldown error code');
    assert.ok(Number.isFinite(Date.parse(rejectedClear.json.unlockDate)),
      'the client receives a parseable unlock date');
    assert.equal(Date.parse(rejectedClear.json.unlockDate),
      savedCooldown.rows[0].last_changed_at.getTime()+24*60*60*1000,
      'the unlock date must match the committed cooldown timestamp');
    const afterRace=await pool.query('SELECT nome FROM voti_grazia WHERE userid=$1',[D]);
    assert.deepEqual(afterRace.rows.map(row=>row.nome),[voteWinner.rows[0].nome],
      'failed parallel request and blocked clear leave the committed vote intact');

    const firstName='Persona sintetica con  doppio spazio';
    const sameName='  Persona sintetica con doppio spazio  ';
    const simultaneous=await Promise.all([
      req('/api/grazia','c','POST',{nome:firstName,urlProva:'https://example.org/fonte/c'}),
      req('/api/grazia','d','POST',{nome:sameName,urlProva:'https://example.org/fonte/d'})
    ]);
    assert.equal(simultaneous.filter(r=>r.status===202).length,1,
      'canonical-equivalent names can create just one pending proposal');
    assert.equal(simultaneous.filter(r=>r.status===409).length,1,
      'other account receives conflict instead of duplicate pending');
    const samePending=await pool.query(
      "SELECT COUNT(*)::integer n FROM richieste_grazia WHERE status='pending' AND lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g')))=$1",
      ['persona sintetica con doppio spazio']
    );
    assert.equal(samePending.rows[0].n,1,'all submissions share the existing Grazia queue');

    // Pre-migration records can already contain two pending names that are
    // equivalent after Unicode/whitespace canonicalization. Their Admin
    // approvals must serialize as strictly as new submissions.
    const oldOne='legacy-canonical-a', oldTwo='legacy-canonical-b';
    await pool.query(
      "INSERT INTO richieste_grazia(id,utente_id,nome,url_prova,status) VALUES($1,$2,$3,$4,'pending'),($5,$6,$7,$8,'pending')",
      [oldOne,A,'Persona legacy con  doppio spazio','https://example.org/legacy/a',
       oldTwo,B,'  Persona legacy con doppio spazio  ','https://example.org/legacy/b']
    );
    const legacyDecision=await Promise.all([
      req('/api/grazia/richiesta/'+oldOne+'/accetta','admin','POST'),
      req('/api/grazia/richiesta/'+oldTwo+'/accetta','admin','POST')
    ]);
    assert.equal(legacyDecision.filter(x=>x.status===200).length,1,
      'only one historical duplicate can become approved');
    assert.equal(legacyDecision.filter(x=>x.status===409).length,1,
      'second historical duplicate must remain pending and not publish again');
    const approvedLegacy=await pool.query(
      "SELECT COUNT(*)::integer n FROM richieste_grazia WHERE id=ANY($1::varchar[]) AND status='approved'",
      [[oldOne,oldTwo]]
    );
    assert.equal(approvedLegacy.rows[0].n,1);
    const legacyCatalogue=await pool.query(
      "SELECT COUNT(*)::integer n FROM grazia_carcerati WHERE attivo=TRUE AND lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g')))=$1",
      ['persona legacy con doppio spazio']
    );
    assert.equal(legacyCatalogue.rows[0].n,1,'no duplicate active catalogue row');

    // Real PG17 keyset regression: the legacy id column is VARCHAR, not UUID.
    // Force >100 records sharing the same microsecond to cross page boundaries,
    // with historical non-UUID IDs as the actual opaque cursors.
    const pageSets=[
      {kind:'pending',status:'pending',count:107,url:'/api/grazia/richieste?paged=1',field:'richieste'},
      {kind:'approved',status:'approved',count:105,url:'/api/grazia/approvate',field:'richieste'},
      {kind:'audit',status:'approved',count:108,url:'/api/grazia/ritiri-avvisi',field:'ritiri'}
    ];
    for(const {kind,status,count,url,field} of pageSets){
      await pool.query(
        `INSERT INTO richieste_grazia
         (id,utente_id,nome,url_prova,status,data_creazione,withdrawn_at,withdraw_notification_sent)
         SELECT 'legacy-grazia-'||$1::text||'-'||lpad(n::text,3,'0'),
                $2::text, 'Persona sintetica '||$1::text||' '||n,
                'https://example.org/fixture', $3::text,
                '2026-11-01 12:03:04.123456+00'::timestamptz,
                CASE WHEN $1='audit' THEN '2026-11-01 12:03:04.123456+00'::timestamptz ELSE NULL END,
                CASE WHEN $1='audit' THEN FALSE ELSE NULL END
         FROM generate_series(1,$4::integer) AS n`,
        [kind,B,status,count]
      );
      assert.equal((await req(url,'a')).status,403,'Admin-only on every paged endpoint');
      assert.equal((await req(url+(url.includes('?')?'&':'?')+'cursor=%2A','admin')).status,400,
        'invalid keyset cursor fails closed');
      const observed=new Set();
      let cursor=null;
      let pages=0;
      do {
        const pageUrl=url+(cursor?(url.includes('?')?'&':'?')+'cursor='+encodeURIComponent(cursor):'');
        const answer=await req(pageUrl,'admin');
        assert.equal(answer.status,200,JSON.stringify(answer.json));
        assert.equal(answer.json.success,true);
        assert.ok(Array.isArray(answer.json[field]));
        assert.ok(answer.json[field].length<=100,'SQL pages remain bounded');
        for(const entry of answer.json[field]){
          assert.equal('cursor_epoch' in entry,false,'cursor precision is private');
          if(kind!=='pending'){
            assert.equal('utente_id' in entry,false);
            assert.equal('urlProva' in entry,false);
          }
          if(entry.id.startsWith('legacy-grazia-'+kind+'-')){
            assert.equal(observed.has(entry.id),false,'no duplicates crossing the keyset boundary');
            observed.add(entry.id);
          }
        }
        cursor=answer.json.next_cursor;
        pages++;
        assert.ok(pages<=5,'pagination must advance without looping forever');
        if(cursor){
          const decoded=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
          assert.match(decoded[0],/\.123456$/,'PostgreSQL microseconds retained in the cursor');
          assert.match(decoded[1],/^[A-Za-z0-9_-]+$/,'legacy varchar ID supported');
        }
      } while(cursor);
      assert.equal(observed.size,count,kind+' all historical IDs must be reachable');
      assert.ok(pages>=2,kind+' pagination must cross the 100-row boundary');
    }
    const legacyPendingArray=await req('/api/grazia/richieste','admin');
    assert.equal(legacyPendingArray.status,200);
    assert.equal(Array.isArray(legacyPendingArray.json),true,'legacy response remains an array');
    assert.equal(legacyPendingArray.json.length,100);
    // Approved historical IDs must be WITHDRAWABLE, not merely visible.
    const historicalId='legacy-grazia-approved-101';
    const historicalName='Persona sintetica approved 101';
    await pool.query('INSERT INTO grazia_carcerati(nome,attivo) VALUES($1,TRUE)',[historicalName]);
    const historicalWithdrawal=await req('/api/grazia/richiesta/'+historicalId+'/ritira','admin','POST',
      {note:'Ritiro sintetico della voce storica'});
    assert.equal(historicalWithdrawal.status,200,JSON.stringify(historicalWithdrawal.json));
    const historicalResult=await pool.query('SELECT withdrawn_at,withdraw_note FROM richieste_grazia WHERE id=$1',[historicalId]);
    assert.ok(historicalResult.rows[0].withdrawn_at,'legacy identifier can be withdrawn');
    assert.equal(historicalResult.rows[0].withdraw_note,'Ritiro sintetico della voce storica');
    assert.equal((await pool.query('SELECT attivo FROM grazia_carcerati WHERE nome=$1',[historicalName])).rows[0].attivo,false);
    assert.equal((await req('/api/grazia/richiesta/unsafe%24id/ritira','admin','POST',{note:'safety'})).status,400,
      'unsafe legacy identifier is rejected before any SQL write');

    // Model a legacy schema that has not received the account-erasure DDL.
    await pool.query('ALTER TABLE richieste_grazia ALTER COLUMN utente_id SET NOT NULL');
    // A canonical deletion must fail closed rather than erase an account and
    // leave an undeletable personal identifier in historic nominations.
    const Erasure=require('../services/privacyErasureLedgerService');
    const preMigration=await pool.connect();
    try {
      await preMigration.query('BEGIN');
      await assert.rejects(Erasure.enforceAccountDeletion(preMigration,C),
        /GRAZIA_ERASURE_MIGRATION_REQUIRED/);
    } finally {
      await preMigration.query('ROLLBACK');
      preMigration.release();
    }
    assert.equal((await pool.query('SELECT count(*)::integer n FROM users WHERE id=$1',[C])).rows[0].n,1,
      'missing migration must not partially delete the account');

    // Apply both draft migrations only to this disposable PostgreSQL test DB.
    await pool.query(draft);
    await pool.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$");
    const genericMigration=fs.readFileSync(path.join(__dirname,'../migrations/20261031_subject_proposals_review_gate.sql'),'utf8');
    await pool.query(genericMigration);
    // Reapplying an already-run migration must not create a CASCADE FK.
    await pool.query(genericMigration);
    const fk=await pool.query(
      "SELECT confdeltype FROM pg_constraint WHERE conrelid='public.subject_proposals'::regclass AND conname='subject_proposals_proposer_user_id_fkey'"
    );
    assert.equal(fk.rows[0].confdeltype,'n','account deletion unlinks, never cascades public audit');
    const graziaOwner=await pool.query(
      "SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='richieste_grazia' AND column_name='utente_id'"
    );
    assert.equal(graziaOwner.rows[0].is_nullable,'YES');

    const genericCases=[
      ['capo_stato','Capo sintetico storico DSAR','approved'],
      ['organizzazioni','Organizzazione sintetica ritirata DSAR','withdrawn'],
      ['attivisti','Attivista sintetico pendente DSAR','pending'],
      ['amnistia','Norma sintetica rifiutata DSAR','rejected']
    ];
    const saved={};
    for(const [category,title,status] of genericCases){
      const result=await pool.query(
        "INSERT INTO subject_proposals(proposer_user_id,category,title,source_url,status,published_ref) VALUES($1,$2,$3,'https://example.org/dsar',$4,$5) RETURNING id",
        [A,category,title,status,status==='approved'||status==='withdrawn'?'private-source-ref':null]
      );
      saved[status]=result.rows[0].id;
    }
    await pool.query(
      "INSERT INTO capo_stato_soggetti_approvati(nome,active,source_proposal_id) VALUES($1,TRUE,$2)",
      ['Capo sintetico storico DSAR',saved.approved]
    );
    const bPending=await pool.query(
      "INSERT INTO subject_proposals(proposer_user_id,category,title,source_url) VALUES($1,'attivisti','Altro attivista sintetico','https://example.org/other') RETURNING id",
      [B]
    );

    // The same canonical service used by DELETE /api/user/delete-account.
    const deletionClient=await pool.connect();
    let deletedResult;
    try {
      await deletionClient.query('BEGIN');
      deletedResult=await Erasure.enforceAccountDeletion(deletionClient,A);
      await deletionClient.query('COMMIT');
    }catch(e){
      await deletionClient.query('ROLLBACK');
      throw e;
    }finally{
      deletionClient.release();
    }
    assert.equal(deletedResult.userDeleted,1);
    assert.equal((await pool.query('SELECT count(*)::integer n FROM users WHERE id=$1',[A])).rows[0].n,0);
    assert.equal((await pool.query('SELECT count(*)::integer n FROM subject_proposals WHERE proposer_user_id=$1',[A])).rows[0].n,0);
    for(const status of ['pending','rejected']){
      assert.equal((await pool.query('SELECT count(*)::integer n FROM subject_proposals WHERE id=$1',[saved[status]])).rows[0].n,0,
        status+' unreviewed/nonpublic row must be erased');
    }
    for(const status of ['approved','withdrawn']){
      const preserved=await pool.query(
        'SELECT status,proposer_user_id,published_ref FROM subject_proposals WHERE id=$1',[saved[status]]
      );
      assert.equal(preserved.rows.length,1,status+' third-party audit must survive');
      assert.equal(preserved.rows[0].proposer_user_id,null,'deleted account UUID is unlinked');
      assert.equal(preserved.rows[0].published_ref,'private-source-ref','private publication audit link survives');
    }
    const publicLink=await pool.query(
      'SELECT source_proposal_id,active FROM capo_stato_soggetti_approvati WHERE nome=$1',
      ['Capo sintetico storico DSAR']
    );
    assert.equal(publicLink.rows[0].source_proposal_id,saved.approved);
    assert.equal(publicLink.rows[0].active,true,'approved third-party catalogue must not disappear with proposer');
    assert.equal((await pool.query('SELECT count(*)::integer n FROM subject_proposals WHERE id=$1',[bPending.rows[0].id])).rows[0].n,1,
      'unrelated account nomination remains intact');
    assert.equal((await pool.query('SELECT count(*)::integer n FROM richieste_grazia WHERE utente_id=$1',[A])).rows[0].n,0,
      'deleted user identifier cannot persist in historic Grazia submissions');
    const graziaAudit=await pool.query('SELECT status,utente_id,withdrawn_at FROM richieste_grazia WHERE id=$1',[id]);
    assert.equal(graziaAudit.rows.length,1,'withdrawn Grazia audit retained after account erasure');
    assert.equal(graziaAudit.rows[0].status,'approved');
    assert.equal(graziaAudit.rows[0].utente_id,null,'Grazia owner unlinked');
    assert.ok(graziaAudit.rows[0].withdrawn_at,'withdrawal record kept');
    assert.equal((await pool.query('SELECT count(*)::integer n FROM richieste_grazia WHERE id=$1',[secondId])).rows[0].n,1,
      'unrelated account Grazia history remains');

    // Concurrency: account deletion owns the users row until COMMIT.
    // A late Grazia POST from that deleted account must not reappear as
    // an orphan pending nomination after the cleanup has completed.
    const raceClient=await pool.connect();
    let lateSubmission;
    try {
      await raceClient.query('BEGIN');
      const raceDeletion=await Erasure.enforceAccountDeletion(raceClient,D);
      assert.equal(raceDeletion.userDeleted,1);
      lateSubmission=req('/api/grazia','d','POST',{
        nome:'Persona sintetica dopo cancellazione account',
        urlProva:'https://example.org/erasure/late'
      });
      await new Promise(resolve=>setTimeout(resolve,80));
      await raceClient.query('COMMIT');
      const response=await lateSubmission;
      assert.notEqual(response.status,202,'late account submission must not be accepted');
      const orphan=await pool.query('SELECT count(*)::integer n FROM richieste_grazia WHERE nome=$1',
        ['Persona sintetica dopo cancellazione account']);
      assert.equal(orphan.rows[0].n,0,'no orphan nomination after committed deletion');
    }finally{
      await raceClient.query('ROLLBACK').catch(()=>{});
      raceClient.release();
    }

  } finally {
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    await pool.end();
    Module._load=originalModuleLoad;
    if(previousNominationFlag===undefined)delete process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED;
    else process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED=previousNominationFlag;
    if(previousGraziaFlag===undefined)delete process.env.DEMOS_GRAZIA_NOMINATIONS_ENABLED;
    else process.env.DEMOS_GRAZIA_NOMINATIONS_ENABLED=previousGraziaFlag;
  }
});
