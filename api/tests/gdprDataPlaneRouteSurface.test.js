'use strict';

// CI-only source audit of a bounded set of SQL entrypoints; no database/network.
// A passing test is NOT a production data-plane cutoff attestation.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('production app never mounts the legacy direct-pool schema diagnostic',()=>{
  const app=read('app.js');
  assert.match(app,/const isProductionApp = process\.env\.NODE_ENV === 'production';/);
  assert.match(app,/if \(!isProductionApp\) \{\s*app\.use\('\/api', databaseRoutes\);\s*\}/);
  assert.equal((app.match(/app\.use\('\/api', databaseRoutes\)/g)||[]).length,1);
  const route=read('routes/database.js');
  assert.match(route,/router\.get\('\/check-table-structure'/);
  assert.match(route,/new Pool\(\{/);
  // Inventory: this proves the conditional mount, not that direct connections
  // have been removed from every other code path.
});

test('health SQL diagnostic is never routed when NODE_ENV is production',()=>{
  const source=read('routes/health.js');
  assert.match(source,/if \(process\.env\.NODE_ENV !== 'production'\) \{\s*router\.get\('\/test-db'/);
  assert.equal((source.match(/router\.get\('\/test-db'/g)||[]).length,1);
  // Runtime tests additionally verify 404 and zero database connection.
});

test('legacy SQL migrations and cleanup are guarded by non-production only',()=>{
  const app=read('app.js');
  assert.match(app,/const mountDevApiSurface = !isProductionApp \|\| process\.env\.ALLOW_DEV_API_SURFACE === 'true';/);
  assert.match(app,/if \(!isProductionApp\) \{\s*app\.use\('\/api\/migrations', migrationsRoutes\);\s*app\.use\('\/api\/cleanup', cleanupRoutes\);\s*app\.use\('\/api\/cleanup', cleanupRateLimitRoutes\);\s*\}/);
  for(const segment of [
    "app.use('/api/migrations', migrationsRoutes)",
    "app.use('/api/cleanup', cleanupRoutes)",
    "app.use('/api/cleanup', cleanupRateLimitRoutes)"
  ])assert.equal(app.split(segment).length,2,segment);
  assert.match(read('routes/cleanup.js'),/new Pool\(\{/);
  assert.match(read('routes/migrations.js'),/new Pool\(\{/);
  // This prevents the known legacy routes from being mounted through the
  // override flag. It is not a complete provider admission barrier.
});

test('executed maintenance mount block is fail-closed for production with any dev override',()=>{
  const app=read('app.js');
  const from=app.indexOf('// Legacy SQL migrations/cleanup are never mounted in production,');
  const to=app.indexOf('// Gestione errori 404',from);
  assert.ok(from>=0&&to>from,'Maintenance mount block must remain auditable');
  const fragment=app.slice(from,to);
  const scenarios=[
    {name:'production default',isProductionApp:true,mountDevApiSurface:false,expected:[]},
    {name:'production override set',isProductionApp:true,mountDevApiSurface:true,expected:[['/api/test','test']]},
    {name:'non-production',isProductionApp:false,mountDevApiSurface:true,
      expected:[['/api/migrations','migrations'],['/api/cleanup','cleanup'],
        ['/api/cleanup','cleanup-limiter'],['/api/test','test']]}
  ];
  for(const scenario of scenarios){
    const actual=[];
    const context={
      isProductionApp:scenario.isProductionApp,
      mountDevApiSurface:scenario.mountDevApiSurface,
      migrationsRoutes:'migrations',cleanupRoutes:'cleanup',
      cleanupRateLimitRoutes:'cleanup-limiter',testRateLimitRoutes:'test',
      app:{use:(prefix,route)=>actual.push([prefix,route])},
      console:{log:()=>{}}
    };
    vm.runInNewContext(fragment,context,{timeout:1000,filename:'app-maintenance-mounts.js'});
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),scenario.expected,scenario.name);
  }
});

test('independent SQL constructors exist beyond canonical pool: full ingress audit still required',()=>{
  assert.match(read('config/database.js'),/let poolInstance = null/);
  assert.match(read('config/db.js'),/const pool = new Pool\(config\)/);
  assert.match(read('routes/categorie.js'),/const pool = new Pool\(\{/);
  // Do NOT assume the legacy categories router is mounted on the live app.
  // Search only proves presence of source, not execution or deployment.
});

test('no synthetic recovery confidence may be promoted into production readiness',()=>{
  const worker=read('services/privacyErasureOutboxWorker.js');
  assert.match(worker,/recoveryReady:\s*false/);
  assert.doesNotMatch(worker,/recoveryReady:\s*true/);
});
