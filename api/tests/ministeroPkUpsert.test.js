'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadWithFakePool() {
  const src = fs.readFileSync(
    path.join(__dirname, '../services/ministeroSync.js'), 'utf8');
  const statements=[];
  const pool = {async query(sql, params=[]) {
    statements.push({sql, params});
    if (/^\s*SELECT id, id_ministero, titolo FROM iniziative_ministero/i.test(sql))
      return {rows:[], rowCount:0};
    if (/^\s*INSERT INTO iniziative_ministero/i.test(sql))
      return {rows:[{id:params[0]}],rowCount:1};
    throw new Error('UNEXPECTED_STAGING_TEST_QUERY');
  }};
  const module = {exports:{}};
  const mocks = {
    '../middleware/auth':{pool},
    './ministeroPaginationSafety':{inspectMinisteroPage:()=>{throw new Error('UNEXPECTED_FETCH')}},
    './centralizedLogger':{info:async()=>{},error:async()=>{}},
    './redisCache':{invalidateMinisteroIniziativeCache:async()=>{}},
    '../utils/dateUtils':{normalizeMinisteroDate:()=>null,resolveIniziativaDataFine:()=>null},
    '../utils/iniziativeMinisteroMapper':{resolveFirmaUrl:()=>null},
    './civicProcessRegistryService':{
      resolveProcessTypeFromSource:({rawType})=>
        ({id:rawType.toLowerCase().includes('referendum')?
          'it.referendum_signature_request':'it.popular_law_initiative',
          family:rawType.toLowerCase().includes('referendum')?'referendum':'popular_initiative'}),
      getSignatureThreshold:()=>50000,
    },
  };
  vm.runInNewContext(src, {
    module, exports:module.exports, require: p => {
      if (!(p in mocks)) throw new Error('UNEXPECTED_IMPORT_'+p);
      return mocks[p];
    },
    process:{env:{NODE_ENV:'test'}},
    console:{log(){},error(){},warn(){}},
    Date, URLSearchParams, setTimeout, clearTimeout,
  }, {filename:'ministeroSync.js',timeout:1500});
  return {service:module.exports,statements};
}

test('real Demos-Staging schema uses stable primary-key id as conflict arbiter',async()=>{
  const {service,statements}=loadWithFakePool();
  const result=await service.saveIniziativa({
    id:217,titolo:'Official law initiative',
    idDecTipoIniziativa:{nome:'Legge di iniziativa popolare (art. 71 Costituzione)'},
    idDecStatoIniziativa:{nome:'IN RACCOLTA FIRME'},sostenitori:42,
  });
  assert.equal(result.action,'created');
  assert.equal(result.id,'ministero_217');
  assert.equal(statements.length,2);
  const write=statements[1];
  assert.match(write.sql,/INSERT INTO iniziative_ministero/);
  assert.match(write.sql,/ON CONFLICT \(id\) DO UPDATE SET/);
  assert.doesNotMatch(write.sql,/ON CONFLICT \(id_ministero\)/);
  assert.equal(write.params[0],'ministero_217');
  assert.equal(write.params[1],'217');
  assert.equal(write.params[2],'Official law initiative');
  assert.equal(write.params[5],'in_corso');
});

test('referendum record also uses deterministic primary key',async()=>{
  const {service,statements}=loadWithFakePool();
  const result=await service.saveIniziativa({
    id:218,titolo:'Official referendum',
    idDecTipoIniziativa:{nome:'Referendum  abrogativo (art. 75 Costituzione)'},
    idDecStatoIniziativa:{nome:'CHIUSA'},sostenitori:10,
  });
  assert.equal(result.id,'ministero_218');
  assert.match(statements[1].sql,/ON CONFLICT \(id\) DO UPDATE SET/);
  assert.equal(statements[1].params[5],'conclusa');
});

test('missing official ID fails before database reads or random identifier generation',async()=>{
  const {service,statements}=loadWithFakePool();
  await assert.rejects(service.saveIniziativa({
    titolo:'Unidentified source row',
    idDecTipoIniziativa:{nome:'Legge di iniziativa popolare'},
  }),/MINISTERO_OFFICIAL_ID_REQUIRED/);
  assert.deepEqual(statements,[]);
  const source=fs.readFileSync(
    path.join(__dirname,'../services/ministeroSync.js'),'utf8');
  assert.doesNotMatch(source,/ministero_\$\{Date\.now\(\)\}/);
});

test('the updated SQL does not depend on a non-existent id_ministero UNIQUE index',()=>{
  const source=fs.readFileSync(
    path.join(__dirname,'../services/ministeroSync.js'),'utf8');
  assert.match(source,/ON CONFLICT \(id\) DO UPDATE SET/);
  assert.doesNotMatch(source,/ON CONFLICT \$\{conflictTarget\}/);
});
