'use strict';
// Check the actual Express mounting chain. A standalone test of a router
// that is not mounted by api/app.js cannot certify the production API.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');

test('the live /api/opinioni-list and public revision are on the mounted router',()=>{
  const app=source('app.js');
  const active=source('routes/compatibility.js');
  assert.match(app,/compatibilityRoutes\s*=\s*require\(['"]\.\/routes\/compatibility['"]\)/);
  assert.match(app,/app\.use\(['"]\/api['"],\s*compatibilityRoutes\)/);
  assert.match(active,/router\.get\(['"]\/opinioni-list['"]/);
  assert.match(active,/router\.get\(['"]\/opinioni-catalog-revision['"]/);
  assert.match(active,/getOpinionsForGrade\(normalizedGrade\)/);
  assert.match(active,/getOpinionCatalogRevision\(\)/);
  assert.match(active,/id:\s*opinion\.id/);
  assert.doesNotMatch(active,/\b(?:FROM|JOIN)\s+(?:public\.)?opinioni_domande\b/i);
});

test('nested legacy Opinions compatibility helper is NOT mounted by the running app',()=>{
  const app=source('app.js');
  const index=source('routes/opinioni/index.js');
  assert.match(app,/opinioniRoutes\s*=\s*require\(['"]\.\/routes\/opinioni\/index['"]\)/);
  assert.match(app,/app\.use\(['"]\/api\/opinioni['"],\s*userLimiter,\s*opinioniRoutes\)/);
  assert.doesNotMatch(index,/require\(['"]\.\/compatibility['"]\)/);
  assert.doesNotMatch(index,/router\.use\([^,]+,\s*compatibilityRoutes\)/);
  assert.doesNotMatch(app,/require\(['"]\.\/routes\/opinioni\/compatibility['"]\)/);
});

test('the active catalog endpoint rejects missing grades before any user/answer SQL',()=>{
  const active=source('routes/compatibility.js');
  const badGrade=active.indexOf("typeof grado !== 'string' || !grado.trim()");
  const userQuery=active.indexOf('const userResult = await pool.query(userSql');
  assert.ok(badGrade>=0 && userQuery>badGrade,
    'invalid grades must be rejected before the personal DB query');
  assert.match(active,/user\.status !== 'A' && user\.status !== 'a'/);
  assert.match(active,/FROM opinioni_risposte a/);
  assert.doesNotMatch(active,/SELECT\s+\*\s+FROM\s+opinioni_risposte/i);
});

test('all personal answers remain on protected live paths, not public revision',()=>{
  const active=source('routes/compatibility.js');
  const rev=active.slice(active.indexOf("router.get('/opinioni-catalog-revision'"),
    active.indexOf("router.get('/opinioni-list'"));
  assert.doesNotMatch(rev,/pool\.query|opinioni_risposte|req\.user|token|consent/i);
  assert.match(rev,/Cache-Control/);
  assert.match(rev,/getOpinionCatalogRevision\(\)/);
});
