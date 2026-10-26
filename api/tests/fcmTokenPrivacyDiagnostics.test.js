'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {safeFcmErrorCode}=require('../utils/fcmDiagnostics');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('only bounded diagnostic codes may enter FCM logs',()=>{
  const secret='token-PRIVATE-1234567890';
  assert.equal(safeFcmErrorCode({code:'messaging/registration-token-not-registered',message:secret}),
    'messaging/registration-token-not-registered');
  assert.equal(safeFcmErrorCode({code:'23514'}),'23514');
  assert.equal(safeFcmErrorCode({code:'app/invalid-credential'}),'app/invalid-credential');
  assert.equal(safeFcmErrorCode({code:secret}),'FCM_UNCLASSIFIED');
  assert.equal(safeFcmErrorCode({code:'messaging/'+secret}),'FCM_UNCLASSIFIED');
  assert.equal(safeFcmErrorCode({message:secret}),'FCM_UNCLASSIFIED');
});
test('communication sender cannot log FCM token fragments or unsanitized Firebase exceptions',()=>{
  const source=read('routes/comunicazioni.js');
  const sender=source.slice(source.indexOf('async function sendPushNotification('),
    source.indexOf('async function notifyAllUsers('));
  assert.doesNotMatch(sender,/fcmToken\??\.substring/);
  assert.doesNotMatch(sender,/sendError\.(?:message|stack)/);
  assert.doesNotMatch(sender,/JSON\.stringify\(data\)/);
  assert.match(sender,/safeFcmErrorCode\(sendError\)/);
});
test('bulk invalidations are scoped only to current recipient',()=>{
  const source=read('routes/comunicazioni.js');
  const bulk=source.slice(source.indexOf('async function notifyAllUsers('),
    source.indexOf('// GET /api/comunicazioni/debug-firebase-admin'));
  assert.match(bulk,/for \(const utente of utentiConPushResult\.rows\) \{\s*const fcmTokens = utente\.fcm_tokens \|\| \[\];\s*const validTokens = \[\];\s*const invalidTokens = \[\];/);
  assert.match(bulk,/invalidTokens\.push\(token\)/);
  assert.match(bulk,/invalidateUserFcmTokens\(utente\.id, invalidTokens\)/);
  assert.doesNotMatch(bulk,/invalidTokens\.map\(t => t\.token\)/);
});
test('unknown push errors cannot remove mobile registration',()=>{
  const src=read('routes/comunicazioni.js');
  const single=src.slice(src.indexOf("router.post('/send-user-notification'"),
    src.indexOf('async function notifyAllUsers('));
  assert.match(single,/error\?\.code === 'messaging\/registration-token-not-registered'/);
  assert.match(single,/error\?\.code === 'messaging\/invalid-registration-token'/);
  assert.doesNotMatch(single,/invalidTokens\.push\(token\);\s*debugLog\(`    🗑️ Token \$\{i \+ 1\} marcato per rimozione a causa di eccezione/);
});
test('operational alerts recheck recipients and all auxiliary senders mask error messages',()=>{
  const ops=read('services/operationalAlertService.js');
  const supporters=read('services/currentSupporterPushService.js');
  const av=read('routes/avvistamenti.js');
  assert.match(ops,/isUserFcmTokenEligible\(pool/);
  assert.match(ops,/if \(!eligible\) continue/);
  assert.doesNotMatch(ops,/console\.error\('Operational alert delivery failed:', error\.message/);
  assert.doesNotMatch(supporters,/error\?\.code \|\| error\?\.message/);
  assert.doesNotMatch(av,/details: error\.message/);
});

test('GET diagnostics never sends Firebase messages or exposes token prefixes',()=>{
  const source=read('routes/comunicazioni.js');
  const getDebug=source.slice(source.indexOf("router.get('/debug-firebase-admin'"),
    source.indexOf("router.get('/debug-notifiche-demos'"));
  const getNotifiche=source.slice(source.indexOf("router.get('/debug-notifiche-demos'"),
    source.indexOf("router.get('/ultima-comunicazione'"));
  assert.doesNotMatch(getDebug,/messaging\.send\(/);
  assert.doesNotMatch(getDebug,/testError\.message|error\.stack/);
  assert.match(getDebug,/Diagnostica sola lettura: nessuna notifica di test inviata/);
  assert.doesNotMatch(getNotifiche,/preview:|substring\(0, 30\)/);
  assert.match(getNotifiche,/numero_token_fcm: fcmTokens\.length/);
});
