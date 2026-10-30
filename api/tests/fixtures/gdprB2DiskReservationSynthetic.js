'use strict';

// SYNTHETIC ONLY: local disposable filesystem, not external witness/B2.
// Exercises exclusive one-shot reservation across Node.js processes and
// failure windows without sending a network request or performing any PUT.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');

const ID=/^[a-zA-Z0-9_-]{1,80}$/;
const SHA=/^[0-9a-f]{64}$/;
const PREFIX='gdpr-b2-claim-synthetic-';
function fail(code) {
  const error=new Error('GDPR_MODEL_DISK_'+code);
  error.code=error.message;
  throw error;
}
function checkedDirectory(directory) {
  if(typeof directory!=='string')fail('INVALID_DIRECTORY');
  let actual,parent;
  try {
    actual=fs.realpathSync(directory);
    parent=fs.realpathSync(os.tmpdir());
  } catch (_) { fail('INVALID_DIRECTORY'); }
  // Prevent this test utility from ever writing anywhere but one direct
  // disposable temporary folder. Never use a production path.
  if(path.dirname(actual)!==parent ||
      !path.basename(actual).startsWith(PREFIX) ||
      fs.lstatSync(directory).isSymbolicLink() ||
      !fs.statSync(actual).isDirectory())fail('INVALID_DIRECTORY');
  return actual;
}
function reserveSyntheticDiskClaim(directory,{
  key,digest,sqlDigest,sqlPhase,crashAt
}={}) {
  const dir=checkedDirectory(directory);
  if(!ID.test(key||'') || !SHA.test(digest||'') ||
      sqlDigest!==digest || sqlPhase!=='UNKNOWN')
    fail('SQL_INTENT_NOT_VERIFIED');
  if(crashAt!==undefined && !['afterCreate','afterFileSync','afterDirSync']
    .includes(crashAt))fail('INVALID_CRASH_POINT');
  const file=path.join(dir,'claim-'+key+'.json');
  let fd=null,created=false;
  try {
    // O_EXCL is atomic on this synthetic local filesystem. A losing worker
    // cannot overwrite a marker, including an INCOMPLETE marker left by crash.
    const flags=fs.constants.O_WRONLY|fs.constants.O_CREAT|
      fs.constants.O_EXCL|fs.constants.O_NOFOLLOW;
    fd=fs.openSync(file,flags,0o600);
    created=true;
    if(crashAt==='afterCreate')fail('INJECTED_CRASH');
    const body=JSON.stringify({key,digest,phase:'RESERVED',synthetic:true});
    fs.writeFileSync(fd,body,{encoding:'utf8'});
    fs.fsyncSync(fd);
    if(crashAt==='afterFileSync')fail('INJECTED_CRASH');
    fs.closeSync(fd);
    fd=null;
    // Sync the directory entry, not just the file bytes, before returning
    // a one-shot synthetic permit.
    const dirFd=fs.openSync(dir,fs.constants.O_RDONLY|
      fs.constants.O_DIRECTORY);
    try { fs.fsyncSync(dirFd); }
    finally { fs.closeSync(dirFd); }
    if(crashAt==='afterDirSync')fail('INJECTED_CRASH');
    return Object.freeze({
      syntheticOneShot:true,
      productionRecoveryReady:false,
      externalWitnessDurabilityVerified:false,
      realB2PutAuthorized:false
    });
  } catch (e) {
    if(e?.code==='EEXIST')fail('RESERVATION_ALREADY_EXISTS');
    if(e?.code?.startsWith('GDPR_MODEL_DISK_'))throw e;
    // Never remove an ambiguous marker: filesystem outcome may be unknown.
    fail(created?'RESERVATION_OUTCOME_UNCERTAIN':'RESERVATION_UNAVAILABLE');
  } finally {
    if(fd!==null)try {fs.closeSync(fd);}catch(_){ /* fail closed */ }
  }
}
module.exports={PREFIX,reserveSyntheticDiskClaim};
