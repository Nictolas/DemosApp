'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Module = require('node:module');

const ROOT = path.resolve(__dirname,'../..');
const SCRIPT_FILES = [
  'scripts/hard-disk-export.js',
  'scripts/data-archival-strategy.js',
  'scripts/automated-archival.js'
];
const unsafeEnv = {
  ...process.env,
  DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:1/NEVER_CONNECT',
  ARCHIVE_ENCRYPTION_KEY: 'FAKE_NOT_A_REAL_KEY',
  EXPORT_DIR: '/tmp/NO_REAL_ARCHIVE',
  NODE_ENV: 'test'
};

test('three old archival CLIs exit 78 before loading DB, dotenv or cron, with flags and modes', () => {
  for (const script of SCRIPT_FILES) {
    const source = fs.readFileSync(path.join(ROOT,script),'utf8');
    const guardIndex = source.indexOf('exitRetiredLegacyDataArchival()');
    const firstDependency = source.indexOf("require('pg')") >= 0 ? source.indexOf("require('pg')") :
      source.indexOf("require('node-cron')");
    assert.ok(guardIndex >= 0 && firstDependency > guardIndex, script+' must exit before imports');

    for (const args of [['export','--delete'],['immediate'],['start']]) {
      const proc = spawnSync(process.execPath,[path.join(ROOT,script),...args],{
        encoding:'utf8',env:unsafeEnv,timeout:3000,maxBuffer:32*1024
      });
      assert.equal(proc.error,undefined,script);
      assert.equal(proc.status,78,script+' '+args.join(' '));
      assert.match(proc.stderr,/^LEGACY_DATA_ARCHIVAL_RETIRED:/,script);
      assert.doesNotMatch(proc.stderr,/synthetic@|FAKE_NOT_A_REAL_KEY/);
      assert.equal(proc.stdout,'','No PostgreSQL / cron / filesystem startup');
    }
  }
});

test('imported destructive archive functions also fail closed, without DB query or cron schedule', async () => {
  const originalLoad = Module._load;
  const touched = {constructs:0,queries:0,cron:0,dotenv:0};
  const fakes = {
    pg: {Pool:class {
      constructor(){touched.constructs++}
      query(){touched.queries++;throw Error('FORBIDDEN_DB')}
      end(){touched.queries++;throw Error('FORBIDDEN_DB_END')}
    }},
    dotenv:{config(){touched.dotenv++;return {parsed:{}}}},
    'node-cron':{schedule(){touched.cron++;throw Error('FORBIDDEN_CRON')}}
  };
  const cache=[];
  Module._load=function(request,parent,isMain){
    if (parent?.filename?.startsWith(path.join(ROOT,'scripts')+path.sep)
        && Object.hasOwn(fakes,request)) return fakes[request];
    return originalLoad.apply(this,arguments);
  };
  try {
    const modules=SCRIPT_FILES.map(file=>{
      const filename=path.join(ROOT,file);
      cache.push([filename,require.cache[filename]]);
      delete require.cache[filename];
      return require(filename);
    });
    const [hard,arch,auto]=modules;
    const matches = err => err?.code === 'LEGACY_DATA_ARCHIVAL_RETIRED';
    await assert.rejects(hard.exportToHardDisk({deleteAfterExport:true}),matches);
    await assert.rejects(hard.exportToHardDisk({dryRun:true}),matches);
    await assert.rejects(arch.archiveOldData(),matches);
    await assert.rejects(arch.runArchival(),matches);
    assert.throws(()=>auto.startAutomatedArchival(),matches);
    await assert.rejects(auto.testArchival(),matches);
    await assert.rejects(auto.runImmediateArchival(),matches);
    assert.equal(touched.queries,0);
    assert.equal(touched.cron,0);
  } finally {
    Module._load=originalLoad;
    for (const [filename,saved] of cache) {
      delete require.cache[filename];
      if(saved)require.cache[filename]=saved;
    }
  }
});

test('source documents why delete-after-fake-backup is disabled; modern Axiom/B2 path is separate', () => {
  const archival=fs.readFileSync(path.join(ROOT,'scripts/data-archival-strategy.js'),'utf8');
  assert.match(archival,/Simulazione caricamento/);
  assert.match(archival,/DELETE FROM \$\{tableName\}/);
  const legacyDisk=fs.readFileSync(path.join(ROOT,'scripts/hard-disk-export.js'),'utf8');
  assert.match(legacyDisk,/deleteAfterExport\s*&&\s*result\.exported/);
  assert.match(legacyDisk,/assertLegacyDataArchivalUnavailable\(\);/);
  const modern=fs.readFileSync(path.join(ROOT,'api/services/axiomArchiveService.js'),'utf8');
  assert.doesNotMatch(modern,/legacyDataArchivalGate/);
});
