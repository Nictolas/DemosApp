'use strict';
// Full GET /api/user/data-export with actual PostgreSQL 17 in disposable CI.
// Every subject, token, row, HTTP request and value is invented. Never use
// real Supabase, Render, Axiom, Backblaze B2 or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {Pool} = require('pg');

const DB = 'postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_legacy_rights_ci';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const tables = [
  'users','user_profile','user_consents','opinioni_risposte',
  'voti_capo_stato','voti_referendum_abrogativi','voti_iniziative_popolari',
  'voti_ice','notifiche_demos','notifiche_avvistamenti','notifiche_comunali',
  'notifiche_voti_comuni','notifiche_voti_parlamento',
  'political_opinion_notifications','notifiche_preferenze','comunicazioni',
  'user_auth_providers','user_rights_requests'
];

function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' || e.GDPR_LEGACY_PG_CI !== 'isolated' ||
      e.TEST_DATABASE_URL !== DB || e.DATABASE_URL || e.SUPABASE_URL ||
      e.SUPABASE_DB_URL || e.SUPABASE_SERVICE_ROLE_KEY ||
      e.RENDER || e.RENDER_SERVICE_ID || e.AXIOM_ENABLED === 'true') {
    throw Error('GDPR_FULL_EXPORT_PG17_REQUIRES_LOCAL_SYNTHETIC_DATABASE');
  }
}

async function schema(pool) {
  const textCols = [
    'nome','cognome','ruolo','status','genere','cittadinanza',
    'paese_residenza','regione_residenza','provincia_residenza',
    'comune_residenza','paese_elezione','regione_elezione',
    'provincia_elezione','comune_elezione','grado_elezione',
    'paese_candidatura','regione_candidatura','provincia_candidatura',
    'comune_candidatura','grado_candidatura','consent_ip_address',
    'consent_user_agent'
  ];
  await pool.query(
    'CREATE TABLE public.users (id uuid PRIMARY KEY,email text,premium boolean,' +
    'created_at timestamptz,updated_at timestamptz,data_nascita date,' +
    'privacy_policy_consent boolean,terms_of_service_consent boolean,' +
    'political_opinions_consent boolean,consent_timestamp timestamptz,' +
    textCols.map(c=>c+' text').join(',')+')'
  );
  const profileCols = textCols.filter(c=>!c.startsWith('consent_') &&
      !['ruolo','status','nome','cognome'].includes(c));
  await pool.query('CREATE TABLE public.user_profile (user_id uuid PRIMARY KEY,' +
    'data_nascita date,'+profileCols.map(c=>c+' text').join(',')+')');
  await pool.query('CREATE TABLE public.user_consents (' +
    'user_id uuid PRIMARY KEY,privacy_policy_consent boolean,' +
    'terms_of_service_consent boolean,political_opinions_consent boolean,' +
    'consent_timestamp timestamptz)');
  await pool.query('CREATE TABLE public.opinioni_risposte (' +
    'user_id uuid PRIMARY KEY,energia_nucleare text,new_question text)');
  for(const n of ['voti_capo_stato','voti_referendum_abrogativi','voti_iniziative_popolari'])
    await pool.query('CREATE TABLE public.'+n+'(userid uuid)');
  await pool.query('CREATE TABLE public.voti_ice(utente_id varchar(255))');
  await pool.query('CREATE TABLE public.notifiche_demos (' +
    'id uuid DEFAULT gen_random_uuid(),id_utente uuid,titolo text,testo text,' +
    'data_creazione timestamptz,data date)');
  await pool.query('CREATE TABLE public.notifiche_avvistamenti (' +
    'id uuid DEFAULT gen_random_uuid(),id_utente uuid,tipo_avvistamento text,' +
    'metadata jsonb,comune_residenza text,data_creazione timestamptz)');
  await pool.query('CREATE TABLE public.notifiche_comunali (' +
    'id uuid DEFAULT gen_random_uuid(),id_utente uuid,tipologia text,dove text,' +
    'dal_giorno date,al_giorno date,zona text,data_creazione timestamptz)');
  await pool.query('CREATE TABLE public.notifiche_voti_comuni (' +
    'id uuid DEFAULT gen_random_uuid(),id_utente uuid,titolo text,testo text,' +
    'politico text,voto text,comune_residenza text,data_creazione timestamptz)');
  await pool.query('CREATE TABLE public.notifiche_voti_parlamento (' +
    'id uuid DEFAULT gen_random_uuid(),id_utente uuid,titolo text,testo text,' +
    'politico text,camera text,voto text,votazione_hash text,data_creazione timestamp)');
  await pool.query('CREATE TABLE public.political_opinion_notifications (' +
    'id uuid DEFAULT gen_random_uuid(),recipient_user_id uuid,subject_user_id uuid,' +
    'opinion_id text,opinion_text text,previous_value text,new_value text,created_at timestamptz)');
  await pool.query('CREATE TABLE public.notifiche_preferenze(user_id uuid PRIMARY KEY,demos boolean)');
  await pool.query('CREATE TABLE public.comunicazioni (' +
    'id uuid DEFAULT gen_random_uuid(),id_utente uuid,titolo text,testo text,' +
    'zona text,data_creazione timestamptz,likes int,dislikes int,punti_trasparenza int)');
  await pool.query('CREATE TABLE public.user_auth_providers (' +
    'user_id uuid,provider text,provider_user_id text)');
  await pool.query('CREATE TABLE IF NOT EXISTS public.user_rights_requests (' +
    'id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,' +
    'request_type text,request_data jsonb,status text)');
}

