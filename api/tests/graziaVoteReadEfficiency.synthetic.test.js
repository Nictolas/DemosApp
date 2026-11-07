'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../routes/grazia.js'),'utf8');

function makeHarness({initialColumns=['userid','timestamp'],failFirstMetadata=false,accountActive=true,consentGranted=true}={}) {
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
        return {rows:[...columns.map(column_name=>({column_name,data_type:'text'})),
          {column_name:'id',data_type:'uuid'}]};
      }
      if(sql.includes('FROM voti_grazia')&&sql.includes('MAX(')){
        const expected=columns.includes('userid')?'userid':'user_id';
        const expectedDate=columns.includes('timestamp')?'timestamp':
          columns.includes('data_voto')?'data_voto':'created_at';
        if(!sql.includes('WHERE '+expected+' = $1') ||
           !sql.includes('MAX(vote.'+expectedDate+') OVER ()')){
          throw Object.assign(new Error('SYNTHETIC_UNDEFINED_COLUMN'),{code:'42703'});
        }
        assert.match(sql,/FROM users u\s+LEFT JOIN user_consents uc ON uc.user_id = u.id/,
          'personal data must depend on the current consent row in the same query');
        assert.match(sql,/WHERE u.id::text = \$2 AND u.status = 'a'/,
          'the account must remain active');
        assert.match(sql,/COALESCE\(uc.political_opinions_consent,\s*u.political_opinions_consent, false\) = TRUE/,
          'revoked consent must hide stale vote and cooldown data');
        assert.equal(params[1],String(params[0]));
        const id=params[0];
        if(!accountActive || !consentGranted)return {rows:[{active:false,nome:null,last_changed_at:null}]};
        if(id==='no-votes')return {rows:[{active:true,nome:null,last_changed_at:null}]};
        return {rows:[
          {active:true,nome:'Risposta '+id+' B',last_changed_at:'2026-11-05T11:59:01.000Z'},
          {active:true,nome:'Risposta '+id+' A',last_changed_at:'2026-11-05T11:59:01.000Z'},
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
    '../utils/thirdPartyNominationGate':{isNominationWriteEnabled:()=>true,isGraziaNominationWriteEnabled:()=>true,rejectUnavailableNomination:()=>{}},
    '../middleware/auth':{verifyToken:pass,requireAdmin:pass,pool},
    '../middleware/politicalConsent':{requirePoliticalConsent:pass},
    '../middleware/civicIdentity':{requireVerifiedCivicIdentity:pass},
    '../middleware/validation':{validateInput:()=>pass},
    '../services/politicalConsentService':{getPoliticalConsentState:async()=>({exists:true,granted:true})},
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
      // Legacy verifier accepted other signed token types and raw tokens.
      assert.equal(secret,'synthetic-secret');
      if(!token.startsWith('synthetic-'))throw Error('bad token');
      return {userId:token.slice('synthetic-'.length)};
    }},
    '../utils/jwt':{verifyAccessToken:(token)=>{
      // Isolated equivalent of JWT type/issuer/audience validation.
      if(!/^synthetic-(a|b|no-votes)$/.test(token))throw Error('not an access JWT');
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
  async function get(user, authorizationOverride) {
    const fns=handlers.get('/');
    assert.ok(fns?.length===2);
    const headers=authorizationOverride===undefined
      ? (user?{authorization:'Bearer synthetic-'+user}:{})
      : {authorization:authorizationOverride};
    const req={headers};
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

test('Grazia GET never reads personal votes for refresh, pending, raw or malformed auth headers',async()=>{
  const x=makeHarness();
  const valid=await x.get('a');
  assert.deepEqual(Array.from(valid.mieiVoti),['Risposta a B','Risposta a A']);
  assert.equal(x.counts().votes,1);
  for (const authorization of [
    'synthetic-a',
    'Basic synthetic-a',
    'Bearer synthetic-refresh-a',
    'Bearer synthetic-oauth-pending-a',
    'Bearer ',
    'Bearer synthetic-a suffix'
  ]) {
    const result=await x.get(null,authorization);
    assert.equal(result.success,true,'public feed stays available');
    assert.deepEqual(Array.from(result.mieiVoti),[],'no private vote for '+authorization);
    assert.equal(result.blocco.isBlocked,false);
  }
  assert.equal(x.counts().votes,1,'invalid auth must not trigger any personal vote query');
  assert.equal(x.cooldown.length,1,'invalid auth must not read personal cooldown state');
});

test('empty votes pass null fallback, without a separate MAX query',async()=>{
  const x=makeHarness({initialColumns:['user_id','data_voto']});
  const response=await x.get('no-votes');
  assert.equal(response.blocco.isBlocked,false);
  assert.deepEqual(Array.from(response.mieiVoti),[]);
  assert.equal(x.cooldown[0].fallbackChangedAt,null);
  assert.deepEqual(x.counts(),{metadata:1,votes:1,total:3});
});

test('revoked political consent hides historic Grazia votes and cooldown without additional SQL',async()=>{
  const x=makeHarness({consentGranted:false});
  const response=await x.get('a');
  assert.equal(response.success,true,'public catalogue remains available');
  assert.deepEqual(Array.from(response.mieiVoti),[],
    'historic private preference remains hidden after consent revocation');
  assert.equal(response.blocco.isBlocked,false);
  assert.equal(response.blocco.unlockDate,null);
  assert.deepEqual(x.counts(),{metadata:1,votes:1,total:3},
    'same personal vote query checks consent, no extra SQL round trip');
  assert.equal(x.cooldown.length,0,'private cooldown must not be disclosed');
});

test('inactive account cannot receive prior votes or cooldown after valid signed access token',async()=>{
  const x=makeHarness({accountActive:false});
  const response=await x.get('a');
  assert.equal(response.success,true,'public ranking remains readable');
  assert.deepEqual(Array.from(response.mieiVoti),[]);
  assert.equal(response.blocco.isBlocked,false);
  assert.equal(response.blocco.unlockDate,null);
  assert.deepEqual(x.counts(),{metadata:1,votes:1,total:3},'no extra SQL request');
  assert.equal(x.cooldown.length,0,'inactive account must not read private cooldown');
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
