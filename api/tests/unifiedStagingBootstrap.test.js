'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {validateBootstrapEnvironment, createBootstrapServer} = require('../staging/unified_staging_bootstrap');

test('rejects production and missing bootstrap authorization', () => {
  assert.throws(() => validateBootstrapEnvironment({NODE_ENV:'production', DEMOS_UNIFIED_STAGING_MODE:'bootstrap'}), /explicit non-production/);
  assert.throws(() => validateBootstrapEnvironment({NODE_ENV:'staging'}), /explicit non-production/);
  assert.deepEqual(validateBootstrapEnvironment({NODE_ENV:'staging', DEMOS_UNIFIED_STAGING_MODE:'bootstrap',PORT:'10000'}), {port:10000});
});
test('bootstrap exposes no app route and is never application-ready', async (t) => {
  const server = createBootstrapServer();
  server.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const get = (path,method='GET') => new Promise((resolve,reject) => {
    const req = http.request({host:'127.0.0.1',port,path,method},res => {
      let body=''; res.on('data',chunk=>body+=chunk);
      res.on('end',()=>resolve({code:res.statusCode,body:JSON.parse(body),headers:res.headers}));
    });
    req.on('error',reject);req.end();
  });
  const live=await get('/health');
  assert.equal(live.code,200);
  assert.equal(live.body.ready_for_app_tests,false);
  assert.equal(live.body.database_connected,false);
  assert.equal(live.body.notifications_enabled,false);
  assert.equal(live.headers['cache-control'],'no-store');
  assert.equal((await get('/health/ready')).code,503);
  assert.equal((await get('/api/notifiche')).code,404);
  assert.equal((await get('/health','POST')).code,405);
});
