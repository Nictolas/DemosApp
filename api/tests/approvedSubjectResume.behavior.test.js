'use strict';
// Behavioral test of the real TS foreground-refresh hook, compiled with the
// existing client TypeScript dependency and executed with synthetic UI/network.
// No browser, Supabase, staging or real users required.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'client/node_modules/typescript'));
const source = fs.readFileSync(path.join(root, 'client/src/hooks/useApprovedSubjectResumeRefresh.ts'), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}
}).outputText;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes,no) => {resolve=yes; reject=no;});
  return {promise, resolve, reject};
}

function setup(initial = [{id:'old',title:'Nome da ritirare'}]) {
  let now=10000, state=initial, cleanup;
  const history=[], calls=[], refs=[];
  let refIndex=0;
  const byTarget = new Map();
  const eventTarget = name => ({
    addEventListener(event, fn) {
      const key=name+':'+event;
      const listeners=byTarget.get(key) || new Set();
      listeners.add(fn); byTarget.set(key,listeners);
    },
    removeEventListener(event, fn) {byTarget.get(name+':'+event)?.delete(fn);}
  });
  const document=Object.assign(eventTarget('document'),{visibilityState:'visible'});
  const window=eventTarget('window');
  const fakeModule={exports:{}};
  const react={
    useRef(initialValue) {
      const index=refIndex++;
      if (!refs[index]) refs[index]={current:initialValue};
      return refs[index];
    },
    useEffect(effect) {
      cleanup?.();
      cleanup=effect();
    }
  };
  const apiRequest=(method,url,body,headers,signal)=>{
    const response=deferred();
    calls.push({method,url,body,headers,signal,response});
    return response.promise;
  };
  const sandbox={
    module:fakeModule, exports:fakeModule.exports, document, window, AbortController,
    Promise, Set, Date:{now:()=>now},
    require(name) {
      if(name==='react') return react;
      if(name==='@/lib/queryClient') return {apiRequest};
      throw new Error('Unexpected import: '+name);
    }
  };
  vm.runInNewContext(javascript,sandbox,{filename:'useApprovedSubjectResumeRefresh.compiled.js'});
  const update=next=>{
    state=typeof next==='function'?next(state):next;
    history.push(state);
  };
  return {
    calls, history, document, window,
    get state(){return state;},
    mount(category='attivisti',enabled=true){
      refIndex=0;
      fakeModule.exports.useApprovedSubjectResumeRefresh(category,update,enabled);
    },
    rerender(category='attivisti',enabled=true){
      refIndex=0;
      fakeModule.exports.useApprovedSubjectResumeRefresh(category,update,enabled);
    },
    initialResponse(items){update(items);},
    fire(target,event){
      for(const fn of [...(byTarget.get(target+':'+event)||[])])fn();
    },
    advance(milliseconds){now+=milliseconds;},
    unmount(){cleanup?.();},
    success(call, items){
      call.response.resolve({json: async()=>({success:true,data:items})});
    },
    invalid(call){call.response.resolve({json:async()=>({success:false,data:[]})});},
    failure(call){call.response.reject(new Error('offline'));},
  };
}
async function flush() {
  // The hook awaits apiRequest and Response.json; two microtask cycles.
  await new Promise(setImmediate);
}

test('mount has no extra GET; foreground refresh hides old name and copies only ID/title', async()=>{
  const app=setup();
  app.mount('attivisti');
  assert.equal(app.calls.length,0,'mount must reuse initial directory read');
  app.fire('window','focus');
  assert.equal(app.calls.length,1);
  assert.equal(app.calls[0].method,'GET');
  assert.equal(app.calls[0].url,'/api/subject-proposals/approved?category=attivisti');
  assert.equal(app.state.length,0,'stale name removed synchronously, before fetch');
  app.fire('document','visibilitychange');
  assert.equal(app.calls.length,1,'focus+visibility deduplicated without polling');
  app.success(app.calls[0],[{id:'new',title:'Approvato',details:'private',source_url:'https://example.org'}]);
  await flush();
  assert.equal(app.state.length,1);
  assert.deepEqual(Object.keys(app.state[0]).sort(),['id','title']);
  assert.equal(app.state[0].title,'Approvato');
  app.unmount();
});

