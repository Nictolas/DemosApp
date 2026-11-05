'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../routes/grazia.js'),'utf8');

function makeHarness({initialColumns=['userid','timestamp'],failFirstMetadata=false}={}) {
  let columns=initialColumns;
  const queries=[];
  const cooldown=[];
  const handlers=new Map();
  let metadataFailures=failFirstMetadata?1:0;
  const pool={
    async query(statement,params=[]) {
      const sql=String(statement);
      queries.push({sql,params});
      if(sql.includes('FROM grazia_carcerati c')&&sql.includes('LEFT JOIN voti_grazia')){
        return {rows:[{nome:'Persona approvata sintetica',richieste:2}]};
      }
      if(sql.includes('FROM information_schema.columns')){
        if(metadataFailures-->0)throw Object.assign(new Error('SYNTHETIC_SCHEMA_OFFLINE'),{code:'08006'});
        return {rows:columns.map(column_name=>({column_name}))};
      }
      if(sql.includes('FROM voti_grazia')&&sql.includes('MAX(')){
        const expected=columns.includes('userid')?'userid':'user_id';
        const expectedDate=columns.includes('timestamp')?'timestamp':
          columns.includes('data_voto')?'data_voto':'created_at';
        if(!sql.includes('WHERE '+expected+' = $1') ||
           !sql.includes('MAX('+expectedDate+') OVER ()')){
          throw Object.assign(new Error('SYNTHETIC_UNDEFINED_COLUMN'),{code:'42703'});
        }
        const id=params[0];
        if(id==='no-votes')return {rows:[]};
        return {rows:[
          {nome:'Risposta '+id+' B',last_changed_at:'2026-11-05T11:59:01.000Z'},
          {nome:'Risposta '+id+' A',last_changed_at:'2026-11-05T11:59:01.000Z'},
        ]};
      }
      throw new Error('Unexpected SQL: '+sql);
    }
  };
  const pass=(_req,_res,next)=>next();
  const mocks={
    express:{Router:()=>({get:(route,...fns)=>handlers.set(route,fns),post:()=>{}})},
    crypto:{randomUUID:()=> 'fake'},
    '../utils/recognitionEvidence':{validateEvidenceUrl:()=>null},
    '../utils/thirdPartyNominationGate':{isNominationWriteEnabled:()=>true,rejectUnavailableNomination:()=>{}},
    '../middleware/auth':{verifyToken:pass,requireAdmin:pass,pool},
    '../middleware/politicalConsent':{requirePoliticalConsent:pass},
    '../middleware/civicIdentity':{requireVerifiedCivicIdentity:pass},
    '../middleware/validation':{validateInput:()=>pass},
    '../services/preferenceCooldownService':{
      getPreferenceCooldown:async(_db,args)=>{
        cooldown.push(args);
        return {isBlocked:!!args.fallbackChangedAt,unlockDate:null};
      },
      assertPreferenceChangeAllowed:async()=>{},
      recordPreferenceChange:async()=>{},
      sendCooldownError:()=>false,
    },
    jsonwebtoken:{verify:(token,secret)=>{
      assert.equal(secret,'synthetic-secret');
      if(!token.startsWith('synthetic-'))throw Error('bad token');
      return {userId:token.slice('synthetic-'.length)};
    }}
  };
  vm.runInNewContext(source,{
    module:{exports:{}},
    require:name=>{
      if(!(name in mocks))throw Error('Unexpected module '+name);
      return mocks[name];
    },
    process:{env:{JWT_SECRET:'synthetic-secret'}},
    Buffer,URL,console,
  },{filename:'grazia.js'});
  async function get(user) {
    const fns=handlers.get('/');
    assert.ok(fns?.length===2);
    const req={headers:user?{authorization:'Bearer synthetic-'+user}:{}};
    const res={
      code:200,headers:{},body:null,
      set(name,value){this.headers[name]=value;return this;},
      status(code){this.code=code;return this;},
      json(body){this.body=body;return this;}
    };
    await fns[0](req,res,()=>{});
    await fns[1](req,res);
    assert.equal(res.code,200);
    assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
    return res.body;
  }
  return {
    get,queries,cooldown,
    setColumns:next=>{columns=next},
    counts:()=>({
      metadata:queries.filter(x=>x.sql.includes('FROM information_schema.columns')).length,
      votes:queries.filter(x=>x.sql.includes('FROM voti_grazia')&&x.sql.includes('MAX(')).length,
      total:queries.length
    })
  };
}

test('anonymous Grazia GET reads only public aggregate and no personal metadata',async()=>{
  const x=makeHarness();
  const response=await x.get();
  assert.equal(response.success,true);
  assert.deepEqual(Array.from(response.mieiVoti),[]);
  assert.deepEqual(x.counts(),{metadata:0,votes:0,total:1});
  assert.equal(x.cooldown.length,0);
});

test('concurrent authenticated requests share a single column lookup, never user data',async()=>{
  const x=makeHarness();
  const [a,b]=await Promise.all([x.get('a'),x.get('b')]);
  assert.deepEqual(Array.from(a.mieiVoti),['Risposta a B','Risposta a A']);
  assert.deepEqual(Array.from(b.mieiVoti),['Risposta b B','Risposta b A']);
  assert.deepEqual(x.counts(),{metadata:1,votes:2,total:5});
  assert.deepEqual(x.cooldown.map(y=>y.userId),['a','b']);
  for(const y of x.cooldown){
    assert.equal(y.scope,'grazia:preferenza');
    assert.equal(y.fallbackChangedAt,'2026-11-05T11:59:01.000Z');
  }
  await x.get('a');
  assert.deepEqual(x.counts(),{metadata:1,votes:3,total:7});
  assert.equal(x.queries.some(y=>y.sql.includes('SELECT MAX(')),false,'no additional MAX database query');
});

test('empty votes pass null fallback, without a separate MAX query',async()=>{
  const x=makeHarness({initialColumns:['user_id','data_voto']});
  const response=await x.get('no-votes');
  assert.equal(response.blocco.isBlocked,false);
  assert.deepEqual(Array.from(response.mieiVoti),[]);
  assert.equal(x.cooldown[0].fallbackChangedAt,null);
  assert.deepEqual(x.counts(),{metadata:1,votes:1,total:3});
});

test('column drift drops cached schema and re-probes after failed personal query',async()=>{
  const x=makeHarness();
  await x.get('a');
  x.setColumns(['user_id','created_at']);
  const stale=await x.get('b');
  assert.deepEqual(Array.from(stale.mieiVoti),[],'fail closed on renamed private columns');
  const restored=await x.get('b');
  assert.deepEqual(Array.from(restored.mieiVoti),['Risposta b B','Risposta b A']);
  assert.equal(x.counts().metadata,2);
});

test('transient metadata failure is not cached and cannot leak personal SQL errors',async()=>{
  const x=makeHarness({failFirstMetadata:true});
  const first=await x.get('a');
  assert.deepEqual(Array.from(first.mieiVoti),[]);
  assert.ok(!JSON.stringify(first).includes('SYNTHETIC_SCHEMA_OFFLINE'));
  await x.get('a');
  assert.equal(x.counts().metadata,2);
  assert.equal(x.counts().votes,1);
});
