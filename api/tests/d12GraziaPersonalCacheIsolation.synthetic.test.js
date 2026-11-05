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

function harness(){
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
      apiRequest:async(method,url,body)=>{
        events.requests.push({method,url,body});
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
  const data=await app.events.queries[0].queryFn();
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
