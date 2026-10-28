'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { convertToCSV } = require('../utils/gdprCsv');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware/auth.js'));
const validationPath = require.resolve(path.join(ROOT, 'middleware/validation.js'));
const auditPath = require.resolve(path.join(ROOT, 'services/auditService.js'));
const cryptoPath = require.resolve(path.join(ROOT, 'utils/emailCrypto.js'));
const routePath = require.resolve(path.join(ROOT, 'routes/user/gdpr-rights.js'));

const USER = '00000000-0000-4000-8000-000000000999';
const example = {
  id: USER, email: null, nome: null, cognome: null,
  sesso: 'F', genere: null, account_type: 'PERSON', ruolo: 'E', status: 'active',
  premium: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  data_nascita: '1993-04-05', cittadinanza: 'it',
  paese_residenza: 'it', regione_residenza: 'TO', provincia_residenza: 'PI',
  comune_residenza: 'Pisa', avatar_config: { color: 'blue' },
  paese_elezione: null, regione_elezione: null, provincia_elezione: null,
  comune_elezione: null, grado_elezione: null,
  paese_candidatura: null, regione_candidatura: null,
  provincia_candidatura: null, comune_candidatura: null, grado_candidatura: null,
  privacy_policy_consent: true, terms_of_service_consent: true,
  political_opinions_consent: false, consent_timestamp: null,
  consent_ip_address: null, consent_user_agent: null,
};

async function serve({ missing = false, fails = false } = {}, fn) {
  const keys = [authPath, validationPath, auditPath, cryptoPath, routePath];
  const originals = new Map(keys.map(key => [key, require.cache[key]]));
  const statements = [];
  const auditActions = [];
  const query = async (sql, params = []) => {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    statements.push({ sql: normalized, params });
    // Every request-specific SELECT must be parameterized by the authenticated user.
    if (/^SELECT\b/i.test(normalized) && !normalized.includes('COUNT(*)')) {
      assert.deepEqual(params, [USER], 'query must be scoped to the authenticated user');
    }
    if (normalized.includes('FROM users u') && normalized.includes('LEFT JOIN user_profile up')) {
      assert.match(normalized, /u\.sesso/);
      assert.match(normalized, /up\.avatar_config/);
      return { rows: missing ? [] : [example], rowCount: missing ? 0 : 1 };
    }
    if (normalized.includes('FROM opinioni_risposte o')) {
      assert.match(normalized, /o\.user_id = \$1/);
      assert.ok(!normalized.includes('FROM users WHERE'), 'legacy opinions source must not return');
      return { rows: [{ opinion_data: { energia_nucleare: 'favorevole', prova_csv: '=1+1' } }] };
    }
    if (normalized.includes('FROM voti_capo_stato')) {
      assert.match(normalized, /FROM voti_ice WHERE utente_id = \$1/);
      assert.ok(!normalized.includes('voti_ice WHERE userid'));
      return { rows: [{vote_type:'ice',vote_count:'0'}] };
    }
    if (normalized.includes('FROM comunicazioni')) {
      return { rows: [{ id: 'synthetic-message', titolo: '=SUM(1,1)', testo: 'test', likes: 0, dislikes: 0 }] };
    }
    if (normalized.includes('FROM user_notifications')) return { rows: [{id:1, read:false, message:'=HYPERLINK("test")'}] };
    if (normalized.includes('FROM user_auth_providers')) return { rows: [{provider:'google',provider_user_id:'synthetic-oauth'}] };
    if (normalized.includes('INSERT INTO user_rights_requests')) return { rows: [{id:'synthetic-request'}], rowCount:1 };
    if (fails) throw new Error('synthetic private database error 123');
    throw new Error('Unexpected SQL query: ' + normalized.slice(0,90));
  };
  const mock = (key, exports) => { require.cache[key] = {id:key,filename:key,loaded:true,exports}; };
  mock(authPath, { pool: {query,connect: async()=>{throw new Error('Unexpected connect')}}, verifyToken(req,_res,next) {req.userId=USER;next();} });
  mock(validationPath, { validateInput: () => (_req,_res,next)=>next() });
  mock(auditPath, {
    async logAction(args) { auditActions.push(args); },
    async getUserAuditLogs(userId) {assert.equal(userId,USER);return [];}
  });
  mock(cryptoPath, {decrypt: email => email});
  delete require.cache[routePath];
  let server;
  try {
    const app = express();
    app.use(express.json());
    app.use('/api/user', require(routePath));
    server = http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    await fn({url:'http://127.0.0.1:'+server.address().port,statements,auditActions});
  } finally {
    if (server) await new Promise(resolve=>server.close(resolve));
    for (const [key,previous] of originals) {
      if (previous) require.cache[key]=previous; else delete require.cache[key];
    }
  }
}

