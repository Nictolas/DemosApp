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


test('hybrid cloud legacy cleanup is permanently disabled before loading providers', () => {
  const script = 'scripts/hybrid-cloud-backup.js';
  const source = fs.readFileSync(path.join(ROOT,script),'utf8');
  const guard = source.indexOf('exitRetiredLegacyDataArchival()');
  const dbImport = source.indexOf("require('pg')");
  const dotenv = source.indexOf("require('dotenv')");
  assert.ok(guard >= 0 && guard < dbImport && guard < dotenv);
  assert.doesNotMatch(source,/b2 delete-file-version|aws s3 rm|gsutil rm/);
  assert.match(source,/assertLegacyDataArchivalUnavailable\(\)/);
  assert.doesNotMatch(source,/node scripts\/hybrid-cloud-backup\.js cleanup --after-export/);

  const result = spawnSync(process.execPath,[path.join(ROOT,script),'cleanup','--after-export'],{
    encoding:'utf8',env:unsafeEnv,timeout:3000,maxBuffer:32*1024
  });
  assert.equal(result.error,undefined);
  assert.equal(result.status,78);
  assert.match(result.stderr,/^LEGACY_DATA_ARCHIVAL_RETIRED:/);
  assert.equal(result.stdout,'');
  assert.doesNotMatch(result.stderr,/synthetic@|FAKE_NOT_A_REAL_KEY/);
});

test('hybrid cloud imported cleanup rejects without DB queries or cloud CLI', async () => {
  const file = path.join(ROOT,'scripts/hybrid-cloud-backup.js');
  const originalLoad = Module._load;
  const previous = require.cache[file];
  const touched = {dbQueries:0,exec:0,dotenv:0};
  Module._load=function(request,parent,isMain){
    if(parent?.filename === file) {
      if(request==='pg')return {Pool:class {
        query(){touched.dbQueries++;throw Error('FORBIDDEN_DB')}
        end(){touched.dbQueries++;throw Error('FORBIDDEN_DB_END')}
      }};
      if(request==='dotenv')return {config(){touched.dotenv++;return {parsed:{}}}};
      if(request==='child_process')return {exec(){touched.exec++;throw Error('FORBIDDEN_CLOUD_EXEC')}};
    }
    return originalLoad.apply(this,arguments);
  };
  try {
    delete require.cache[file];
    const hybrid = require(file);
    await assert.rejects(hybrid.cleanupCloudAfterExport(),err=>err?.code==='LEGACY_DATA_ARCHIVAL_RETIRED');
    assert.equal(touched.dbQueries,0);
    assert.equal(touched.exec,0);
  } finally {
    Module._load=originalLoad;
    delete require.cache[file];
    if(previous) require.cache[file]=previous;
  }
});


