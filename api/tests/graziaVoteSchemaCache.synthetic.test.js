'use strict';
// Exercise the REAL Grazia vote handlers with a fake, in-memory SQL pool.
// Tests never connect to PostgreSQL, Render, Supabase or external services.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../routes/grazia.js'),'utf8');

function harness({idType='uuid',userColumn='userid',dateColumn='timestamp'}={}){
  const state={columns:{idType,userColumn,dateColumn},metadata:0,read:0,writes:[],connects:0,
    privateInputs:[],cooldown:0,queries:[]};
  const handlers=new Map();
  const user='11111111-1111-4111-8111-111111111111';
  const subject='Persona approvata sintetica';
  const tableRows=()=>[
    {column_name:'id',data_type:state.columns.idType},
    {column_name:state.columns.userColumn,data_type:'uuid'},
    {column_name:state.columns.dateColumn,data_type:'timestamp with time zone'}
  ].filter(row=>row.data_type!=null);
  async function query(statement,params=[]){
    const sql=String(statement);
    state.queries.push({sql,params});
    if(sql.includes('FROM information_schema.columns')){
      state.metadata++;
      return {rows:tableRows()};
    }
    if(sql.startsWith('SELECT nome,') && sql.includes('FROM voti_grazia')){
      state.read++;
      if(!sql.includes('WHERE '+state.columns.userColumn+' = $1')||
        !sql.includes('SELECT nome, '+state.columns.dateColumn+' AS changed_at')){
        throw Object.assign(new Error('SYNTHETIC_UNDEFINED_COLUMN'),{code:'42703'});
      }
      assert.equal(params[0],user);
      return {rows:[]};
    }
    if(sql.includes('SELECT id FROM grazia_carcerati WHERE attivo = true'))
      return {rows:[{id:42}]};
    if(sql.includes('FOR SHARE'))return {rows:[{id:42}]};
    if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[],rowCount:0};
    if(sql.startsWith('DELETE FROM voti_grazia')){
      state.writes.push({kind:'delete',sql,params});
      return {rowCount:0,rows:[]};
    }
    if(sql.startsWith('SELECT gen_random_uuid()'))
      return {rows:[{id:'22222222-2222-4222-8222-222222222222'}]};
    if(sql.includes('INSERT INTO voti_grazia')){
      state.writes.push({kind:'insert',sql,params});
      return {rowCount:1,rows:[]};
    }
    throw new Error('Unexpected synthetic SQL: '+sql);
  }
  const pool={query,async connect(){state.connects++;return {query,release(){}}}};
  const pass=(_req,_res,next)=>next();
  const modules={
    express:{Router:()=>({
      post:(route,...fns)=>handlers.set('POST '+route,fns),
      get:(route,...fns)=>handlers.set('GET '+route,fns)
    })},
    crypto:{randomUUID:()=>user},
    '../config/database':{getPool:()=>pool},
    '../middleware/auth':{pool,verifyToken:pass,requireAdmin:pass},
    '../middleware/politicalConsent':{requirePoliticalConsent:pass},
    '../middleware/civicIdentity':{requireVerifiedCivicIdentity:pass},
    '../middleware/validation':{validateInput:()=>pass},
    '../utils/recognitionEvidence':{validateEvidenceUrl:()=>null},
    '../utils/thirdPartyNominationGate':{isNominationWriteEnabled:()=>false,rejectUnavailableNomination:()=>{}},
    '../services/preferenceCooldownService':{
      getPreferenceCooldown:async()=>({isBlocked:false}),
      assertPreferenceChangeAllowed:async(_db,ctx)=>{
        state.cooldown++;state.privateInputs.push(ctx);
      },
      recordPreferenceChange:async()=>{},
      sendCooldownError:()=>false
    }
  };
  vm.runInNewContext(source,{
    module:{exports:{}},
    require:name=>{
      if(!(name in modules))throw new Error('Unexpected module '+name);
      return modules[name];
    },Buffer,URL,console,process:{env:{}}
  },{filename:'grazia.js'});
  async function vote(voti=[subject]){
    const fns=handlers.get('POST /vota');
    assert.equal(fns.length,5);
    const req={body:{voti},userId:user,user:{id:user,isAdmin:false}};
    const res={statusCode:200,body:null,headers:{},
      status(n){this.statusCode=n;return this},
      set(k,v){this.headers[k]=v;return this},
      json(o){this.body=o;return this}
    };
    for(let i=0;i<fns.length-1;i++)await fns[i](req,res,()=>{});
    await fns.at(-1)(req,res);
    return res;
  }
  return {vote,state};
}

test('two personal vote saves share one column lookup, not one per user action',async()=>{
  const {vote,state}=harness();
  for(let i=0;i<2;i++){
    const res=await vote();
    assert.equal(res.statusCode,200);
    assert.equal(res.body?.success,true);
    assert.match(res.headers['Cache-Control'],/no-store/);
  }
  assert.equal(state.metadata,1,'one metadata query per worker for repeated vote submissions');
  assert.equal(state.read,2);
  assert.equal(state.writes.filter(x=>x.kind==='insert').length,2);
  assert.ok(state.writes.every(x=>x.sql.includes('userid')));
  assert.equal(state.cooldown,2);
  assert.ok(state.privateInputs.every(x=>x.scope==='grazia:preferenza'));
});
test('renamed user/timestamp columns are shared safely by the vote writer',async()=>{
  const {vote,state}=harness({userColumn:'user_id',dateColumn:'data_voto',idType:'character varying'});
  const res=await vote();
  assert.equal(res.statusCode,200);
  assert.equal(state.metadata,1);
  assert.equal(state.writes.filter(x=>x.kind==='insert').length,1);
  assert.ok(state.writes.some(x=>x.sql.includes('(id, user_id, nome, data_voto)')));
  assert.ok(state.writes.find(x=>x.kind==='insert').params[0].startsWith('voto_grazia_'));
});
test('unrecognized or missing ID type rejects personal writes before any transaction',async()=>{
  for(const idType of [null,'integer','character']){
    const {vote,state}=harness({idType});
    const result=await vote();
    assert.equal(result.statusCode,500);
    assert.equal(result.body?.success,false);
    assert.equal(state.connects,0);
    assert.equal(state.writes.length,0);
    assert.equal(state.cooldown,0);
    assert.ok(!JSON.stringify(result.body).includes('GRAZIA_VOTE_SCHEMA_UNRECOGNIZED'));
  }
});
test('renamed schema clears stale cache after 42703 and re-probes next request',async()=>{
  const {vote,state}=harness();
  assert.equal((await vote()).statusCode,200);
  state.columns.userColumn='user_id';
  state.columns.dateColumn='created_at';
  assert.equal((await vote()).statusCode,500);
  assert.equal((await vote()).statusCode,200);
  assert.equal(state.metadata,2,'stale columns are rechecked after 42703');
  assert.equal(state.writes.filter(x=>x.kind==='insert').length,2);
  assert.equal(state.connects,2,'failed stale select never starts a write transaction');
});
