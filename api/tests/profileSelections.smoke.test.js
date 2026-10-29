const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/user/profile-selections.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const handlers = {};
let consentGranted = true;
let queryCount = 0;
let queriedSql;
const pool = {
  async query(sql, params) {
    queryCount++;
    queriedSql = sql;
    assert.deepEqual(Array.from(params), ['synthetic-owner']);
    return { rows: [{
      capo_stato: ['Una persona inventata'], grazia: [],
      amnistia: ['Norma inventata'], iniziativa_popolare: [],
      attivista: { id:'fake-activist', nome:'Attivista Fittizio' },
      organizzazione: null,
    }] };
  },
};
function chain(req, res, next, middleware) {
  return Promise.resolve(middleware(req, res, next));
}
const mockRequire = name => {
  if (name === 'express') return { Router: () => ({ get: (route,...stack) => { handlers[route]=stack; } }) };
  if (name === '../../middleware/auth') return {
    pool, verifyToken: (req,res,next) => req.userId ? next() : res.status(401).json({success:false}),
  };
  if (name === '../../middleware/politicalConsent') return {
    requirePoliticalConsent: (req,res,next) => consentGranted ? next() : res.status(403).json({success:false}),
  };
  throw Error('unexpected import '+name);
};
vm.runInNewContext(source, {
  require:mockRequire, module:{ exports:{} }, console,
});
function execute(userId) {
  return new Promise((resolve,reject) => {
    let status = 200,headers={},done=false;
    const req={userId};
    const res={
      set:(k,v)=>{headers[k]=v;return res;},
      status:(s)=>{status=s;return res;},
      json:(data)=>{if(!done){done=true;resolve({status,data,headers});}return res;},
    };
    const stack=handlers['/'];
    if(!stack)return reject(new Error('no route'));
    let i=0;
    const next=()=>{const middleware=stack[i++];if(middleware)Promise.resolve(chain(req,res,next,middleware)).catch(reject);};
    next();
  });
}
test('mounted at an authenticated, rate-limited private endpoint',()=>{
  assert.match(app,/app\.use\('\/api\/user\/profile-selections', userLimiter, profileSelectionsRoutes\)/);
  assert.match(source,/router\.get\('\/', verifyToken, requirePoliticalConsent/);
  assert.match(source,/WHERE u\.id = \$1/);
  assert.match(source,/FROM voti_capo_stato v/);
  assert.match(source,/FROM voti_grazia v/);
  assert.match(source,/FROM voti_amnistia v/);
  assert.match(source,/FROM voti_iniziative_popolari v/);
  assert.match(source,/FROM civic_processes cp/);
  assert.match(source,/cp\.id::text = v\.iniziativa_id/);
  assert.match(source,/JOIN civic_processes cp ON cp\.id = csr\.civic_process_id/);
  assert.match(source,/FROM iniziative_ministero m/);
  assert.match(source,/LEFT JOIN users a ON a\.id = u\.attivisti/);
  assert.match(source,/LEFT JOIN users o ON o\.id = u\.organizzazioni/);
});
test('returns only actual selections, with private no-store headers',async()=>{
  queryCount=0;consentGranted=true;
  const r=await execute('synthetic-owner');
  assert.equal(r.status,200);
  assert.equal(r.headers['Cache-Control'],'private, no-store, max-age=0');
  assert.equal(queryCount,1);
  assert.ok(queriedSql.includes('userid = u.id'));
  assert.deepEqual(Array.from(r.data.data.grazia),[]);
  assert.equal(r.data.data.organizzazione,null);
  assert.equal(r.data.data.attivista.nome,'Attivista Fittizio');
});
test('missing authorization or revoked political consent denies all reads',async()=>{
  queryCount=0;
  const noAuth=await execute(null);
  assert.equal(noAuth.status,401);
  consentGranted=false;
  const revoked=await execute('synthetic-owner');
  assert.equal(revoked.status,403);
  assert.equal(queryCount,0);
});

test('legacy encrypted initiative IDs are re-resolved once, then cached again', () => {
  const hook = fs.readFileSync(path.join(__dirname, '../../client/src/pages/Profilo/hooks/useProfileData.ts'), 'utf8');
  const vault = fs.readFileSync(path.join(__dirname, '../../client/src/pages/Profilo/utils/encryptedProfileVault.ts'), 'utf8');
  assert.match(hook, /const PROFILE_PREFERENCES_VERSION = 2/);
  assert.match(hook, /snapshot\.preferencesVersion === PROFILE_PREFERENCES_VERSION/);
  assert.match(hook, /preferencesVersion: PROFILE_PREFERENCES_VERSION/);
  assert.match(vault, /preferencesVersion\?: number/);
});
