'use strict';
// Public directories: real Express routers and loopback HTTP, synthetic database only.
// No provider credentials, real user data, writes, or external network calls.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

// The production reader is fail-closed. This separate synthetic HTTP suite
// deliberately enables the explicit gate to exercise public minimization;
// the dedicated gate test verifies that absent/disabled flags reveal nothing.
const previousNominationFlag=process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED;
process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED='true';

const privatePerson = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Persona sintetica',
  cognome: 'Esempio',
  email: 'private@example.invalid',
  ruolo: 'A',
  status: 'A',
  created_at: '2026-01-01',
  updated_at: '2026-06-01',
  avatar_config: '{}',
  genere: 'F',
  data_nascita: '1990-01-01',
  cittadinanza: 'test-secret',
  paese_residenza: 'test-secret',
  regione_residenza: 'TO',
  provincia_residenza: 'test-secret',
  comune_residenza: 'test-secret',
  facebook_url: 'https://example.invalid/profile',
  tipologie_attivismo: [{ tipo: 'ambiente' }]
};

let failDatabase = false;
let injectUnexpectedFields = false;
let largeDirectory = false;
const makeId = n => '00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const queries = [];
const fakePool = {
  async query(statement, params=[]) {
    const sql = String(statement);
    queries.push(sql);
    if (failDatabase) throw new Error('PRIVATE_DB_CREDENTIAL_OR_SQL_ERROR');
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error('Read-only test forbids DB writes');
    if (sql.includes('FROM subject_proposals')) {
      return { rows: [{ id: 'approved-fixture', title: 'Soggetto approvato' }] };
    }
    if (sql.includes('FROM users u')) {
      // Simulate PostgreSQL SELECT projection: a private column appears in JSON
      // iff the real route asked for that column. This detects SELECT regressions.
      const projection = sql.match(/\bSELECT\s+([\s\S]*?)\s+FROM users u\b/i)?.[1];
      assert.ok(projection, 'expected user list SELECT');
      if (largeDirectory) {
        const paged = /LIMIT 101/.test(sql);
        const items=Array.from({length:105},(_,i)=>{
          const n=105-i;
          return {
            id:makeId(n),nome:'Persona sintetica '+n,cognome:'Esempio',ruolo:'A',
            avatar_config:'{}',regione_residenza:'TO',tipologie_attivismo:[{tipo:'ambiente'}],
            supporters_count:7,
            email:'private@example.invalid',cittadinanza:'secret'
          };
        });
        const cursorId=sql.includes('SELECT cursor_user.created_at')?params.at(-1):null;
        return {rows:items.filter(row=>!cursorId||row.id<cursorId).slice(0,paged?101:undefined)};
      }
      assert.doesNotMatch(projection, /\b(?:u\.)?\*\b|\bu\.\*/, 'no SELECT * from public user profiles');
      const row = {};
      for (const [column, value] of Object.entries(privatePerson)) {
        const pattern = new RegExp('\\b(?:u\\.)?' + column + '\\b(?=\\s*,|\\s+FROM\\b|\\s*$)');
        if (pattern.test(projection)) row[column] = value;
      }
      if (/\bAS supporters_count\b/i.test(projection)) row.supporters_count = 3;
      // Simulate a later database adapter unexpectedly adding private columns.
      if (injectUnexpectedFields) Object.assign(row, privatePerson);
      return { rows: [row] };
    }
    return { rows: [] };
  }
};

// Override only provider dependencies before importing the production routers.
const db = require.resolve('../config/database');
const accounts = require.resolve('../services/accountCapabilitiesService');
require.cache[db] = { id: db, filename: db, loaded: true, exports: { getPool: () => fakePool } };
require.cache[accounts] = {
  id: accounts, filename: accounts, loaded: true,
  exports: {
    queryWithAccountModelFallback: (_pool, modernSql, _legacySql, values) =>
      fakePool.query(modernSql, values)
  }
};

const app = express();
app.use('/api/attivisti', require('../routes/attivisti'));
app.use('/api/organizzazioni', require('../routes/organizzazioni'));
const server = http.createServer(app);
let origin;
async function request(path) {
  if (!origin) {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
  }
  return fetch(origin + path);
}
after(async () => {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  if (previousNominationFlag==null) delete process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED;
  else process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED=previousNominationFlag;
});

