'use strict';
// Isolated middleware contract: NO database, Redis, JWT secret or real account.
// Replaces dependencies before loading the actual verifyToken implementation.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Opinions authentication admits canonical A and legacy a; refuses all inactive statuses',async()=>{
  const paths={
    auth:require.resolve(path.join(root,'middleware/auth.js')),
    jwt:require.resolve(path.join(root,'utils/jwt.js')),
    db:require.resolve(path.join(root,'config/database.js')),
    redis:require.resolve(path.join(root,'services/redisCache.js')),
    keys:require.resolve(path.join(root,'config/cacheKeys.js')),
    accounts:require.resolve(path.join(root,'services/accountCapabilitiesService.js'))
  };
  const oldCache=new Map(Object.values(paths).map(p=>[p,require.cache[p]]));
  const oldEnv=process.env.NODE_ENV;
  let userStatus='A',useCache=false,subjectLoads=0;
  const fakeSubject=()=>({
    id:'synthetic-opinions-subject',status:userStatus,legacyRole:'E',
    capabilities:{accountType:'P',isAdmin:false,isActivist:false,
      isCandidate:false,isPolitician:false}
  });
  const mock=(p,exports)=>{
    require.cache[p]={id:p,filename:p,loaded:true,exports};
  };
  try{
    process.env.NODE_ENV='production';
    mock(paths.jwt,{verifyAccessToken(token){
      if(token!=='synthetic-only')throw Error('invalid JWT');
      return {userId:'synthetic-opinions-subject',jti:'synthetic-token'};
    }});
    mock(paths.db,{getPool(){return {query(){throw Error('LIVE_SQL_FORBIDDEN');}};}});
    mock(paths.redis,{
      isEnabled(){return useCache;},
      async getJson(){return useCache?fakeSubject():null;},
      async setJson(){throw Error('NO_WRITES_IN_SYNTHETIC_TEST');}
    });
    mock(paths.keys,{keys:{authUser:()=> 'synthetic-cache-key'},
      ttl:{authUser:60}});
    mock(paths.accounts,{async getAccountSubject(_pool,userId){
      assert.equal(userId,'synthetic-opinions-subject');
      subjectLoads++;
      return fakeSubject();
    }});
    delete require.cache[paths.auth];
    const {verifyToken}=require(paths.auth);
    async function verify(status,{cache=false,auth='Bearer synthetic-only'}={}){
      userStatus=status;
      useCache=cache;
      const req={url:'/api/opinioni/check-missing/C',method:'GET',
        headers:auth?{authorization:auth}:{}};
      const result={status:200,json:null,next:0};
      const res={
        status(code){result.status=code;return this;},
        json(body){result.json=body;return this;}
      };
      await verifyToken(req,res,()=>{result.next++;});
      return {req,...result};
    }
    for(const status of ['A','a']){
      for(const cache of [false,true]){
        const x=await verify(status,{cache});
        assert.equal(x.status,200);
        assert.equal(x.next,1,'active account must reach catalog route');
        assert.equal(x.req.user?.id,'synthetic-opinions-subject');
        assert.equal(x.req.user?.status,status);
        assert.equal(x.req.userId,'synthetic-opinions-subject');
        assert.equal(x.req.user?.isAdmin,false,'auth must not escalate privileges');
      }
    }
    for(const status of ['x','X','P','',null,'ACTIVE','disabled']){
      for(const cache of [false,true]){
        const x=await verify(status,{cache});
        assert.equal(x.status,401,'inactive status must be denied');
        assert.equal(x.next,0,'inactive account cannot reach opinions');
        assert.equal(x.req.user,undefined);
        assert.equal(x.json?.error,'Account non attivo');
      }
    }
    const loadsBefore=subjectLoads;
    const missing=await verify('A',{auth:null});
    assert.equal(missing.status,401);
    assert.equal(missing.next,0);
    assert.equal(subjectLoads,loadsBefore,'missing auth must not read account');
    const invalid=await verify('A',{auth:'Bearer invalid'});
    assert.equal(invalid.status,401);
    assert.equal(invalid.next,0);
  }finally{
    process.env.NODE_ENV=oldEnv;
    for(const [p,previous] of oldCache){
      if(previous)require.cache[p]=previous;
      else delete require.cache[p];
    }
  }
});
