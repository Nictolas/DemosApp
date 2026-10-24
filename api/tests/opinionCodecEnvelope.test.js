'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCatalogRegistry,encodeEnvelope,decodeEnvelope,upgradeEnvelope,
  decodeLegacyQuestionRows,parseLegacyOpinionPost
} = require('../utils/opinionCodecEnvelope');

function registry() {
  return createCatalogRegistry([
    {version:1,ids:['caccia','nato','salario_minimo']},
    {version:2,ids:['caccia','nato','salario_minimo','energia_nucleare','ius_soli']},
    {version:3,ids:['caccia','nato','salario_minimo','energia_nucleare','ius_soli','carne_coltivata']}
  ]);
}

test('versioned payloads preserve f/c/i/NULL through all three codecs and legacy GET', () => {
  const catalogs=registry();
  for(const encoding of ['fixed','trimmed','sparse']){
    const source=encodeEnvelope(catalogs,{
      version:1,encoding,answers:{caccia:'f',nato:'i'}
    });
    assert.equal(source.schemaVersion,1);
    assert.equal(source.catalogVersion,1);
    assert.equal(source.encoding,encoding);
    assert.equal(typeof source.catalogFingerprint,'string');
    assert.ok(Buffer.isBuffer(source.payload));
    assert.deepEqual(decodeEnvelope(catalogs,source),{
      caccia:'f',nato:'i',salario_minimo:null,
      energia_nucleare:null,ius_soli:null,carne_coltivata:null
    });
    assert.deepEqual(decodeLegacyQuestionRows(catalogs,source,
      ['nato','caccia','energia_nucleare']),[
      {id:'nato',userAnswer:'i'},
      {id:'caccia',userAnswer:'f'},
      {id:'energia_nucleare',userAnswer:null}
    ]);
  }
});

test('append-only upgrade can change storage format but never changes votes', () => {
  const catalogs=registry();
  const old=encodeEnvelope(catalogs,{
    version:1,encoding:'sparse',answers:{caccia:'c',nato:'f'}
  });
  const revised=upgradeEnvelope(catalogs,old,'trimmed');
  assert.equal(revised.catalogVersion,3);
  assert.equal(revised.encoding,'trimmed');
  assert.deepEqual(decodeEnvelope(catalogs,old),decodeEnvelope(catalogs,revised));
  assert.equal(old.catalogVersion,1);
  assert.equal(decodeEnvelope(catalogs,old,1).ius_soli,undefined);
  assert.throws(()=>decodeEnvelope(catalogs,revised,1),RangeError);
});

test('catalog creation rejects reordering, deleted IDs, invalid versions and duplicates', () => {
  assert.throws(()=>createCatalogRegistry([]),TypeError);
  assert.throws(()=>createCatalogRegistry([{version:0,ids:['a']}]),TypeError);
  assert.throws(()=>createCatalogRegistry([
    {version:1,ids:['a']},{version:1,ids:['a','b']}
  ]),TypeError);
  assert.throws(()=>createCatalogRegistry([
    {version:1,ids:['a','b']},{version:2,ids:['b','a']}
  ]),RangeError);
  assert.throws(()=>createCatalogRegistry([
    {version:1,ids:['a','b']},{version:2,ids:['a']}
  ]),RangeError);
  assert.throws(()=>createCatalogRegistry([{version:1,ids:['a','a']}]),TypeError);
  assert.equal(registry().versions.length,3);
});

test('tampered fingerprint, unknown versions, format and malformed bytes fail closed', () => {
  const catalogs=registry();
  const packed=encodeEnvelope(catalogs,{version:1,encoding:'fixed',answers:{caccia:'i'}});
  assert.throws(()=>decodeEnvelope(catalogs,{...packed,catalogFingerprint:'fake'}),RangeError);
  assert.throws(()=>decodeEnvelope(catalogs,{...packed,catalogVersion:99}),RangeError);
  assert.throws(()=>decodeEnvelope(catalogs,{...packed,schemaVersion:2}),RangeError);
  assert.throws(()=>decodeEnvelope(catalogs,{...packed,encoding:'jsonb'}),RangeError);
  assert.throws(()=>decodeEnvelope(catalogs,{...packed,payload:'0011'}),TypeError);
  assert.throws(()=>decodeEnvelope(catalogs,{...packed,payload:Buffer.from([1])}),RangeError);
  assert.throws(()=>decodeEnvelope(catalogs,null),TypeError);
  assert.throws(()=>encodeEnvelope(catalogs,{version:3,encoding:'zstd',answers:{}}),RangeError);
  assert.throws(()=>decodeLegacyQuestionRows(catalogs,packed,['not_a_real_question']),RangeError);
});

test('legacy Android/web POST shape still accepts canonical values and aliases', () => {
  const catalogs=registry();
  assert.deepEqual(parseLegacyOpinionPost({
    opinioni:{caccia:'F',nato:'contrario',salario_minimo:'non lo so'}
  },catalogs),{
    caccia:'f',nato:'c',salario_minimo:'i'
  });
  assert.deepEqual(parseLegacyOpinionPost({caccia:'f'},catalogs),{caccia:'f'});
  assert.deepEqual(parseLegacyOpinionPost({opinioni:{ius_soli:'favorevole'}},catalogs),
    {ius_soli:'f'});
});

test('legacy API writes fail closed on missing, NULL, unsupported and foreign IDs', () => {
  const catalogs=registry();
  for (const data of [
    {opinioni:{}},{opinioni:{caccia:null}},
    {opinioni:{caccia:'n/a'}},
    {opinioni:{x:'f'}},
    {opinioni:[]},
    {opinioni:{caccia:false}}
  ]) assert.throws(()=>parseLegacyOpinionPost(data,catalogs));
  assert.throws(()=>parseLegacyOpinionPost({opinioni:{ius_soli:'f'}},catalogs,1),RangeError);
  assert.throws(()=>parseLegacyOpinionPost(null,catalogs),TypeError);
});

test('registry IDs cannot be mutated after sealing the version', () => {
  const ids=['caccia','nato']; 
  const cat=createCatalogRegistry([{version:1,ids}]);
  ids.reverse();
  assert.deepEqual(cat.get(1).ids,['caccia','nato']);
  assert.equal(Object.isFrozen(cat.get(1).ids),true);
  assert.throws(()=>cat.get(1).ids.reverse(),TypeError);
});

test('every format is byte-consistent after catalog extension', () => {
  const cat=registry();
  for(const kind of ['fixed','trimmed','sparse']){
    const first=encodeEnvelope(cat,{version:1,encoding:kind,answers:{salario_minimo:'f'}});
    for(const newest of ['fixed','trimmed','sparse']){
      const upgraded=upgradeEnvelope(cat,first,newest);
      assert.equal(decodeEnvelope(cat,upgraded).salario_minimo,'f');
      assert.equal(decodeEnvelope(cat,upgraded).carne_coltivata,null);
    }
  }
});