async function checkPublicDirectory(path, expectApproved) {
  const response = await request(path);
  assert.equal(response.status, 200, 'GET ' + path);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.length, 1);
  const user = payload.data[0];
  assert.equal(user.nome, privatePerson.nome);
  assert.equal(user.id, privatePerson.id);
  assert.equal(user.regione_residenza, 'TO');
  assert.equal(user.avatar_config, null, 'empty avatar uses the safe default rather than an arbitrary JSON object');
  assert.deepEqual(user.tipologie_attivismo, [{ tipo: 'ambiente' }]);
  for (const field of [
    'email', 'genere', 'data_nascita', 'cittadinanza',
    'paese_residenza', 'provincia_residenza', 'comune_residenza',
    'status', 'created_at', 'updated_at'
  ]) {
    assert.equal(Object.hasOwn(user, field), false, 'public field leak: ' + field);
  }
  if (expectApproved) {
    assert.deepEqual(payload.approved_subjects, [{ id: 'approved-fixture', title: 'Soggetto approvato' }]);
  }
  assert.doesNotMatch(JSON.stringify(payload), /private@example\.invalid|test-secret/);
}

test('GET /api/attivisti anonymized public projection', async () => {
  await checkPublicDirectory('/api/attivisti', true);
});

test('GET /api/attivisti/tipologia/:tipo also excludes personal columns', async () => {
  await checkPublicDirectory('/api/attivisti/tipologia/ambiente', false);
});

test('GET /api/organizzazioni anonymized public projection', async () => {
  await checkPublicDirectory('/api/organizzazioni', true);
});

test('public user lists reject private fields added unexpectedly by a database adapter', async () => {
  injectUnexpectedFields = true;
  try {
    await checkPublicDirectory('/api/attivisti', true);
    await checkPublicDirectory('/api/attivisti/tipologia/ambiente', false);
    await checkPublicDirectory('/api/organizzazioni', true);
  } finally {
    injectUnexpectedFields = false;
  }
});

test('database errors do not expose SQL or credentials in public JSON', async () => {
  failDatabase = true;
  try {
    for (const path of ['/api/attivisti', '/api/organizzazioni']) {
      const response = await request(path);
      assert.equal(response.status, 500);
      assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE_DB_CREDENTIAL_OR_SQL_ERROR/);
      assert.match(response.headers.get('cache-control') || '', /no-store/);
    }
  } finally {
    failDatabase = false;
  }
});

test('older Android and web clients without pagination opt-in still receive all registered profiles',async()=>{
  largeDirectory=true;
  try{
    for(const url of ['/api/attivisti','/api/organizzazioni','/api/attivisti/tipologia/ambiente']){
      const before=queries.length;
      const response=await request(url);
      assert.equal(response.status,200,url);
      const data=await response.json();
      assert.equal(data.data.length,105,'legacy client must not silently lose profiles');
      assert.equal(data.count,105);
      assert.equal(data.members_next_cursor,null);
      assert.equal(new Set(data.data.map(row=>row.id)).size,105);
      assert.equal(data.data[0].id,makeId(105));
      assert.equal(data.data.at(-1).id,makeId(1));
      assert.equal(JSON.stringify(data).includes('private@example.invalid'),false);
      const next=queries.slice(before).find(sql=>sql.includes('FROM users u'));
      assert.ok(next);
      assert.doesNotMatch(next,/LIMIT 101/,'legacy route retains pre-existing full-list behavior');
      if(!url.includes('/tipologia/')){
        assert.deepEqual(data.approved_subjects,[{id:'approved-fixture',title:'Soggetto approvato'}]);
      }
    }
  }finally{largeDirectory=false;}
});

