'use strict';
// Runtime verification of the real client hook with synthetic React Query,
// TypeScript transpilation and zero network, browser storage or personal data.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require(path.resolve(__dirname,'../../client/node_modules/typescript'));

const filename=path.resolve(__dirname,'../../client/src/pages/Grazia/hooks/useGraziaData.ts');
const source=fs.readFileSync(filename,'utf8');
const javascript=ts.transpileModule(source,{
  fileName:filename,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function harness(failure=null,{holdGet=false}={}){
  const events={queries:[],mutations:[],invalidated:[],requests:[],toasts:[]};
  const queryClient={invalidateQueries:q=>events.invalidated.push(q)};
  const response={success:true,mieiVoti:['Persona approvata sintetica'],
    classifica:[{nome:'Persona approvata sintetica'}],blocco:{isBlocked:false}};
  const module={exports:{}};
  const modules={
    '@tanstack/react-query':{
      useQuery:options=>{events.queries.push(options);return {data:undefined,isLoading:false,error:null}},
      useMutation:options=>{events.mutations.push(options);return {isPending:false}},
      useQueryClient:()=>queryClient
    },
    '@/lib/queryClient':{
      apiRequest:async(method,url,body,_headers,signal)=>{
        events.requests.push({method,url,body,signal});
        if(method==='GET' && holdGet) {
          return new Promise((_resolve,reject)=>{
            const abort=()=>reject(new Error('Synthetic request aborted; no data returned'));
            if(signal?.aborted) abort();
            else signal?.addEventListener('abort',abort,{once:true});
          });
        }
        if(failure)throw new Error(failure);
        return {ok:true,data:response};
      }
    },
    '@/hooks/use-toast':{useToast:()=>({toast:opts=>events.toasts.push(opts)})},
    '@/config/votingLimits':{getRemainingVotes:()=>4}
  };
  vm.runInNewContext(javascript,{
    exports:module.exports,module,require(name){
      if(!(name in modules))throw new Error('Unexpected dependency '+name);
      return modules[name];
    },
    localStorage:{getItem:key=>key==='auth_token'?'synthetic-present-token':null},
    console:new Proxy({}, {get(_target,key){return ()=>{throw Error('Private browser logging: '+String(key))}}})
  },{filename});
  return {useGraziaData:module.exports.useGraziaData,events,response};
}

test('personal Grazia React Query cache keys are isolated by verified account ID',async()=>{
  const app=harness();
  const alice='11111111-1111-4111-8111-111111111111';
  const bob='22222222-2222-4222-8222-222222222222';
  app.useGraziaData({id:alice});
  app.useGraziaData({id:bob});
  app.useGraziaData(null);
  assert.deepEqual(Array.from(app.events.queries[0].queryKey),['graziaData',alice]);
  assert.deepEqual(Array.from(app.events.queries[1].queryKey),['graziaData',bob]);
  assert.deepEqual(Array.from(app.events.queries[2].queryKey),['graziaData',null]);
  assert.notDeepEqual(Array.from(app.events.queries[0].queryKey),Array.from(app.events.queries[1].queryKey));
  assert.equal(app.events.queries[0].enabled,true);
  assert.equal(app.events.queries[1].enabled,true);
  assert.equal(app.events.queries[2].enabled,false);
  for(const q of app.events.queries) {
    assert.equal(q.gcTime,0,'private vote data must not remain in an inactive cache');
  }
  const controller=new AbortController();
  const data=await app.events.queries[0].queryFn({signal:controller.signal});
  assert.equal(app.events.requests[0].signal,controller.signal);
  assert.equal(data,app.response);
  assert.deepEqual(app.events.requests.map(r=>[r.method,r.url]),[['GET','/api/grazia']]);
});
test('after saving a synthetic vote, invalidate only the initiating user cache, never all users',async()=>{
  const app=harness();
  const alice='11111111-1111-4111-8111-111111111111';
  const bob='22222222-2222-4222-8222-222222222222';
  app.useGraziaData({id:alice});
  app.useGraziaData({id:bob});
  await app.events.mutations[0].mutationFn(['Persona approvata sintetica']);
  app.events.mutations[0].onSuccess({success:true},['Persona approvata sintetica']);
  assert.deepEqual(Array.from(app.events.invalidated[0].queryKey),['graziaData',alice]);
  assert.equal(app.events.invalidated.length,1);
  assert.equal(app.events.requests[0].method,'POST');
  assert.equal(app.events.requests[0].url,'/api/grazia/vota');
  assert.deepEqual(Array.from(app.events.requests[0].body.voti),['Persona approvata sintetica']);
  assert.equal(app.events.toasts[0].title,'Preferenze salvate');
});
test('synthetic error notifications do not log vote names, responses or raw exceptions',()=>{
  const app=harness();
  app.useGraziaData({id:'11111111-1111-4111-8111-111111111111'});
  app.events.mutations[0].onError(new Error('Impossibile salvare le richieste di grazia.'));
  assert.equal(app.events.toasts[0].title,'Errore');
  assert.equal(app.events.toasts[0].variant,'destructive');
});

test('synthetic API error with private details is redacted from GET, POST and toast',async()=>{
  const fabricated='server SQL detail: person Doe, user 123, private vote against candidate';
  const app=harness(fabricated);
  app.useGraziaData({id:'11111111-1111-4111-8111-111111111111'});
  await assert.rejects(app.events.queries[0].queryFn({signal:new AbortController().signal}),error=>{
    assert.equal(error.message,'Impossibile caricare la classifica. Riprova più tardi.');
    assert.doesNotMatch(error.message,/Doe|SQL|vote/);
    return true;
  });
  await assert.rejects(app.events.mutations[0].mutationFn(['Soggetto sintetico']),error=>{
    assert.equal(error.message,'Impossibile salvare le richieste di grazia.');
    assert.doesNotMatch(error.message,/Doe|SQL|vote/);
    return true;
  });
  app.events.mutations[0].onError(new Error(fabricated));
  assert.equal(app.events.toasts[0].description,'Impossibile salvare le richieste di grazia.');
  assert.doesNotMatch(app.events.toasts[0].description,/Doe|SQL|vote/);
});

test('abandoning the Grazia account aborts in-flight personal GET with a neutral error',async()=>{
  const app=harness(null,{holdGet:true});
  app.useGraziaData({id:'11111111-1111-4111-8111-111111111111'});
  const controller=new AbortController();
  const inFlight=app.events.queries[0].queryFn({signal:controller.signal});
  assert.equal(app.events.requests.length,1);
  assert.equal(app.events.requests[0].signal,controller.signal);
  controller.abort();
  await assert.rejects(inFlight,error=>{
    assert.equal(error.message,'Impossibile caricare la classifica. Riprova più tardi.');
    assert.doesNotMatch(error.message,/Synthetic request|aborted/);
    return true;
  });
  assert.equal(app.events.queries[0].gcTime,0);
  assert.equal(app.events.toasts.length,0);
  assert.equal(app.events.requests.some(r=>r.method==='POST'),false);
});