async function mount(pool) {
  const entries = [
    '../middleware/auth',
    '../middleware/validation',
    '../services/auditService',
    '../utils/emailCrypto',
    '../routes/user/gdpr-rights'
  ].map(x=>require.resolve(x));
  const old = entries.map(x=>require.cache[x]);
  try {
    require.cache[entries[0]] = {id:entries[0],filename:entries[0],loaded:true,exports:{
      pool,verifyToken(req,res,next) {
        const match=/^Bearer (.+)$/.exec(req.headers.authorization||'');
        if(!match || ![A,B].includes(match[1])) return res.status(401).json({success:false});
        req.userId=match[1]; next();
      }
    }};
    require.cache[entries[1]] = {id:entries[1],filename:entries[1],loaded:true,exports:{
      validateInput:()=> (_req,_res,next)=>next()
    }};
    require.cache[entries[2]] = {id:entries[2],filename:entries[2],loaded:true,exports:{
      logAction:async()=>{},
      getUserAuditLogs:async()=>Array.from({length:100},(_,i)=>({
        id:'synthetic-audit-'+i,action:'DATA_ACCESS',success:true
      }))
    }};
    require.cache[entries[3]] = {id:entries[3],filename:entries[3],loaded:true,exports:{
      decrypt:v=>v
    }};
    delete require.cache[entries[4]];
    const router=require('../routes/user/gdpr-rights');
    const app=express();
    app.use(express.json());
    app.use('/api/user',router);
    const server=await new Promise(resolve=>{
      const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));
    });
    return {server, origin:'http://127.0.0.1:'+server.address().port, cleanup() {
      return new Promise(resolve=>{
        server.close(resolve);
        server.closeAllConnections();
      }).finally(()=>{
        for(let i=0;i<entries.length;i++){
          delete require.cache[entries[i]];
          if(old[i])require.cache[entries[i]]=old[i];
        }
      });
    }};
  } catch(e) {
    for(let i=0;i<entries.length;i++){
      delete require.cache[entries[i]];
      if(old[i])require.cache[entries[i]]=old[i];
    }
    throw e;
  }
}

