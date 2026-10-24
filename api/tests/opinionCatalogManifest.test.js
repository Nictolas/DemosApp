'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {createCatalogRegistry,encodeEnvelope,decodeEnvelope,upgradeEnvelope} =
  require('../utils/opinionCodecEnvelope');
const {
  MAX_MANIFEST_BYTES,serializeCatalogRegistry,restoreCatalogRegistry,
  appendCatalogManifest
} = require('../utils/opinionCatalogManifest');

function sample() {
  return createCatalogRegistry([
    {version:1,ids:['caccia','nato']},
    {version:3,ids:['caccia','nato','salario_minimo']}
  ]);
}

function tamper(json, callback) {
  const obj = JSON.parse(json);
  callback(obj);
  return JSON.stringify(obj);
}

test('catalog manifest round-trips canonically across simulated process restarts', () => {
  const original = sample();
  const serialized = serializeCatalogRegistry(original);
  const reloaded = restoreCatalogRegistry(Buffer.from(serialized,'utf8'));
  assert.equal(serializeCatalogRegistry(reloaded),serialized);
  assert.deepEqual(reloaded.versions,[1,3]);
  assert.deepEqual(reloaded.get(1).ids,['caccia','nato']);
  assert.deepEqual(reloaded.get(3).ids,['caccia','nato','salario_minimo']);
  assert.ok(Object.isFrozen(reloaded.get(1).ids));
  assert.notEqual(reloaded,original);
});

test('all three codecs decode historical votes after manifest reload and append', () => {
  const original = sample();
  const exported = serializeCatalogRegistry(original);
  const expanded = appendCatalogManifest(exported,
    ['caccia','nato','salario_minimo','energia_nucleare']);
  const fresh = restoreCatalogRegistry(expanded);
  assert.equal(fresh.latestVersion,4);
  assert.equal(original.latestVersion,3);
  assert.equal(exported,serializeCatalogRegistry(original),'Old manifest stays intact');
  for (const encoding of ['fixed','trimmed','sparse']) {
    const old = encodeEnvelope(original,{version:1,encoding,answers:{caccia:'f',nato:'i'}});
    assert.deepEqual(decodeEnvelope(fresh,old),{
      caccia:'f',nato:'i',salario_minimo:null,energia_nucleare:null
    });
    const upgraded = upgradeEnvelope(fresh,old,encoding);
    assert.equal(upgraded.catalogVersion,4);
    assert.deepEqual(decodeEnvelope(fresh,upgraded),decodeEnvelope(fresh,old));
    assert.throws(()=>decodeEnvelope(original,upgraded),/Unknown catalog version/);
  }
});

test('manifest fingerprints reject edited or truncated catalog identity', () => {
  const serialized = serializeCatalogRegistry(sample());
  assert.throws(()=>restoreCatalogRegistry(tamper(serialized,x=>{
    x.catalogs[0].ids[0]='energia_nucleare';
  })),/fingerprint|Catalog versions/i);
  assert.throws(()=>restoreCatalogRegistry(tamper(serialized,x=>{
    x.catalogs[1].fingerprint='0'.repeat(64);
  })),/fingerprint/i);
  assert.throws(()=>restoreCatalogRegistry(tamper(serialized,x=>{
    x.catalogs[1].ids.reverse();
  })),/Catalog versions|fingerprint/i);
});

test('manifest rejects schema drift, unknown keys, malformed and missing versions', () => {
  const serialized = serializeCatalogRegistry(sample());
  for (const modified of [
    tamper(serialized,x=>{x.schemaVersion=2;}),
    tamper(serialized,x=>{x.environment='production';}),
    tamper(serialized,x=>{x.catalogs[0].secret='value';}),
    tamper(serialized,x=>{x.catalogs[1].version=1;}),
    tamper(serialized,x=>{x.catalogs=[];}),
    tamper(serialized,x=>{x.catalogs[1].ids=['nato','caccia','salario_minimo'];}),
    '{invalid json',
    JSON.stringify({schemaVersion:1,catalogs:[{version:1,ids:['a'],fingerprint:3}]})
  ]) assert.throws(()=>restoreCatalogRegistry(modified));
});

test('manifest rejects unsafe input size and type without parsing', () => {
  assert.throws(()=>restoreCatalogRegistry(null),TypeError);
  assert.throws(()=>restoreCatalogRegistry({schemaVersion:1}),TypeError);
  assert.throws(()=>restoreCatalogRegistry(''),RangeError);
  assert.throws(()=>restoreCatalogRegistry(' '.repeat(MAX_MANIFEST_BYTES+1)),RangeError);
  assert.throws(()=>restoreCatalogRegistry(Buffer.alloc(MAX_MANIFEST_BYTES+1)),RangeError);
  assert.throws(()=>serializeCatalogRegistry({versions:[1],get(){return {version:1,ids:['a'],fingerprint:'wrong'};}}),RangeError);
});

test('append refuses drops, reorders and no-op revisions', () => {
  const serialized = serializeCatalogRegistry(sample());
  const previous = JSON.parse(serialized);
  for (const ids of [
    ['caccia','nato','salario_minimo'],
    ['nato','caccia','salario_minimo','nuova'],
    ['caccia','nato','nuova','ulteriore'],
    ['caccia','nato']
  ]) assert.throws(()=>appendCatalogManifest(serialized,ids),RangeError);
  assert.deepEqual(JSON.parse(serialized),previous);
});

test('two catalog snapshots remain independently restorable for rollback planning', () => {
  const older = serializeCatalogRegistry(sample());
  const newer = appendCatalogManifest(older,['caccia','nato','salario_minimo','nuova']);
  const before = restoreCatalogRegistry(older);
  const after = restoreCatalogRegistry(newer);
  assert.deepEqual(before.versions,[1,3]);
  assert.deepEqual(after.versions,[1,3,4]);
  assert.notEqual(older,newer);
  // Returning to old catalog does NOT imply that blobs written at v4 are readable.
  const newPayload=encodeEnvelope(after,{version:4,encoding:'fixed',answers:{nuova:'c'}});
  assert.throws(()=>decodeEnvelope(before,newPayload),/Unknown catalog version/);
});