test('legacy multi-cloud exporter is disabled before cloud or secret access', async () => {
  const script='scripts/cloud-backup-export.js';
  const file=path.join(ROOT,script);
  const source=fs.readFileSync(file,'utf8');
  assert.match(source,/exitRetiredLegacyDataArchival\(\)/);
  assert.doesNotMatch(source,/execAsync|require\(['"]dotenv['"]\)|b2 upload-file|aws s3 cp|gsutil cp|az storage blob upload/);

  for(const mode of [[],['full'],['new','7']]){
    const proc=spawnSync(process.execPath,[file,...mode],{
      encoding:'utf8',env:unsafeEnv,timeout:3000,maxBuffer:32*1024
    });
    assert.equal(proc.error,undefined);
    assert.equal(proc.status,78);
    assert.match(proc.stderr,/^LEGACY_DATA_ARCHIVAL_RETIRED:/);
    assert.equal(proc.stdout,'');
    assert.doesNotMatch(proc.stderr,/synthetic@|FAKE_NOT_A_REAL_KEY/);
  }

  const originalLoad=Module._load;
  const previous=require.cache[file];
  let forbiddenImports=0;
  Module._load=function(request,parent,isMain){
    if(parent?.filename===file && ['dotenv','pg','child_process','fs','fs/promises'].includes(request)){
      forbiddenImports++;
      throw Error('FORBIDDEN_LEGACY_DEPENDENCY');
    }
    return originalLoad.apply(this,arguments);
  };
  try {
    delete require.cache[file];
    const legacy=require(file);
    const errorMatcher=err=>err?.code==='LEGACY_DATA_ARCHIVAL_RETIRED';
    for(const name of ['backupToS3','backupToGCS','backupToB2','backupToAzure','backupDirectory','backupNewFiles']){
      assert.equal(typeof legacy[name],'function');
      await assert.rejects(legacy[name]('/tmp/NO_REAL_ARCHIVE','synthetic'),errorMatcher,name);
    }
    assert.equal(forbiddenImports,0);
  }finally{
    Module._load=originalLoad;
    delete require.cache[file];
    if(previous)require.cache[file]=previous;
  }
});


test('legacy hybrid cloud backup, inventory and cleanup all fail closed', async () => {
  const file=path.join(ROOT,'scripts/hybrid-cloud-backup.js');
  const source=fs.readFileSync(file,'utf8');
  const guard=source.indexOf('exitRetiredLegacyDataArchival()');
  const pg=source.indexOf("require('pg')");
  const dotenv=source.indexOf("require('dotenv')");
  assert.ok(guard>=0 && pg>guard && dotenv>guard);
  for(const args of [[],['backup'],['check'],['stats'],['cleanup']]){
    const proc=spawnSync(process.execPath,[file,...args],{
      encoding:'utf8',env:unsafeEnv,timeout:3000,maxBuffer:32*1024
    });
    assert.equal(proc.error,undefined);
    assert.equal(proc.status,78,'mode '+(args[0]||'default'));
    assert.match(proc.stderr,/^LEGACY_DATA_ARCHIVAL_RETIRED:/);
    assert.equal(proc.stdout,'');
    assert.doesNotMatch(proc.stderr,/synthetic@|FAKE_NOT_A_REAL_KEY/);
  }

  const originalLoad=Module._load;
  const previous=require.cache[file];
  const touched={queries:0,cloudExec:0};
  Module._load=function(request,parent,isMain){
    if(parent?.filename===file){
      if(request==='pg')return {Pool:class{
        query(){touched.queries++;throw Error('FORBIDDEN_DB');}
        end(){touched.queries++;throw Error('FORBIDDEN_DB_END');}
      }};
      if(request==='child_process')return {exec(){touched.cloudExec++;throw Error('FORBIDDEN_CLOUD_CLI');}};
      if(request==='dotenv')return {config(){return {parsed:{}};}};
    }
    return originalLoad.apply(this,arguments);
  };
  try{
    delete require.cache[file];
    const legacy=require(file);
    const rejectsRetired=err=>err?.code==='LEGACY_DATA_ARCHIVAL_RETIRED';
    for(const name of ['dailyBackup','checkExportNeeded','getCloudStorageSize','cleanupCloudAfterExport']){
      assert.equal(typeof legacy[name],'function');
      await assert.rejects(legacy[name](),rejectsRetired,name);
    }
    assert.equal(touched.queries,0);
    assert.equal(touched.cloudExec,0);
  }finally{
    Module._load=originalLoad;
    delete require.cache[file];
    if(previous)require.cache[file]=previous;
  }
});


test('legacy retention service and job reject direct writes before SQL or scheduler', async () => {
  const serviceFile=path.join(ROOT,'api/services/dataRetentionService.js');
  const jobFile=path.join(ROOT,'api/jobs/dataRetentionJob.js');
  const serviceSource=fs.readFileSync(serviceFile,'utf8');
  assert.match(serviceSource,/RETENTION_LEGACY_CLEANUP_RETIRED/);
  assert.match(serviceSource,/static async deleteExpiredData[\s\S]*?this\.assertLegacyRetentionWriteUnavailable\(\)/);
  assert.match(serviceSource,/static async deleteAllExpiredData[\s\S]*?this\.assertLegacyRetentionWriteUnavailable\(\)/);
  assert.match(serviceSource,/static async performFullCleanup[\s\S]*?this\.assertLegacyRetentionWriteUnavailable\(\)/);

  const originalLoad=Module._load;
  const previousService=require.cache[serviceFile];
  const previousJob=require.cache[jobFile];
  const touched={db:0,audit:0};
  const pool={query(){touched.db++;throw Error('FORBIDDEN_RETENTION_DB');}};
  const audit={logAction(){touched.audit++;throw Error('FORBIDDEN_RETENTION_AUDIT');}};
  let Service;
  Module._load=function(request,parent,isMain){
    if(parent?.filename===serviceFile && request==='../middleware/auth')return {pool};
    if(parent?.filename===serviceFile && request==='./auditService')return audit;
    if(parent?.filename===jobFile && request==='../services/auditService')return audit;
    if(parent?.filename===jobFile && request==='../services/dataRetentionService')return Service;
    return originalLoad.apply(this,arguments);
  };
  try {
    delete require.cache[serviceFile];
    delete require.cache[jobFile];
    Service=require(serviceFile);
    const errorMatcher=err=>err?.code==='RETENTION_LEGACY_CLEANUP_RETIRED';
    await assert.rejects(Service.deleteExpiredData('synthetic-no-real-account',['votes_opinions']),errorMatcher);
    await assert.rejects(Service.deleteAllExpiredData(['user_profile']),errorMatcher);
    await assert.rejects(Service.performFullCleanup(),errorMatcher);
    assert.throws(()=>Service.assertLegacyRetentionWriteUnavailable(),errorMatcher);
    const job=require(jobFile);
    assert.throws(()=>job.start(),errorMatcher);
    await assert.rejects(job.performDailyCleanup(),errorMatcher);
    await assert.rejects(job.performImmediateCleanup(),errorMatcher);
    assert.deepEqual(job.getStatus(),{
      isRunning:false,hasCleanupInterval:false,hasNotificationInterval:false
    });
    assert.equal(touched.db,0,'No SQL reads or UPDATEs');
    assert.equal(touched.audit,0,'No audit/retention writes');
  } finally {
    Module._load=originalLoad;
    delete require.cache[serviceFile];
    delete require.cache[jobFile];
    if(previousService)require.cache[serviceFile]=previousService;
    if(previousJob)require.cache[jobFile]=previousJob;
  }
});