test('full GDPR HTTP JSON/CSV uses real PG17 sources, authenticates and fails closed',async()=>{
  guard();
  const pool=new Pool({connectionString:DB,ssl:false,max:2});
  let site;
  const previousLog=console.error;
  console.error=()=>{};
  try{
    await schema(pool);
    await pool.query(
      'INSERT INTO public.users (id,email,nome,privacy_policy_consent) ' +
      'VALUES ($1,$2,$3,true),($4,$5,$6,false)',
      [A,'synthetic-a@example.invalid','Synthetic A',
       B,'synthetic-b@example.invalid','Private Other']
    );
    await pool.query(
      'INSERT INTO public.opinioni_risposte VALUES($1,$2,$3),($4,$5,$6)',
      [A,'synthetic-yes','synthetic-new',B,'private-other','private-other']
    );
    for(const n of ['voti_capo_stato','voti_referendum_abrogativi','voti_iniziative_popolari'])
      await pool.query('INSERT INTO public.'+n+' VALUES ($1),($2)',[A,B]);
    await pool.query('INSERT INTO public.voti_ice VALUES($1),($2)',[A,B]);
    await pool.query('INSERT INTO public.notifiche_demos (id_utente,titolo) VALUES($1,$2),($3,$4)',
      [A,'synthetic-own',B,'private-other']);
    await pool.query('INSERT INTO public.notifiche_preferenze VALUES($1,true),($2,false)',[A,B]);
    await pool.query('INSERT INTO public.user_auth_providers VALUES ($1,$2,$3),($4,$5,$6)',
      [A,'google','synthetic-provider-A',B,'google','private-other']);
    site=await mount(pool);
    const req=(id,path)=>fetch(site.origin+path,{
      headers:{authorization:'Bearer '+id},signal:AbortSignal.timeout(3000)
    });
    const denied=await fetch(site.origin+'/api/user/data-export');
    assert.equal(denied.status,401);
    assert.equal(denied.headers.get('cache-control'),'private, no-store, max-age=0');
    for(const bad of ['?format[]=json','?format=json&format=csv','?format=pdf']) {
      const response=await req(A,'/api/user/data-export'+bad);
      assert.equal(response.status,400);
    }
    const response=await req(A,'/api/user/data-export?format=json');
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
    const body=await response.json();
    assert.equal(body.success,true);
    const exportData=body.data;
    assert.equal(exportData.personal_data.basic_info.nome,'Synthetic A');
    assert.equal(exportData.political_opinions.new_question,'synthetic-new');
    assert.equal(exportData.notifications.length,1);
    assert.equal(exportData.notification_preferences.demos,true);
    assert.equal(exportData.personal_data.auth_providers[0].provider_user_id,'synthetic-provider-A');
    assert.deepEqual(Object.fromEntries(exportData.voting_activity.vote_counts.map(v=>[v.vote_type,v.vote_count])),{
      capo_stato:1,referendum:1,iniziative:1,ice:1
    });
    assert.equal(exportData.audit_logs.length,100);
    assert.equal(exportData.audit_log_coverage.complete_history_verified,false);
    assert.equal(exportData.audit_log_coverage.per_request_limit,100);
    assert.equal(exportData.audit_log_coverage.returned_rows,100);
    // F5-17 is NOT approved: no invented retention period may be exported.
    assert.equal(exportData.data_retention_info.status,'verifica_necessaria');
    for (const category of ['account_data','voting_data','communication_data','technical_data']) {
      assert.equal(exportData.data_retention_info[category],null,category);
    }
    assert.match(exportData.data_retention_info.note,/non sono ancora verificati/);
    assert.doesNotMatch(JSON.stringify(exportData.data_retention_info),/5 anni|3 anni|12 mesi/);

    assert.doesNotMatch(JSON.stringify(body),/private-other/);

    const csv=await req(A,'/api/user/data-export?format=csv');
    assert.equal(csv.status,200);
    assert.match(csv.headers.get('content-type'),/text\/csv/);
    const disposition=csv.headers.get('content-disposition');
    assert.match(disposition,/^attachment; filename="dati-personali-\\d{4}-\\d{2}-\\d{2}\\.csv"$/);
    assert.doesNotMatch(disposition,new RegExp(A));

    const csvText=await csv.text();
    assert.match(csvText,/synthetic-new/);
    assert.match(csvText,/audit_log_coverage/);
    assert.match(csvText,/data_retention_info\\.status/);
    assert.match(csvText,/verifica_necessaria/);
    assert.doesNotMatch(csvText,/Conservato in forma anonima per 5 anni|Conservato per 3 anni|Conservato per 12 mesi/);

    assert.doesNotMatch(csvText,/private-other/);
    const receipts=await pool.query(
      "SELECT COUNT(*)::int AS n FROM public.user_rights_requests WHERE user_id=$1 AND request_type='data_export'",
      [A]
    );
    assert.equal(receipts.rows[0].n,2);

    // Missing source must error (no fabricated complete export or receipt).
    await pool.query('DROP TABLE public.notifiche_demos');
    const failed=await req(A,'/api/user/data-export?format=json');
    assert.equal(failed.status,500);
    assert.equal((await failed.json()).success,false);
    const after=await pool.query(
      "SELECT COUNT(*)::int AS n FROM public.user_rights_requests WHERE user_id=$1",
      [A]
    );
    assert.equal(after.rows[0].n,2);
  } finally {
    console.error=previousLog;
    if(site)await site.cleanup();
    for(const n of tables.slice().reverse())
      await pool.query('DROP TABLE IF EXISTS public.'+n).catch(()=>{});
    await pool.end();
  }
});
