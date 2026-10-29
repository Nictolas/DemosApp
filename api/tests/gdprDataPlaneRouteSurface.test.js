'use strict';

// CI-only source audit of a bounded set of SQL entrypoints; no database/network.
// A passing test is NOT a production data-plane cutoff attestation.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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

test('cleanup and migration database pools remain dev/override-only, NOT covered by production safety proof',()=>{
  const app=read('app.js');
  assert.match(app,/const mountDevApiSurface = !isProductionApp \|\| process\.env\.ALLOW_DEV_API_SURFACE === 'true';/);
  assert.match(app,/if \(mountDevApiSurface\) \{\s*app\.use\('\/api\/migrations', migrationsRoutes\);\s*app\.use\('\/api\/cleanup', cleanupRoutes\);/);
  assert.match(read('routes/cleanup.js'),/new Pool\(\{/);
  assert.match(read('routes/migrations.js'),/new Pool\(\{/);
  // Production with ALLOW_DEV_API_SURFACE=true remains an explicit open risk.
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
