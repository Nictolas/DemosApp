'use strict';
// DEMOS12 isolated client hook tests: synthetic errors only, no browser/network/database.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require(path.resolve(__dirname,'../../client/node_modules/typescript'));
const root=path.resolve(__dirname,'../..');
const PRIVATE='SQL detail: secret-person, user-email@sample.test, personal-vote-choice';
const ADMIN='33333333-3333-4333-8333-333333333333';

function compile(relative) {
  const filename=path.join(root,relative);
  const source=fs.readFileSync(filename,'utf8');
  return ts.transpileModule(source,{
    fileName:filename,compilerOptions:{
      module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,
      esModuleInterop:true
    }
  }).outputText;
}
function load(relative,dependencies,globals={}) {
  const module={exports:{}};
  const filename=path.join(root,relative);
  vm.runInNewContext(compile(relative),{
    module,exports:module.exports,
    require:name=>{
      if(!(name in dependencies))throw Error('Unexpected dependency '+name);
      return dependencies[name];
    },
    console:new Proxy({}, {get(_obj,key){return ()=>{throw Error('Private log '+String(key))}}}),
    ...globals
  },{filename});
  return module.exports;
}
function adminHarness(failureMode='throw') {
  const queries=[],mutations=[],toasts=[],calls=[];
  const react={
    useState:initial=>[initial,()=>{}],
    createElement:(element,props,...children)=>({element,props:props||{},children})
  };
  const ui=new Proxy({}, {get(_obj,key){return String(key)}});
  const apiRequest=async(method,url,body)=>{
    calls.push({method,url,body});
    if(failureMode==='throw')throw Error(PRIVATE);
    return {ok:true,data:{success:false,error:PRIVATE}};
  };
  const result=load('client/src/pages/GestisciGrazia.tsx',{
    react,
    '@/hooks/use-auth':{useAuth:()=>({user:{id:ADMIN,is_admin:true},isLoading:false})},
    wouter:{Redirect:'Redirect',useLocation:()=>['/gestisci-grazia',()=>{}]},
    '@/lib/admin-access':{hasAdminCapability:()=>true},
    '@/components/ui/card':ui,
    '@/components/ui/button':ui,
    'lucide-react':ui,
    '@tanstack/react-query':{
      useInfiniteQuery:options=>{
        queries.push(options);
        return {data:undefined,isLoading:false,isError:queries.length===1,error:new Error(PRIVATE),
          hasNextPage:false,isFetchingNextPage:false,isFetchNextPageError:false};
      },
      useMutation:options=>{mutations.push(options);return {isPending:false}},
      useQueryClient:()=>({invalidateQueries:()=>{},resetQueries:()=>{}})
    },
    '@/lib/queryClient':{apiRequest},
    '@/hooks/use-toast':{useToast:()=>({toast:x=>toasts.push(x)})},
    '@/components/ui/input':{Input:'Input'}
  });
  const tree=result.default();
  return {queries,mutations,toasts,calls,tree};
}
function flattenTree(node) {
  if(node==null||typeof node==='boolean')return '';
  if(typeof node==='string'||typeof node==='number')return String(node);
  if(Array.isArray(node))return node.map(flattenTree).join(' ');
  return flattenTree(node.children);
}
for(const mode of ['throw','success-false']) {
  test('Admin Grazia redacts all GET and moderation POST failures: '+mode,async()=>{
    const app=adminHarness(mode);
    assert.equal(app.queries.length,3);
    assert.equal(app.mutations.length,2);
    const rendered=flattenTree(app.tree);
    assert.doesNotMatch(rendered,/SQL detail|secret-person|personal-vote-choice/);
    assert.match(rendered,/Coda richieste non disponibile/);
    for(const [i,expected] of [
      [0,'Coda richieste non disponibile. Riprova più tardi.'],
      [1,'Pubblicazioni temporaneamente non disponibili.'],
      [2,'Verifica avvisi non disponibile.']
    ]) {
      await assert.rejects(app.queries[i].queryFn({pageParam:null}),e=>{
        assert.equal(e.message,expected);
        assert.doesNotMatch(e.message,/secret-person|SQL detail/);
        return true;
      });
    }
    await assert.rejects(app.mutations[0].mutationFn({
      id:'synthetic-withdraw-1',note:'Motivazione sintetica'
    }),e=>e.message==='Ritiro non riuscito. Riprova più tardi.');
    await assert.rejects(app.mutations[1].mutationFn({
      id:'synthetic-approve-1',action:'accetta'
    }),e=>e.message==='Decisione non applicata. Riprova più tardi.');
    // react-query can also deliver arbitrary errors after a rejected mutation.
    app.mutations[0].onError(new Error(PRIVATE));
    app.mutations[1].onError(new Error(PRIVATE));
    assert.equal(app.toasts.length,2);
    assert.deepEqual(app.toasts.map(x=>x.description),[
      'Ritiro non riuscito. Riprova più tardi.',
      'Decisione non applicata. Riprova più tardi.'
    ]);
    assert.doesNotMatch(app.toasts.map(x=>x.description).join(' '),/secret-person|SQL detail/);
    assert.equal(app.calls.length,5);
  });
}
for(const mode of ['throw','success-false']){
  test('legacy Grazia proposal handler never reflects private backend error in toast: '+mode,async()=>{
    const toasts=[];
    const mod=load('client/src/pages/Grazia/hooks/useGraziaVoting.ts',{
      react:{useState:initial=>[initial,()=>{}],useEffect:()=>{}},
      '@/hooks/use-toast':{useToast:()=>({toast:x=>toasts.push(x)})},
      '@/config/votingLimits':{
        getVotingLimit:()=>1,hasReachedVotingLimit:()=>false,getRemainingVotes:()=>1
      },
      '@tanstack/react-query':{useQueryClient:()=>({})},
      '@/lib/queryClient':{apiRequest:async()=>{
        if(mode==='throw')throw Error(PRIVATE);
        return {ok:true,data:{success:false,error:PRIVATE}};
      }},
      '../constants/schema':{}
    });
    const h=mod.useGraziaVoting(undefined,{isPending:false,mutate:()=>{}});
    await h.handleCreateCarcerato({nome:'synthetic-person',urlProva:'https://example.org'});
    assert.equal(toasts.length,1);
    assert.equal(toasts[0].description,'Impossibile registrare la proposta. Riprova più tardi.');
    assert.doesNotMatch(toasts[0].description,/secret-person|SQL detail/);
  });
}
