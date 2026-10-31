'use strict';
// Isolated route tests: no Supabase, no real account, no HTTP/network or DB.
// Verify the generic backend can never create or approve a second Grazia queue.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routeSource = fs.readFileSync(path.join(__dirname, '../routes/subject-proposals.js'), 'utf8');
const TEST_USER = '11111111-1111-4111-8111-111111111111';
const TEST_PROPOSAL = '22222222-2222-4222-8222-222222222222';

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    set(key, value) { this.headers[key] = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

function harness({legacyGraziaReview = false} = {}) {
  const methods = {get: new Map(), post: new Map()};
  const queries = [];
  let connects = 0;
  const router = {
    get(route, ...args) {methods.get.set(route, args.at(-1)); return router;},
    post(route, ...args) {methods.post.set(route, args.at(-1)); return router;}
  };
  async function query(statement, args = []) {
    const sql = String(statement);
    queries.push({sql, args});
    if (sql.startsWith('SELECT * FROM subject_proposals')) {
      return {rows: legacyGraziaReview ? [{id: TEST_PROPOSAL, category: 'grazia', title: 'Persona sintetica', proposer_user_id: TEST_USER}] : []};
    }
    if (sql.startsWith('INSERT INTO subject_proposals')) {
      return {rows:[{id:TEST_PROPOSAL,category:args[1],title:args[2],created_at:'2026-10-31T00:00:00Z'}]};
    }
    return {rows: []};
  }
  const pool = {
    query,
    async connect() {connects++; return {query, release() {}};}
  };
  const noop = (_req, _res, next) => next && next();
  const moduleShim = {exports:{}};
  const stubs = {
    express: {Router: () => router},
    '../config/database': {getPool: () => pool},
    '../middleware/auth': {verifyToken: noop, requireAdmin: noop}
  };
  vm.runInNewContext(routeSource, {
    module: moduleShim,
    require(name) {
      if (!(name in stubs)) throw new Error('Unexpected dependency: ' + name);
      return stubs[name];
    },
    URL, Set,
  }, {filename:'subject-proposals.js'});
  assert.equal(moduleShim.exports, router);
  return {methods, queries, get connects() {return connects;}};
}

test('POST Grazia to the generic endpoint is rejected before any database access', async () => {
  const app = harness();
  const res = mockResponse();
  await app.methods.post.get('/')({user:{id:TEST_USER},body:{
    category:'grazia',title:'Persona sintetica',source_url:'https://example.org/fonte',
  }}, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'GRAZIA_CODA_UNICA');
  assert.equal(app.connects, 0);
  assert.equal(app.queries.length, 0);
});

test('GET /mine Grazia cannot query the noncanonical generic queue', async () => {
  const app = harness();
  const res = mockResponse();
  await app.methods.get.get('/mine')({user:{id:TEST_USER},query:{category:'grazia'}},res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'GRAZIA_CODA_UNICA');
  assert.equal(app.queries.length, 0);
});

test('Admin generic queue explicitly excludes the Grazia category', async () => {
  const app = harness();
  const res = mockResponse();
  await app.methods.get.get('/admin')({},res);
  assert.equal(res.statusCode, 200);
  assert.match(app.queries[0].sql, /status='pending' AND category <> 'grazia'/);
  assert.doesNotMatch(app.queries[0].sql, /proposer_user_id/,'no proponent UUID in Admin list projection');
  assert.deepEqual(res.body.proposals, []);
});

test('Even a legacy Grazia row cannot be approved by generic moderation', async () => {
  const app = harness({legacyGraziaReview:true});
  const res = mockResponse();
  await app.methods.post.get('/admin/:id/decision')({
    user:{id:TEST_USER},params:{id:TEST_PROPOSAL},body:{decision:'approve'},
  },res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'GRAZIA_CODA_UNICA');
  assert.ok(app.queries.some(x=>x.sql==='ROLLBACK'));
  assert.equal(app.queries.some(x=>/INSERT INTO (grazia_carcerati|subject_proposals)/.test(x.sql)),false);
});

test('Other four category submissions still write only subject_proposals', async () => {
  const app = harness();
  const res = mockResponse();
  await app.methods.post.get('/')({user:{id:TEST_USER},body:{
    category:'organizzazioni',title:'Organizzazione sintetica',
    source_url:'https://example.org/fonte',details:'Fonte pubblica',
  }},res);
  assert.equal(res.statusCode,201);
  assert.equal(res.body.status,'pending');
  assert.equal(app.connects,1);
  assert.equal(app.queries.filter(x=>x.sql.startsWith('INSERT INTO subject_proposals')).length,1);
  assert.equal(app.queries.some(x=>/INSERT INTO grazia_carcerati/.test(x.sql)),false);
});
