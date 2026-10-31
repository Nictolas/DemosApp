'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateSourceMap,legacyRowToOpinionMaps,planSourcePatch,projectSourcesForProfile,SQL}=
  require('../experiments/opinionAnswersV2SourcesCandidate');
const ids=new Set(['opinione_0','opinione_1','opinione_94']);
const historic=new Set([...ids,'opinione_archiviata']);

test('legacy fonti_opinioni maps survive migration with archived IDs and Unicode',()=>{
  const old={opinione_0:'https://example.org/articolo?x=1&y=2',
    opinione_archiviata:'Testo storico con à è',opinione_1:'  '};
  const result=validateSourceMap(old,{historicalIds:historic});
  assert.deepEqual({...result},old);
  assert.equal(Object.getPrototypeOf(result),null);
  assert.throws(()=>validateSourceMap(old,{historicalIds:ids}),/historical/);
  assert.deepEqual({...validateSourceMap(null)}, {});
});

test('patch changes only named published IDs and retains archived source',()=>{
  const stored={opinione_0:'link A',opinione_1:'link B',opinione_archiviata:'archivio'};
  const patch=planSourcePatch(stored,{opinione_0:'link A2'},ids);
  assert.equal(patch.changedCount,1);
  assert.deepEqual({...patch.added},{opinione_0:'link A2'});
  assert.deepEqual(patch.removed,[]);
  assert.deepEqual({...patch.merged},{
    opinione_0:'link A2',opinione_1:'link B',opinione_archiviata:'archivio'
  });
  assert.equal(stored.opinione_0,'link A');
  assert.deepEqual({...planSourcePatch(stored,{opinione_0:'link A'},ids).added},{});
});

test('empty/whitespace source removes only named key, never an archived one',()=>{
  const stored={opinione_0:'link A',opinione_1:'link B',opinione_archiviata:'storia'};
  const patch=planSourcePatch(stored,{opinione_0:' ',opinione_1:null},ids);
  assert.deepEqual(patch.removed,['opinione_0','opinione_1']);
  assert.deepEqual({...patch.merged},{opinione_archiviata:'storia'});
  assert.equal(patch.changedCount,2);
  const noop=planSourcePatch({}, {opinione_0:null},ids);
  assert.equal(noop.changedCount,0);
});

test('rejects client edits to archived IDs, malformed and overly long source strings',()=>{
  assert.throws(()=>planSourcePatch({}, {opinione_archiviata:'new'},ids),/Unpublished/);
  assert.throws(()=>planSourcePatch({}, {['__proto__']:'foo',opinione_94:'ok'},ids),/Unpublished|Invalid/); // additional enumerable key depends on literal semantics
  assert.throws(()=>planSourcePatch({}, {opinione_0:3},ids),/Source must/);
  assert.throws(()=>planSourcePatch({}, {opinione_0:'a'.repeat(8193)},ids),/too large/);
  assert.throws(()=>validateSourceMap({opinione_0:42},{historicalIds:ids}),/source text/);
  assert.throws(()=>validateSourceMap({opinione_0:'x'.repeat(8193)},{historicalIds:ids}),/source text/);
  assert.throws(()=>validateSourceMap(['a']),/plain JSON object/);
});

test('project only public source IDs for authorized profile view',()=>{
  const data=projectSourcesForProfile(
    [{id:'opinione_0'},{id:'opinione_94'}],
    {opinione_0:'source 0',opinione_archiviata:'historical source'}
  );
  assert.deepEqual(data,[
    {id:'opinione_0',source:'source 0'},
    {id:'opinione_94',source:'unknown'}
  ]);
  assert.equal(data.some(x=>x.id==='opinione_archiviata'),false);
});

test('sources SQL patches with jsonb merge and explicit deletes, never snapshot overwrite',()=>{
  assert.match(SQL.upsertSources,/existing\.sources - \$3::text\[\]/);
  assert.match(SQL.upsertSources,/\|\| EXCLUDED\.sources/);
  assert.match(SQL.exportWithSources,/user_id=\$1::uuid/);
  assert.match(SQL.readForUpdate,/FOR UPDATE/);
  assert.doesNotMatch(SQL.upsertSources,/SET\s+sources\s*=\s*EXCLUDED\.sources/i);
});

test('full historical backfill copies answers and sources, never drops archived keys',()=>{
  const legacy={
    opinione_0:'f',opinione_archiviata:'c',opinione_1:null,
    fonti_opinioni:{opinione_0:'Fonte attuale',opinione_archiviata:'Fonte archiviata'}
  };
  const res=legacyRowToOpinionMaps(legacy,['opinione_0','opinione_1','opinione_archiviata']);
  assert.deepEqual({...res.answers},{opinione_0:'f',opinione_archiviata:'c'});
  assert.deepEqual({...res.sources},{
    opinione_0:'Fonte attuale',opinione_archiviata:'Fonte archiviata'
  });
  assert.throws(()=>legacyRowToOpinionMaps({
    opinione_0:'f',fonti_opinioni:{opinione_95:'untracked'}
  },['opinione_0']),/Unknown historical/);
  assert.throws(()=>legacyRowToOpinionMaps({opinione_0:'f'},['opinione_0']),
    /Missing legacy fonti_opinioni/);
});
