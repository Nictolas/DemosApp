'use strict';
// Source-level check: www.demos.community/attivisti must have exactly one
// implementation. Vite resolves ./pages/Attivisti to Attivisti.tsx.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('the /attivisti route mounts the only maintained directory implementation',()=>{
  assert.equal(fs.existsSync(path.join(root,'client/src/pages/Attivisti/index.tsx')),false,
    'unused duplicate must not return');
  const page=read('client/src/pages/Attivisti.tsx');
  const app=read('client/src/App.tsx');
  assert.match(app,/import Attivisti from "\.\/pages\/Attivisti"/);
  assert.equal((app.match(/import Attivisti from /g)||[]).length,1);
  assert.match(app,/<Attivisti \/>/);
  assert.match(page,/useApprovedSubjectResumeRefresh\("attivisti"/);
  assert.match(page,/useApprovedDirectoryPagination\("attivisti"/);
  assert.match(page,/getApiUrl\(`\/api\/attivisti/);
  assert.match(page,/Attivisti segnalati e approvati/);
  assert.match(page,/<ProposeSubjectButton category="attivisti"/);
});

test('no source file directly imports the deleted directory/index module',()=>{
  const roots=['client/src','api','scripts'];
  const stale=[];
  // Limit inspection to repository source; never traverse installed dependencies.
  function visit(rel){
    const full=path.join(root,rel);
    if(!fs.existsSync(full))return;
    for(const item of fs.readdirSync(full,{withFileTypes:true})){
      if(['node_modules','dist','.git','.cache'].includes(item.name))continue;
      const file=path.join(rel,item.name);
      if(item.isDirectory()){visit(file);continue;}
      if(!item.isFile()||!/[.](?:[cm]?js|jsx|ts|tsx)$/.test(item.name)||file===testPath)continue;
      const content=fs.readFileSync(path.join(root,file),'utf8');
      // Static and dynamic imports; a general "Attivisti" import resolves
      // to the active Attivisti.tsx, whereas "/Attivisti/index" is obsolete.
      const explicit=/(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\(|\bimport\s*)['"][^'"]*\/Attivisti\/index(?:\.[cm]?[jt]sx?)?['"]/;
      if(explicit.test(content))stale.push(file);
    }
  }
  roots.forEach(visit);
  assert.deepEqual(stale,[], 'all direct imports must point to the active component');
});