test('registered profiles paginate at 100 for every public directory, without exposing private fields',async()=>{
  largeDirectory=true;
  try{
    for (const url of ['/api/attivisti','/api/organizzazioni','/api/attivisti/tipologia/ambiente']){
      const start=queries.length;
      const first=await request(url+'?members_paged=1');
      assert.equal(first.status,200,url);
      const a=await first.json();
      assert.equal(a.data.length,100,url);
      assert.equal(a.count,100,url);
      assert.equal(typeof a.members_next_cursor,'string');
      const decoded=JSON.parse(Buffer.from(a.members_next_cursor,'base64url').toString('utf8'));
      assert.equal(decoded.length,2,'cursor must never reveal profile registration time');
      assert.equal(decoded[0],7);
      assert.deepEqual(Object.keys(a.data[0]).sort(),
        ['avatar_config','cognome','id','nome','regione_residenza','ruolo','supporters_count','tipologie_attivismo'].sort());
      assert.ok(!JSON.stringify(a).includes('private@example.invalid'));
      assert.ok(!JSON.stringify(a).includes('1793880000.123456'));
      const secondUrl=url+'?members_paged=1&members_cursor='+encodeURIComponent(a.members_next_cursor);
      const second=await request(secondUrl);
      assert.equal(second.status,200,secondUrl);
      const b=await second.json();
      assert.equal(b.data.length,5,url);
      assert.equal(b.members_next_cursor,null,url);
      const ids=[...a.data,...b.data].map(x=>x.id);
      assert.equal(new Set(ids).size,105,'all 105 unique registered profiles visible with keyset');
      assert.equal(ids[0],makeId(105));
      assert.equal(ids.at(-1),makeId(1));
      assert.ok(!JSON.stringify(b).includes('private@example.invalid'));
      if(url!=='/api/attivisti/tipologia/ambiente'){
        assert.equal(a.approved_subjects.length,1,'initial request keeps approved nominations');
        assert.deepEqual(b.approved_subjects,[],'member-only pagination does not repeat approved titles');
        const queriesInPages=queries.slice(start);
        assert.equal(queriesInPages.filter(sql=>sql.includes('FROM subject_proposals')).length,1,
          'no extra approved-subject query for registered-profile next page');
      }
      const beforeInvalid=queries.length;
      for(const bad of ['***','A'.repeat(221),Buffer.from('["bad"]').toString('base64url')]){
        const invalid=await request(url+(url.includes('?')?'&':'?')+'members_cursor='+encodeURIComponent(bad));
        assert.equal(invalid.status,400);
        assert.match(invalid.headers.get('cache-control') || '',/no-store/,
          'invalid cursor responses cannot be cached');
        assert.equal(queries.length,beforeInvalid,'reject bad cursor before SQL');
      }
    }
  }finally{largeDirectory=false;}
});

test('malformed public directory filters return uncached 400 without a SQL read', async () => {
  const invalidQueries = [
    'search=alpha&search=beta',
    'search[]=alpha',
    'regione[hidden]=TO',
    'tipologia[]=ambiente',
    'exclude_user_id=not-a-uuid',
    'exclude_user_id[]=11111111-1111-4111-8111-111111111111',
    'search='+'x'.repeat(257)
  ];
  for (const directory of ['/api/attivisti','/api/organizzazioni']) {
    for (const query of invalidQueries) {
      const countBefore = queries.length;
      const response = await request(directory+'?'+query);
      assert.equal(response.status, 400, directory+'?'+query);
      assert.match(response.headers.get('cache-control') || '', /no-store/);
      assert.equal((await response.json()).success, false);
      assert.equal(queries.length,countBefore,'malformed query must not touch SQL');
    }
    const valid = await request(directory+'?search=Persona&regione=Toscana&tipologia=ambiente');
    assert.equal(valid.status,200,'legitimate searches remain available');
  }
});

test('pagination switches cannot bypass bounded public directory requests',async()=>{
  const paths=['/api/attivisti','/api/organizzazioni','/api/attivisti/tipologia/ambiente'];
  const invalid=[
    'members_paged[]=1',
    'members_paged[foo]=1',
    'members_paged=1&members_paged=0',
    'members_paged=arbitrary',
    'members_paged=true',
    'search[]=private',
    'regione[hidden]=private'
  ];
  for(const path of paths){
    for(const query of invalid){
      const before=queries.length;
      const response=await request(path+'?'+query);
      assert.equal(response.status,400,'reject invalid pagination/query: '+path+'?'+query);
      assert.match(response.headers.get('cache-control')||'',/no-store/);
      assert.equal(queries.length,before,'must not touch SQL for invalid params');
    }
    for(const suffix of ['?members_paged=0','?members_paged=1']){
      const response=await request(path+suffix);
      assert.equal(response.status,200,'valid opt-in or legacy mode remains functional');
    }
  }
});

test('all database calls from public directory HTTP fixtures are reads', () => {
  assert.ok(queries.length >= 5);
  for (const sql of queries) assert.match(sql, /^\s*SELECT\b/i);
});
