'use strict';
// Real Grazia hook transpiled and executed with synthetic React state.
// No real identity, network access, browser storage, PostgreSQL or votes.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require(path.resolve(__dirname,'../../client/node_modules/typescript'));
const root=path.resolve(__dirname,'../..');

test('Grazia gates private hooks on authentication and remounts on account change',()=>{
  const page=fs.readFileSync(path.join(root,'client/src/pages/Grazia/index.tsx'),'utf8');
  assert.match(page,/if \(!authReady \|\| isLoading\)/);
  assert.match(page,/if \(!user\) return <Redirect to="\/auth" \/>/);
  assert.match(page,/return <GraziaAuthenticated key=\{user\.id\} user=\{user\} \/>/);
  const child=page.split('function GraziaAuthenticated(')[1];
  assert.ok(child,'private voting must be in keyed account subtree');
  assert.match(child,/useGraziaData\(user\)/);
  assert.match(child,/useGraziaVoting\(data, saveVotiMutation\)/);
  assert.doesNotMatch(page.split('function GraziaAuthenticated(')[0],/useGraziaData\(user\)/);
});

test('Grazia clicks mutate immediately, never after a deferred callback or from an updater',()=>{
  const filename=path.join(root,'client/src/pages/Grazia/hooks/useGraziaVoting.ts');
  const source=fs.readFileSync(filename,'utf8');
  assert.doesNotMatch(source,/setTimeout\(/);
  const js=ts.transpileModule(source,{
    fileName:filename,compilerOptions:{
      module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
      esModuleInterop:true
    }
  }).outputText;
  const states=[];
  const effects=[];
  let pointer=0;
  const actualMutations=[];
  const fakeReact={
    useState(initial){
      const index=pointer++;
      if(!(index in states))states[index]=initial;
      return [states[index],update=>{
        states[index]=typeof update==='function'?update(states[index]):update;
      }];
    },
    useEffect:callback=>{ effects.push(callback); }
  };
  const toast=()=>{};
  const dependencies={
    react:fakeReact,
    '@/hooks/use-toast':{useToast:()=>({toast})},
    '@/config/votingLimits':{
      getVotingLimit:()=>1,
      hasReachedVotingLimit:(_category,count)=>count>=1,
      getRemainingVotes:(_category,count)=>1-count
    },
    '@tanstack/react-query':{useQueryClient:()=>({})},
    '@/lib/queryClient':{apiRequest:async()=>{throw Error('No network allowed')}}
  };
  const m={exports:{}};
  vm.runInNewContext(js,{
    module:m,exports:m.exports,
    require:key=>{
      if(!(key in dependencies))throw Error('Unexpected import '+key);
      return dependencies[key];
    },
    setTimeout:()=>{throw Error('Deferred private vote submission')},
    console:new Proxy({}, {get:()=>()=>{throw Error('Private logging')}})
  },{filename});
  const data={classifica:[{nome:'Synthetic approved subject'}],mieiVoti:[],blocco:{isBlocked:false}};
  const mutation={isPending:false,mutate:votes=>actualMutations.push(Array.from(votes))};
  const render=()=>{pointer=0;effects.length=0;return m.exports.useGraziaVoting(data,mutation)};
  let hook=render();
  hook.updateField('nomeInput','Synthetic approved subject');
  hook=render();
  hook.addNomeLocal({preventDefault(){}});
  assert.deepEqual(actualMutations,[['Synthetic approved subject']]);
  hook=render();
  hook.toggleSelezioneClassifica('Synthetic approved subject');
  assert.deepEqual(actualMutations.at(-1),[]);
  hook=render();
  hook.toggleSelezioneClassifica('Synthetic approved subject');
  assert.deepEqual(actualMutations.at(-1),['Synthetic approved subject']);
  hook=render();
  hook.removeLocal('Synthetic approved subject');
  hook=render();
  hook.confirmRemove();
  assert.deepEqual(actualMutations.at(-1),[]);
  assert.equal(actualMutations.length,4);

  // After an optimistic toggle, a rejected POST must restore the original
  // personal preference from the successful GET without another mutation.
  hook=render();
  hook.toggleSelezioneClassifica('Synthetic approved subject');
  assert.deepEqual(Array.from(states[0].selectedVoti),['Synthetic approved subject']);
  assert.equal(actualMutations.length,5);
  mutation.isError=true; // simulate a cooldown/HTTP rejection
  hook=render();
  assert.equal(effects.length,2,'sync and failure rollback effects must be registered');
  effects[1]();
  hook=render();
  assert.deepEqual(Array.from(hook.votingState.selectedVoti),[],
    'after failure the UI must not show a preference that the server rejected');
  assert.equal(actualMutations.length,5,'rollback must not send additional votes');
});
