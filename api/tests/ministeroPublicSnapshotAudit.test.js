'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  OFFICIAL_URL,normalizeRecord,normalizePayload,readOfficialSource,
}=require('../staging/ministeroPublicSnapshotAudit');

const base=(id,type='Legge di iniziativa popolare (art. 71 Cost.)',state='IN RACCOLTA FIRME')=>({
  id,titolo:'Proposta ufficiale '+id,
  idDecTipoIniziativa:{nome:type},
  idDecStatoIniziativa:{nome:state},
  sostenitori:42,dataInizioRaccolta:'2026-11-01',
  dataFineRaccolta:'2027-05-01',
});
const payload=items=>({content:items,infoPaginazione:{
  elementCount:items.length,pageIndex:1,pageSize:10,
}});
test('normalization has only public official source fields',()=>{
  const item=normalizeRecord(base(217));
  assert.equal(item.id,'ministero_217');
  assert.equal(item.id_ministero,'217');
  assert.equal(item.categoria_notifica,'iniziative_popolari');
  assert.equal(item.target_path,'/iniziative-popolari');
  assert.equal(item.stato,'in_corso');
  assert.equal(item.firme_raccolte,42);
  assert.match(item.sito_web,/^https:\/\/firmereferendum\.giustizia\.it\/referendum\/open\/dettaglio-open\/217$/);
  assert.equal(item.data_fine_raw,'2027-05-01');
  assert.equal(item.dati_raw,undefined);
});
test('referendum and closed state classification remain distinct',()=>{
  const item=normalizeRecord(base(218,'Referendum  abrogativo (art. 75 Cost.)','CHIUSA'));
  assert.equal(item.categoria_notifica,'referendum_abrogativi');
  assert.equal(item.stato,'conclusa');
  assert.equal(item.target_path,'/referendum-abrogativi');
});
test('known non-collecting official states are never classified as collection',()=>{
  for(const state of ['MESSA A DISPOSIZIONE','ALLA CAMERA','AL SENATO']){
    const item=normalizeRecord(base(219,undefined,state));
    assert.notEqual(item.stato,'in_corso');
  }
});
test('reject unsupported or ambiguous official fields',()=>{
  for(const item of [
    {...base(218),id:'99 OR 1=1'},
    {...base(218),titolo:''},
    {...base(218),idDecTipoIniziativa:{nome:'Referendum costituzionale'}},
    {...base(218),idDecStatoIniziativa:{nome:'NUOVO STATO IGNOTO'}},
    {...base(218),sostenitori:-1},
    {...base(218),sostenitori:'abc'},
    {...base(218),dataFineRaccolta:{bogus:true}},
  ])assert.throws(()=>normalizeRecord(item),/MINISTERO_SOURCE_/);
});
test('readiness requires one fully enumerated page and unique IDs',()=>{
  const two=[base(217),base(218,'Referendum abrogativo')];
  assert.equal(normalizePayload(payload(two)).length,2);
  assert.throws(()=>normalizePayload({content:two.slice(0,1),
    infoPaginazione:{elementCount:2}}),/MINISTERO_SOURCE_NOT_COMPLETE/);
  assert.throws(()=>normalizePayload(payload([base(217),base(217)])),
    /MINISTERO_SOURCE_DUPLICATE_ID/);
  assert.throws(()=>normalizePayload(payload([])),/MINISTERO_PAGINATION_EMPTY_FEED/);
});
test('live read receives only official HTTPS endpoint and does not access DB',async()=>{
  let calls=0;
  const rows=await readOfficialSource(async(url,options)=>{
    calls++;
    assert.equal(url,OFFICIAL_URL);
    assert.equal(new URL(url).hostname,'firmereferendum.giustizia.it');
    assert.equal(options.headers.Accept,'application/json');
    return {ok:true,headers:{get:()=> 'application/json'},json:async()=>payload([base(217)])};
  });
  assert.equal(calls,1);
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'ministero_217');
});
test('wrong content type and failing HTTP never produce a snapshot',async()=>{
  await assert.rejects(()=>readOfficialSource(async()=>({
    ok:false,headers:{get:()=> 'application/json'},
  })),/MINISTERO_SOURCE_HTTP_UNAVAILABLE/);
  await assert.rejects(()=>readOfficialSource(async()=>({
    ok:true,headers:{get:()=> 'text/html'},
  })),/MINISTERO_SOURCE_UNEXPECTED_CONTENT_TYPE/);
});
