'use strict';
// All I/O is confined to a freshly-created disposable directory in os.tmpdir.
// Separate Node children are ONLY synthetic contenders, never provider clients.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {PREFIX,reserveSyntheticDiskClaim:reserve}=
  require('./fixtures/gdprB2DiskReservationSynthetic');
const HASH=crypto.createHash('sha256').update('invented-erasure-event')
  .digest('hex');
const KEY='synthetic_event_one';
function sandbox(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),PREFIX));
  return {dir,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
const request=(key=KEY,digest=HASH)=>({
  key,digest,sqlDigest:digest,sqlPhase:'UNKNOWN'
});
function denied(fn,reason){
  assert.throws(fn,{code:'GDPR_MODEL_DISK_'+reason});
}
const childProgram=[
  'const {reserveSyntheticDiskClaim:reserve}=require('+
    JSON.stringify(path.join(__dirname,'fixtures/gdprB2DiskReservationSynthetic'))+');',
  'try { reserve(process.env.GDPR_SYNTHETIC_DIR,{key:process.env.GDPR_SYNTHETIC_KEY,'+
    'digest:process.env.GDPR_SYNTHETIC_SHA,sqlDigest:process.env.GDPR_SYNTHETIC_SHA,'+
    "sqlPhase:'UNKNOWN'}); process.stdout.write('PERMIT'); }",
  "catch(e){process.stdout.write(e.code||'DENIED');}"
].join('\n');
function runChild(dir,key=KEY,digest=HASH){
  return new Promise((resolve,reject)=>{
    const proc=spawn(process.execPath,['-e',childProgram],{
      env:{GDPR_SYNTHETIC_DIR:dir,GDPR_SYNTHETIC_KEY:key,
        GDPR_SYNTHETIC_SHA:digest},stdio:['ignore','pipe','pipe']
    });
    let output='',errors='';
    proc.stdout.on('data',d=>{output+=d;});
    proc.stderr.on('data',d=>{errors+=d;});
    proc.on('error',reject);
    proc.on('close',code=>{
      if(code!==0)reject(Error('SYNTHETIC_CHILD_FAILED: '+errors.slice(0,300)));
      else resolve(output);
    });
  });
}

test('one local claim is fsynced and all later attempts are denied',t=>{
  const s=sandbox();t.after(s.close);
  const result=reserve(s.dir,request());
  assert.equal(result.syntheticOneShot,true);
  assert.equal(result.realB2PutAuthorized,false);
  assert.equal(result.productionRecoveryReady,false);
  assert.equal(result.externalWitnessDurabilityVerified,false);
  const files=fs.readdirSync(s.dir);
  assert.deepEqual(files,['claim-'+KEY+'.json']);
  const marker=JSON.parse(fs.readFileSync(path.join(s.dir,files[0]),'utf8'));
  assert.deepEqual(marker,{key:KEY,digest:HASH,phase:'RESERVED',synthetic:true});
  denied(()=>reserve(s.dir,request()),'RESERVATION_ALREADY_EXISTS');
});

test('new Node process after first reservation cannot replay it',async t=>{
  const s=sandbox();t.after(s.close);
  reserve(s.dir,request());
  assert.equal(await runChild(s.dir),'GDPR_MODEL_DISK_RESERVATION_ALREADY_EXISTS');
});

test('simultaneous independent Node processes obtain at most one local permit',async t=>{
  const s=sandbox();t.after(s.close);
  const results=await Promise.all(Array.from({length:5},()=>runChild(s.dir)));
  assert.equal(results.filter(x=>x==='PERMIT').length,1);
  assert.equal(results.filter(x=>x==='GDPR_MODEL_DISK_RESERVATION_ALREADY_EXISTS').length,4);
  denied(()=>reserve(s.dir,request()),'RESERVATION_ALREADY_EXISTS');
});

test('crash immediately after exclusive create leaves an incomplete tombstone',t=>{
  const s=sandbox();t.after(s.close);
  denied(()=>reserve(s.dir,{...request(),crashAt:'afterCreate'}),
    'INJECTED_CRASH');
  assert.equal(fs.readFileSync(path.join(s.dir,'claim-'+KEY+'.json')).length,0);
  denied(()=>reserve(s.dir,request()),'RESERVATION_ALREADY_EXISTS');
});

test('crash after fsync of file but before directory fsync stays NO-GO',t=>{
  const s=sandbox();t.after(s.close);
  denied(()=>reserve(s.dir,{...request(),crashAt:'afterFileSync'}),
    'INJECTED_CRASH');
  denied(()=>reserve(s.dir,request()),'RESERVATION_ALREADY_EXISTS');
});

test('crash after directory fsync but before result cannot issue a second permit',t=>{
  const s=sandbox();t.after(s.close);
  denied(()=>reserve(s.dir,{...request(),crashAt:'afterDirSync'}),
    'INJECTED_CRASH');
  denied(()=>reserve(s.dir,request()),'RESERVATION_ALREADY_EXISTS');
});

test('identical key with changed digest is not treated as safe reissue',t=>{
  const s=sandbox();t.after(s.close);
  reserve(s.dir,request());
  const changed=crypto.createHash('sha256').update('different').digest('hex');
  denied(()=>reserve(s.dir,request(KEY,changed)),'RESERVATION_ALREADY_EXISTS');
});

test('missing SQL claim, malformed digest/key or invalid crash point never writes',t=>{
  const s=sandbox();t.after(s.close);
  for(const bad of [
    {...request(),sqlDigest:'0'.repeat(64)},
    {...request(),sqlPhase:'VERIFIED'},
    {...request(),key:'../unsafe'},
    {...request(),digest:'bad',sqlDigest:'bad'},
    {...request(),crashAt:'beforeWrite'}
  ]){
    denied(()=>reserve(s.dir,bad),
      bad.crashAt==='beforeWrite'?'INVALID_CRASH_POINT':'SQL_INTENT_NOT_VERIFIED');
  }
  assert.deepEqual(fs.readdirSync(s.dir),[]);
});

test('sandbox restrictions prevent writes to unrelated folders and symlink roots',t=>{
  const s=sandbox();t.after(s.close);
  const link=path.join(os.tmpdir(),PREFIX+'link-'+process.pid+'-'+Date.now());
  try {
    fs.symlinkSync(s.dir,link,'dir');
    for(const outside of [os.tmpdir(),process.cwd(),link]) {
      denied(()=>reserve(outside,request()),'INVALID_DIRECTORY');
    }
  } finally {fs.rmSync(link,{force:true});}
  assert.deepEqual(fs.readdirSync(s.dir),[]);
});

test('distinct valid keys may reserve separately but never grant a recovery GO',t=>{
  const s=sandbox();t.after(s.close);
  const first=reserve(s.dir,request('synthetic_one'));
  const second=reserve(s.dir,request('synthetic_two'));
  for(const x of [first,second]){
    assert.equal(x.productionRecoveryReady,false);
    assert.equal(x.externalWitnessDurabilityVerified,false);
    assert.equal(x.realB2PutAuthorized,false);
  }
  assert.equal(fs.readdirSync(s.dir).length,2);
});

test('NEGATIVE: deleting the whole local claim history permits unsafe replay',t=>{
  const s=sandbox();t.after(s.close);
  reserve(s.dir,request());
  // Deliberately simulate a rolled-back or deleted local marker. This is
  // NOT an acceptable recovery procedure or real durable external proof.
  fs.rmSync(path.join(s.dir,'claim-'+KEY+'.json'));
  const repeat=reserve(s.dir,request());
  assert.equal(repeat.syntheticOneShot,true,'MODEL VULNERABILITY');
  assert.equal(repeat.externalWitnessDurabilityVerified,false);
  assert.equal(repeat.productionRecoveryReady,false);
});
