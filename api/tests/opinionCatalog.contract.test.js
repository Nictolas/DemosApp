'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const catalog = require('../services/opinionCatalog');
const source = file => readFileSync(path.resolve(__dirname, '..', file), 'utf8');

test('94 source-equivalent published entries: IDs, text, geography and details', () => {
  const all = catalog.getAllOpinions();
  assert.equal(all.length,94);
  assert.equal(new Set(all.map(op=>op.id)).size,94);
  const valid = new Set(['N','R','C','CO','E']);
  for(const op of all){
    assert.match(op.id,/^[a-z][a-z0-9_]{0,62}$/);
    assert.ok(typeof op.text === 'string' && op.text.trim());
    assert.ok(typeof op.approfondimento === 'string' && op.approfondimento.trim());
    assert.ok(op.gradi_opinione.length && op.gradi_opinione.every(g=>valid.has(g)));
    assert.equal(catalog.getOpinionById(op.id),op);
    assert.equal(catalog.isPublishedOpinionId(op.id),true);
    assert.equal(catalog.findOpinionIdByText(op.id),op.id);
    assert.equal(Object.isFrozen(op),true);
    assert.equal(Object.isFrozen(op.gradi_opinione),true);
  }
  for(const g of valid) assert.deepEqual(catalog.getOpinionIdsForGrade(g),catalog.getOpinionsForGrade(g).map(x=>x.id).sort());
  assert.equal(catalog.getOpinionById('unknown_opinion'),null);
  assert.equal(catalog.isPublishedOpinionId('unknown_opinion'),false);
  assert.equal(catalog.findOpinionIdByText(''),null);
});

test('catalog is server-owned, never imports votes, users or secrets',()=>{
  const backend = source('services/opinionCatalog.js');
  assert.doesNotMatch(backend,/require\(.+(?:users|consents|risposte|auth|pool)\)/);
  const parts = Array.from({length:6},(_,i)=>source('catalog/opinions-part-0'+i+'.json')).join('\n');
  assert.doesNotMatch(parts,/(password|jwt_secret|user_id|political_opinions_consent)"\s*:/i);
});

test('catalog growth/shrink is managed by release; runtime has no fixed question count',()=>{
  const source=readFileSync(path.resolve(__dirname,'../services/opinionCatalog.js'),'utf8');
  assert.doesNotMatch(source,/opinions\.length\s*!==\s*94/);
  assert.match(source,/const VALID_GRADES=new Set/);
});

test('release revision is stable, complete and public metadata only', () => {
  const { createHash } = require('node:crypto');
  const all = catalog.getAllOpinions();
  const expected = createHash('sha256').update(JSON.stringify(all)).digest('hex');
  assert.match(catalog.getOpinionCatalogRevision(), /^[a-f0-9]{64}$/);
  assert.equal(catalog.getOpinionCatalogRevision(), expected);
  const route = source('routes/compatibility.js');
  assert.match(route, /router\.get\('\/opinioni-catalog-revision'/);
  assert.match(route, /getOpinionCatalogRevision\(\)/);
  assert.match(route, /'public, max-age=300'/);
});