test('GDPR JSON export uses current opinion and ICE schema and correct personal fields',async()=>{
  await serve({},async({url,statements,auditActions})=>{
    const r=await fetch(url+'/api/user/data-export?format=json');
    assert.equal(r.status,200);
    const body=await r.json();
    assert.equal(body.success,true);
    const data=body.data;
    assert.equal(data.personal_data.basic_info.sesso,'F');
    assert.deepEqual(data.personal_data.basic_info.avatar_config,{color:'blue'});
    assert.equal(data.personal_data.basic_info.premium,undefined);
    assert.equal(data.personal_data.account_info.premium,false);
    assert.equal(data.personal_data.basic_info.account_type,'PERSON');
    assert.equal(data.political_opinions.energia_nucleare,'favorevole');
    assert.equal(data.consent_history.political_opinions_consent,false);
    assert.equal(data.communications[0].likes,0);
    assert.equal(data.notifications[0].read,false);
    assert.equal(data.voting_activity.vote_counts[0].vote_count,'0');
    assert.equal(data.personal_data.auth_providers[0].provider,'google');
    assert.equal(statements.filter(x=>x.sql.includes('INSERT INTO user_rights_requests')).length,1);
    assert.equal(auditActions.some(x=>x.resource==='user_data_export'),true);
  });
});

test('CSV export escapes formulas, preserves zero and false, and omits user id from filename',async()=>{
  await serve({},async({url})=>{
    const r=await fetch(url+'/api/user/data-export?format=csv');
    assert.equal(r.status,200);
    const txt=await r.text();
    assert.ok(txt.startsWith('\ufeff'));
    assert.ok(txt.includes('"communications.0.titolo","\'=SUM(1,1)"'));
    assert.ok(txt.includes('"notifications.0.read","false"'));
    assert.match(txt, /"'=SUM\(1,1\)"/);
    assert.match(txt, /"0"/);
    assert.match(txt, /"false"/);
    assert.ok(!String(r.headers.get('content-disposition')).includes(USER));
    assert.ok(txt.includes('"personal_data.basic_info.sesso","F"'));
  });
});

test('CSV serializer protects formula-leading whitespace and preserves scalar null/zero/false',()=>{
  const csv=convertToCSV({ a:0,b:false,c:null,d:' \t=2+2',e:'+CMD',f:'@name',g:'value,"quoted"\nline'});
  assert.match(csv, /"a","0"/);
  assert.match(csv, /"b","false"/);
  assert.match(csv, /"c",""/);
  assert.match(csv, /"d","' \t=2\+2"/);
  assert.match(csv, /"e","'\+CMD"/);
  assert.match(csv, /"f","'@name"/);
  assert.match(csv, /"g","value,""quoted""\nline"/);
});

test('unsupported export format rejects before any DB calls',async()=>{
  await serve({},async({url,statements})=>{
    const r=await fetch(url+'/api/user/data-export?format=xlsx');
    assert.equal(r.status,400);
    assert.equal(statements.length,0);
  });
});

test('missing account returns 404 and creates no export receipt',async()=>{
  await serve({missing:true},async({url,statements})=>{
    const r=await fetch(url+'/api/user/data-export?format=json');
    assert.equal(r.status,404);
    assert.equal(statements.length,1);
    assert.equal(statements.some(x=>x.sql.includes('INSERT INTO user_rights_requests')),false);
  });
});
