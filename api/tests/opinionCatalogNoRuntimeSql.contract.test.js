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
// One-time maintenance script that intentionally deletes historical duplicates
// and creates an index on the legacy table. It is never imported by the API.
// Exclude this exact path, not the whole utils directory: runtime helpers
// must still be checked whenever they are added or changed.
const maintenanceOnly=new Set(['utils/add-unique-constraint-opinioni.cjs']);

function allRuntimeModules(dir){
  if(!fs.existsSync(dir))return [];
  const files=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){
      if(!['node_modules','dist','.git','test','tests','__tests__'].includes(entry.name))
        files.push(...allRuntimeModules(full));
    }else if(entry.isFile() && /\.(?:cjs|mjs|js)$/.test(entry.name) &&
      !maintenanceOnly.has(path.relative(root,full).split(path.sep).join('/'))){
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

test('legacy maintenance script is explicitly excluded, but runtime utils remain scanned',()=>{
  const maintenance=path.join(root,'utils/add-unique-constraint-opinioni.cjs');
  const scanned=allRuntimeModules(path.join(root,'utils'));
  if(fs.existsSync(maintenance)){
    assert.match(fs.readFileSync(maintenance,'utf8'),/DELETE FROM opinioni_domande/);
    assert.ok(!scanned.includes(maintenance),
      'One-off migration must not be reported as an active API module');
  }
  // Excluding the maintenance script must NOT blanket-exclude utils.
  assert.ok(scanned.some(file=>file.endsWith('opinionStatsColumns.js')),
    'Production utils must remain covered by the legacy-SQL guard');
  // Do not let any runtime module import the excluded, database-mutating
  // maintenance script. Excluding it from text scanning is safe only while
  // it stays out of the application's module dependency graph.
  const runtime=scanDirs.flatMap(dir=>allRuntimeModules(path.join(root,dir)));
  for(const file of runtime){
    assert.doesNotMatch(withoutComments(fs.readFileSync(file,'utf8')),
      /(?:require\s*\(|import\s*\(|from\s+['"])[^\n]*add-unique-constraint-opinioni/,
      'A runtime module must never import the legacy migration script');
  }
});

test('SQL guard detects executable legacy catalog reads but ignores comments',()=>{
  const active=withoutComments("const sql=\`SELECT id FROM opinioni_domande\`;");
  const commented=withoutComments(
    "// SELECT id FROM opinioni_domande\nconst safe=true;");
  assert.match(active,/\bopinioni_domande\b/i);
  assert.doesNotMatch(commented,/\bopinioni_domande\b/i);
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
