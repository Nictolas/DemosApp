'use strict';
// The 94 official questions belong to the published JS catalog. Runtime API
// modules must never reintroduce SQL/ORM access to opinioni_domande. The
// initial-cutover, read-only preflight script is deliberately OUT of scope.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const scanDirs=['routes','services','utils','middleware','jobs','controllers'];

function allRuntimeModules(dir){
  if(!fs.existsSync(dir))return [];
  const files=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){
      if(!['node_modules','dist','.git','test','tests','__tests__'].includes(entry.name))
        files.push(...allRuntimeModules(full));
    }else if(entry.isFile() && /\.(?:cjs|mjs|js)$/.test(entry.name)){
      files.push(full);
    }
  }
  return files;
}

function withoutComments(src){
  // Static regression only: remove block and line comments, not actual JS
  // strings (SQL is frequently embedded in strings or template literals).
  return src.replace(/\/\*[\s\S]*?\*\//g,'')
    .split('\n')
    .filter(line=>!/^\s*\/\//.test(line))
    .map(line=>line.replace(/\s+\/\/.*$/,''))
    .join('\n');
}

test('every runtime API module uses release-managed catalog, not old table',()=>{
  const files=scanDirs.flatMap(dir=>allRuntimeModules(path.join(root,dir)));
  assert.ok(files.length>20,'scan must include actual backend routes and services');
  for(const file of files){
    const source=withoutComments(fs.readFileSync(file,'utf8'));
    assert.doesNotMatch(source,/\bopinioni_domande\b/i,
      'Runtime catalog SQL/reference is forbidden: '+path.relative(root,file));
  }
});

test('the one-time read-only cutover preflight remains the explicit exception',()=>{
  const preflight=fs.readFileSync(path.join(root,'scripts/checkOpinionCatalogParity.js'),'utf8');
  assert.match(preflight,/FROM public\.opinioni_domande/);
  assert.match(preflight,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.doesNotMatch(preflight,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\s+(?:INTO\s+|FROM\s+)?public\.opinioni_domande/i);
});

test('published catalog is loaded from versioned JSON without any database import',()=>{
  const module=fs.readFileSync(path.join(root,'services/opinionCatalog.js'),'utf8');
  assert.match(module,/catalog\/opinions-part-0/);
  assert.doesNotMatch(withoutComments(module),/\b(?:pool|client)\.query\s*\(/);
});
