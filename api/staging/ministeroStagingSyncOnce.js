'use strict';

// DEMOS 10: one-shot source-only Ministry cache updater, no web server,
// Firebase, cron, production or full application imports.
const {assertStagingAppCanary}=require('./unified_staging_app_safety');
const {verifyCivicStagingRuntimeIdentity}=
  require('../services/civicStagingSessionRuntimeIdentity');
const {readOfficialSource}=require('./ministeroPublicSnapshotAudit');
const STAGING_HASH='0cbb6ace68a9f11956904e2a37898ec8';
const EXPLICIT_GO='I_APPROVE_STAGING_MINISTERO_SOURCE_SYNC';

function assertSourceSyncEnv(env=process.env){
  if(env?.NODE_ENV!=='staging' ||
     env.DEMOS_STAGING_MINISTERO_SOURCE_SYNC_GO!==EXPLICIT_GO)
    throw new Error('MINISTERO_SOURCE_SYNC_GO_REQUIRED');
  const target=assertStagingAppCanary(env);
  if(!target.active||!target.connectionString)
    throw new Error('MINISTERO_SOURCE_SYNC_GO_REQUIRED');
  return target.connectionString;
}
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
  !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function prepareRows(rows){
  if(!Array.isArray(rows)||rows.length<1||rows.length>100)
    throw new Error('MINISTERO_SOURCE_COUNT_UNSAFE');
  const ids=new Set();
  return rows.map(x=>{
    if(!x||typeof x.id_ministero!=='string'||!/^\d{1,14}$/.test(x.id_ministero)||
       ids.has(x.id_ministero)||x.id!=='ministero_'+x.id_ministero)
      throw new Error('MINISTERO_SOURCE_INVALID_ID');
    ids.add(x.id_ministero);
    if(typeof x.titolo!=='string'||!x.titolo.trim()||x.titolo.length>2000)
      throw new Error('MINISTERO_SOURCE_INVALID_TITLE');
    const law=x.tipo==='Legge di iniziativa popolare';
    if(!law&&x.tipo!=='Referendum abrogativo')
      throw new Error('MINISTERO_SOURCE_INVALID_TYPE');
    const category=law?'iniziative_popolari':'referendum_abrogativi';
    const path=law?'/iniziative-popolari':'/referendum-abrogativi';
    if(x.categoria_notifica!==category||x.target_path!==path)
      throw new Error('MINISTERO_SOURCE_INVALID_CATEGORY');
    if(!['in_corso','conclusa','messa_a_disposizione','alla_camera','al_senato']
       .includes(x.stato))throw new Error('MINISTERO_SOURCE_INVALID_STATE');
    if(!validDate(x.data_inizio_raw)||!validDate(x.data_fine_raw))
      throw new Error('MINISTERO_SOURCE_INVALID_DATE');
    if(!Number.isSafeInteger(x.firme_raccolte)||x.firme_raccolte<0||
       x.firme_raccolte>2147483647)
      throw new Error('MINISTERO_SOURCE_INVALID_SIGNATURES');
    if(x.sito_web!=='https://firmereferendum.giustizia.it/referendum/open/dettaglio-open/'+x.id_ministero)
      throw new Error('MINISTERO_SOURCE_INVALID_URL');
    return {
      id:x.id,id_ministero:x.id_ministero,titolo:x.titolo,tipo:x.tipo,
      stato:x.stato,esito:x.stato==='conclusa'?'Conclusa':'In Attesa',
      data_inizio:x.data_inizio_raw,
      data_fine:x.data_fine_raw==='9999-12-31'?null:x.data_fine_raw,
      firme_raccolte:x.firme_raccolte,
      quorum_raggiunto:x.firme_raccolte>=(law?50000:500000),
      sito_web:x.sito_web,categoria:category,target_path:path,
    };
  });
}
const FIELDS=[
  'id text,id_ministero text,titolo text,tipo text,stato text,',
  'esito text,data_inizio date,data_fine date,firme_raccolte integer,',
  'quorum_raggiunto boolean,sito_web text,categoria text,target_path text',
].join('');
const UPSERT_SQL=[
  'INSERT INTO public.iniziative_ministero',
  '(id,id_ministero,titolo,tipo,stato,esito,data_inizio,data_fine,',
  'firme_raccolte,quorum_raggiunto,sito_web,data_ultimo_aggiornamento,updated_at)',
  'SELECT r.id,r.id_ministero,r.titolo,r.tipo,',
  "CASE WHEN r.stato='in_corso' AND r.data_fine<CURRENT_DATE",
  "THEN 'conclusa' ELSE r.stato END,",
  "CASE WHEN r.stato='in_corso' AND r.data_fine<CURRENT_DATE",
  "THEN 'Conclusa' ELSE r.esito END,",
  'r.data_inizio,r.data_fine,r.firme_raccolte,r.quorum_raggiunto,',
  'r.sito_web,now(),now()',
  'FROM jsonb_to_recordset($1::jsonb) AS r('+FIELDS+')',
  'ON CONFLICT (id) DO UPDATE SET',
  'id_ministero=EXCLUDED.id_ministero,titolo=EXCLUDED.titolo,',
  'tipo=EXCLUDED.tipo,stato=EXCLUDED.stato,esito=EXCLUDED.esito,',
  'data_inizio=EXCLUDED.data_inizio,data_fine=EXCLUDED.data_fine,',
  'firme_raccolte=EXCLUDED.firme_raccolte,',
  'quorum_raggiunto=EXCLUDED.quorum_raggiunto,sito_web=EXCLUDED.sito_web,',
  'data_ultimo_aggiornamento=now(),updated_at=now()',
].join('\n');
// Fail closed on the set of official IDs, not just a percentage of feed size.
// A same-size feed with one removed ID must never silently preserve a stale
// initiative in the cache. The lifecycle of disappeared IDs needs its own
// separately reviewed policy; this one-shot importer never deletes rows.
const MISSING_SOURCE_IDS_SQL=[
  'SELECT count(*)::integer AS missing_count',
  'FROM public.iniziative_ministero m',
  'WHERE NOT EXISTS (',
  'SELECT 1 FROM jsonb_to_recordset($1::jsonb) AS r(id text)',
  'WHERE r.id=m.id',
  ')',
].join('\n');
const BASELINE_SQL=[
  'INSERT INTO public.civic_new_initiative_notifications',
  '(category,official_id,title,target_path,status)',
  "SELECT r.categoria,r.id_ministero,r.titolo,r.target_path,'suppressed'",
  'FROM jsonb_to_recordset($1::jsonb) AS r('+FIELDS+')',
  'JOIN public.iniziative_ministero m ON m.id=r.id',
  "WHERE m.stato='in_corso' AND (m.data_fine IS NULL OR m.data_fine>=CURRENT_DATE)",
  'ON CONFLICT (category,official_id) DO NOTHING RETURNING id',
].join('\n');