test('a late previous response cannot put withdrawn title back into state',async()=>{
  const app=setup();
  app.mount('organizzazioni');
  app.fire('window','focus');
  const first=app.calls[0];
  app.advance(2000);
  app.fire('window','focus');
  assert.equal(app.calls.length,2,'one request for each distinct resume');
  assert.equal(first.signal.aborted,true,'stale transport must be aborted');
  const latest=app.calls[1];
  app.success(latest,[]);
  await flush();
  assert.equal(app.state.length,0,'withdrawn list stays empty');
  app.success(first,[{id:'withdrawn',title:'Non pubblicabile'}]);
  await flush();
  assert.equal(app.state.length,0,'late response must never resurrect title');
  app.unmount();
});

test('offline, invalid JSON and hidden background do not resurrect old entries',async()=>{
  const app=setup();
  app.mount('organizzazioni');
  app.document.visibilityState='hidden';
  app.fire('document','visibilitychange');
  assert.equal(app.calls.length,0,'hidden tab must not fetch');
  app.document.visibilityState='visible';
  app.fire('document','visibilitychange');
  assert.equal(app.calls.length,1);
  app.failure(app.calls[0]);
  await flush();
  assert.equal(app.state.length,0,'fail closed on offline');
  app.advance(2000);
  app.fire('window','focus');
  app.invalid(app.calls[1]);
  await flush();
  assert.equal(app.state.length,0,'fail closed on invalid response');
  app.unmount();
});

test('cleanup aborts pending GET and removes both listeners',async()=>{
  const app=setup();
  app.mount('attivisti');
  app.fire('window','focus');
  const first=app.calls[0];
  app.unmount();
  assert.equal(first.signal.aborted,true);
  app.advance(2000);
  app.fire('window','focus');
  app.fire('document','visibilitychange');
  assert.equal(app.calls.length,1,'unmounted hook must not call API');
  app.success(first,[{id:'old',title:'Should not return'}]);
  await flush();
  assert.equal(app.state.length,0,'unmounted hook must not rehydrate personal data');
});

test('disabled hook never registers listeners or runs queries',()=>{
  const app=setup();
  app.mount('attivisti',false);
  app.fire('window','focus');
  app.fire('document','visibilitychange');
  assert.equal(app.calls.length,0);
});

test('foreground event during the initial GET is remembered and rechecked once after load',async()=>{
  const app=setup([]);
  app.mount('organizzazioni',false); // initial directory GET is still in progress
  app.fire('window','focus');
  app.fire('document','visibilitychange');
  assert.equal(app.calls.length,0,'no extra GET while initial list is loading');

  // An old server response can still contain a subject withdrawn during load.
  app.initialResponse([{id:'withdrawn',title:'Vecchia organizzazione'}]);
  app.rerender('organizzazioni',true);
  assert.equal(app.calls.length,1,'one deferred revalidation on ready transition');
  assert.equal(app.calls[0].url,'/api/subject-proposals/approved?category=organizzazioni');
  assert.equal(app.state.length,0,'stale initial data hidden immediately');
  app.success(app.calls[0],[]);
  await flush();
  assert.equal(app.state.length,0,'the withdrawn name must not return');
  app.unmount();
});

test('becoming ready without a preceding focus event does not add SQL reads',()=>{
  const app=setup([]);
  app.mount('organizzazioni',false);
  app.initialResponse([{id:'approved',title:'Soggetto approvato'}]);
  app.rerender('organizzazioni',true);
  assert.equal(app.calls.length,0,'normal mount/ready must not double-fetch');
  app.unmount();
});

test('filter reload aborts foreground GET but rechecks after its older response',async()=>{
  const app=setup([]);
  app.mount('organizzazioni',true);
  app.fire('window','focus');
  assert.equal(app.calls.length,1);
  const first=app.calls[0];
  app.rerender('organizzazioni',false); // new search/filter load
  assert.equal(first.signal.aborted,true,'in-flight foreground GET canceled on reload');
  app.initialResponse([{id:'withdrawn',title:'Voce ritirata durante la ricerca'}]);
  app.rerender('organizzazioni',true);
  assert.equal(app.calls.length,2,'one new GET after stale filter response');
  assert.equal(app.state.length,0,'old filter result hidden before network response');
  app.success(app.calls[1],[]);
  await flush();
  app.success(first,[{id:'withdrawn',title:'Vecchia risposta focus'}]);
  await flush();
  assert.equal(app.state.length,0,'older foreground response cannot reintroduce name');
  app.unmount();
});
