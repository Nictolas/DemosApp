'use strict';
// DEMOS12 synthetic privacy regression for the shared auth middleware.
// No real token, identity, email, database, or network request is used.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../middleware/auth.js'), 'utf8');
const MARK = 'PRIVATE_DEMOS12_TEST_ONLY_MARKER';

function loadAuth({verify = () => ({userId: 'synthetic-'+MARK, email: MARK, jti: 'test-jti'}),
  lookup = async () => ({
    id: 'synthetic-'+MARK, status: 'a', legacyRole: 'citizen',
    capabilities: {accountType: 'citizen', isAdmin: false, isActivist: false,
      isCandidate: false, isPolitician: false}
  }), cachedUser = null} = {}) {
  const logs = [];
  const fakeConsole = {
    log: (...args) => logs.push(args.map(String).join(' ')),
    error: (...args) => logs.push(args.map(String).join(' '))
  };
  const mocks = {
    '../utils/jwt': {verifyAccessToken: verify},
    '../config/database': {getPool: () => ({})},
    '../services/redisCache': {isEnabled: () => Boolean(cachedUser),
      getJson: async () => cachedUser, setJson: async () => {}},
    '../config/cacheKeys': {keys: {authUser: id => id}, ttl: {authUser: cachedUser ? 60 : 0}},
    '../services/accountCapabilitiesService': {getAccountSubject: lookup}
  };
  const module = {exports: {}};
  vm.runInNewContext(source, {
    module, exports: module.exports, console: fakeConsole,
    process: {env: {NODE_ENV: 'development'}},
    require: name => {
      if (!Object.hasOwn(mocks, name)) throw new Error('Unexpected dependency: '+name);
      return mocks[name];
    }
  }, {filename: 'synthetic-auth.js'});
  return {verifyToken: module.exports.verifyToken, requireAdmin: module.exports.requireAdmin, logs};
}
function response() {
  return {
    statusCode: 200, body: null,
    status(code) {this.statusCode=code; return this;},
    json(body) {this.body=body; return this;}
  };
}

test('synthetic valid access token retains authorization but no PII/debug URL in logs', async () => {
  const {verifyToken, logs} = loadAuth();
  const req = {
    headers: {authorization: 'Bearer synthetic-token-'+MARK},
    method: 'GET', url: '/api/subject-proposals/admin/?filter='+MARK
  };
  const res=response();
  let nextCalled=false;
  await verifyToken(req,res,()=>{nextCalled=true;});
  assert.equal(nextCalled,true);
  assert.equal(req.user.id, 'synthetic-'+MARK);
  assert.equal(req.user.isAdmin,false);
  assert.equal(res.body,null);
  assert.doesNotMatch(logs.join('\n'),/PRIVATE_DEMOS12_TEST_ONLY_MARKER/);
});

test('unexpected authentication exception returns generic 500 without internal error text', async () => {
  const {verifyToken,logs} = loadAuth();
  const headers = {};
  Object.defineProperty(headers,'authorization',{
    get() {throw new Error(MARK+' should not appear in response or logs');}
  });
  const res=response();
  await verifyToken({headers,method:'GET',url:'/api/subject-proposals/mine'},res,()=>{});
  assert.equal(res.statusCode,500);
  assert.equal(res.body.error,'Errore interno del server');
  assert.equal(Object.hasOwn(res.body,'details'),false);
  assert.doesNotMatch(JSON.stringify(res.body),/PRIVATE_DEMOS12_TEST_ONLY_MARKER/);
  assert.doesNotMatch(logs.join('\n'),/PRIVATE_DEMOS12_TEST_ONLY_MARKER/);
});

test('rejected access token remains 401 without leaking verification error', async () => {
  const {verifyToken,logs} = loadAuth({
    verify: () => {throw new Error('expired '+MARK);}
  });
  const res=response();
  await verifyToken({
    headers:{authorization:'Bearer synthetic-token'},
    method:'GET',url:'/api/subject-proposals/mine'
  },res,()=>{});
  assert.equal(res.statusCode,401);
  assert.equal(res.body.error,'Token scaduto');
  assert.doesNotMatch(logs.join('\n'),/PRIVATE_DEMOS12_TEST_ONLY_MARKER/);
});


const cachedAdmin = () => ({
  id: 'synthetic-'+MARK, status: 'a', legacyRole: 'AD',
  capabilities: {accountType: 'PERSON', isAdmin: true, isActivist: false,
    isCandidate: false, isPolitician: false}
});
const adminRequest = () => ({
  headers: {authorization: 'Bearer synthetic-token-'+MARK},
  method: 'GET', url: '/api/subject-proposals/admin'
});

test('cached Admin cannot retain revoked moderation privilege after fresh DB check', async () => {
  let reads = 0;
  const {verifyToken,requireAdmin,logs} = loadAuth({
    cachedUser: cachedAdmin(),
    lookup: async () => {reads++; return {...cachedAdmin(), capabilities: {
      ...cachedAdmin().capabilities, isAdmin: false
    }};}
  });
  const req=adminRequest(), res=response();
  let authorized=false;
  await verifyToken(req,res,()=>{});
  assert.equal(req.user.isAdmin,true,'cached capability is stale by design');
  assert.equal(reads,0,'cache hit does not query DB in verifyToken');
  await requireAdmin(req,res,()=>{authorized=true;});
  assert.equal(authorized,false);
  assert.equal(res.statusCode,403);
  assert.equal(res.body.error,'Accesso negato');
  assert.equal(reads,1,'fresh Admin check makes exactly one uncached DB lookup');
  assert.doesNotMatch(logs.join('\n'),/PRIVATE_DEMOS12_TEST_ONLY_MARKER/);
});

test('cached Admin session denied after suspension, deletion, or lookup outage', async () => {
  for (const mode of ['suspended','deleted','outage']) {
    let reads=0;
    const {verifyToken,requireAdmin,logs}=loadAuth({
      cachedUser:cachedAdmin(),
      lookup:async()=>{reads++;if(mode==='outage')throw Error(MARK);
        if(mode==='deleted')return null;
        return {...cachedAdmin(),status:'x'};}
    });
    const req=adminRequest(),res=response();let authorized=false;
    await verifyToken(req,res,()=>{});
    await requireAdmin(req,res,()=>{authorized=true;});
    assert.equal(authorized,false,mode);
    assert.equal(res.statusCode,mode==='outage'?500:403,mode);
    assert.equal(reads,1,mode);
    assert.doesNotMatch(JSON.stringify(res.body),/PRIVATE_DEMOS12_TEST_ONLY_MARKER/,mode);
    assert.doesNotMatch(logs.join('\n'),/PRIVATE_DEMOS12_TEST_ONLY_MARKER/,mode);
  }
});

test('current Admin retains access; fresh auth cache-miss adds no second query', async () => {
  for(const cacheHit of [true,false]){
    let reads=0,authorized=false;
    const {verifyToken,requireAdmin}=loadAuth({
      cachedUser:cacheHit?cachedAdmin():null,
      lookup:async()=>{reads++;return cachedAdmin();}
    });
    const req=adminRequest(),res=response();
    await verifyToken(req,res,()=>{});
    await requireAdmin(req,res,()=>{authorized=true;});
    assert.equal(authorized,true,cacheHit?'cached active Admin':'fresh active Admin');
    assert.equal(res.body,null);
    assert.equal(reads,1,'one total fresh lookup per Admin request');
  }
});