async function syncOnce(env=process.env,options={}){
  const target=options.validateEnv?
    options.validateEnv(env):assertSourceSyncEnv(env);
  if(typeof target!=='string'||!target)
    throw new Error('MINISTERO_SOURCE_SYNC_TARGET_INVALID');
  const makePool=options.makePool||((connectionString)=>{
    const fs=require('node:fs'),path=require('node:path');
    const {buildDatabaseSsl}=require('../utils/databaseTlsPolicy');
    const ca=fs.readFileSync(path.join(__dirname,'..','certs','prod-ca-2021.crt'),'utf8');
    return new (require('pg').Pool)({
      connectionString,max:1,min:0,connectionTimeoutMillis:7000,
      query_timeout:15000,statement_timeout:15000,idleTimeoutMillis:2000,
      application_name:'demos_staging_ministero_source_once',
      ssl:buildDatabaseSsl(connectionString,{supabaseCa:ca}),
    });
  });
  const pool=makePool(target);
  let client,transaction=false,discard=false;
  try{
    if(!pool||typeof pool.connect!=='function'||typeof pool.end!=='function')
      throw new Error('MINISTERO_SOURCE_SYNC_POOL_INVALID');
    const verify=options.verifyIdentity||verifyCivicStagingRuntimeIdentity;
    if(await verify(pool)!==true)throw new Error('MINISTERO_SOURCE_SYNC_IDENTITY_INVALID');
    const source=options.readSource||readOfficialSource;
    const rows=prepareRows(await source());
    const payload=JSON.stringify(rows);
    client=await pool.connect();
    await client.query('BEGIN');
    transaction=true;
    await client.query("SET LOCAL statement_timeout = '15000ms'");
    const identity=await client.query([
      'SELECT current_user::text role_name,current_database()::text database_name,',
      'md5(db_identity::text) identity_hash',
      'FROM public.civic_runtime_identity WHERE id=1',
    ].join('\n'));
    const current=identity.rows?.length===1?identity.rows[0]:null;
    if(current?.role_name!=='demos_staging_runtime'||
       current.database_name!=='postgres'||current.identity_hash!==STAGING_HASH)
      throw new Error('MINISTERO_SOURCE_SYNC_IDENTITY_INVALID');
    const advisory=await client.query(
      'SELECT pg_try_advisory_xact_lock($1,$2) acquired',[20261105,301]);
    if(advisory.rows?.[0]?.acquired!==true)
      throw new Error('MINISTERO_SOURCE_SYNC_CONCURRENT');
    const guard=await client.query(
      'SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1 FOR SHARE');
    if(guard.rows?.length!==1||guard.rows[0].blocked!==true)
      throw new Error('MINISTERO_SOURCE_SYNC_PUSH_GUARD_REQUIRED');
    const previous=await client.query([
      'SELECT (SELECT count(*)::integer FROM public.iniziative_ministero) old_count,',
      "(SELECT count(*)::integer FROM public.civic_new_initiative_notifications WHERE status<>'suppressed') actionable",
    ].join('\n'));
    const state=previous.rows?.[0];
    if(!state||!Number.isInteger(state.old_count)||state.old_count<1||
       state.old_count>100000||Number(state.actionable)!==0)
      throw new Error('MINISTERO_SOURCE_SYNC_BASELINE_UNSAFE');
    const coverage=await client.query(MISSING_SOURCE_IDS_SQL,[payload]);
    if(coverage.rows?.length!==1 ||
       !Number.isInteger(coverage.rows[0].missing_count) ||
       coverage.rows[0].missing_count!==0)
      throw new Error('MINISTERO_SOURCE_SYNC_OFFICIAL_ID_GAP');
    const upsert=await client.query(UPSERT_SQL,[payload]);
    if(upsert.rowCount!==rows.length)
      throw new Error('MINISTERO_SOURCE_SYNC_UPSERT_COUNT_MISMATCH');
    const suppressed=await client.query(BASELINE_SQL,[payload]);
    const final=await client.query([
      "SELECT (SELECT count(*)::integer FROM public.civic_new_initiative_notifications WHERE status<>'suppressed') actionable,",
      '(SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1) blocked',
    ].join('\n'));
    if(final.rows?.length!==1||Number(final.rows[0].actionable)!==0||
       final.rows[0].blocked!==true)
      throw new Error('MINISTERO_SOURCE_SYNC_POSTCHECK_FAILED');
    await client.query('COMMIT');transaction=false;
    return {source:rows.length,updated:upsert.rowCount,
      newlySuppressed:suppressed.rowCount,notificationsSent:0,stagingOnly:true};
  }catch{
    discard=true;
    if(client&&transaction){try{await client.query('ROLLBACK');}catch{}}
    throw new Error('MINISTERO_SOURCE_SYNC_ABORTED');
  }finally{
    if(client){try{client.release(discard);}catch{}}
    if(pool&&typeof pool.end==='function'){try{await pool.end();}catch{}}
  }
}
if(require.main===module){
  if(process.argv.length!==3||process.argv[2]!=='--once'){
    console.error('MINISTERO_SOURCE_SYNC_ONCE_ONLY');process.exitCode=1;
  }else{
    syncOnce().then(out=>{
      console.log('MINISTERO_STAGING_SOURCE_SYNC_OK '+JSON.stringify(out));
    }).catch(()=>{
      console.error('MINISTERO_SOURCE_SYNC_ABORTED');process.exitCode=1;
    });
  }
}
module.exports={assertSourceSyncEnv,prepareRows,UPSERT_SQL,BASELINE_SQL,MISSING_SOURCE_IDS_SQL,syncOnce};
