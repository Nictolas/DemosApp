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
const publicAvatar = { skinColor: '#ffffff', hairStyle: 'short' };
const graziaAvatar = {
  skinColor: '#ffffff', hairStyle: 'short',
  hairColor: '#111111', mustacheColor: '#111111', beardColor: '#111111',
  suitColor: '#111111', tieColor: '#111111', glassesColor: '#111111',
  mustacheStyle: 'none', beardStyle: 'none', noseStyle: 'normal', glassesStyle: 'none'
};
const pool = {
  async query(sql, params) {
    queryCount++;
    queriedSql = sql;
    if (sql.includes('public.grazia_avatar_configs')) {
      assert.deepEqual(Array.from(params[0]), ['persona riservata']);
      return { rows: [{ nome_key:'persona riservata', avatar_config:graziaAvatar }] };
    }
    assert.deepEqual(Array.from(params), ['synthetic-owner', Boolean(params[1])]);
    return { rows: [{
      capo_stato: ['Una persona inventata'], grazia: params[1] ? ['Persona riservata'] : [],
      amnistia: ['Norma inventata'], iniziativa_popolare: [],
      opinione_proposta: 'Una legge inventata deve essere discussa',
      opinioni_proposte_votate: ['Embargo per Israele'],
      attivista: { id:'fake-activist', nome:'Attivista Fittizio' },
      organizzazione: null,
      attivista_avatar_config: publicAvatar,
      organizzazione_avatar_config: null,
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
  if (name === '../../services/governoVoteAvatars') return {
    loadGovernmentVoteAvatars: async (_pool,names) => names.length
      ? {'una persona inventata':publicAvatar} : {},
    parseExistingAvatar: value => value?.skinColor && value?.hairStyle ? value : null,
  };
  if (name === '../../services/graziaCatalog') return {
    displayGraziaName: name => name,
    normalizeGraziaName: name => name.trim().toLowerCase(),
  };
  if (name === '../../services/graziaAvatarConfig') return {
    parseGraziaAvatarConfig: value => value?.skinColor ? value : null,
  };
  throw Error('unexpected import '+name);
};
vm.runInNewContext(source, {
  require:mockRequire, module:{ exports:{} }, console,
});
function execute(userId, isAdmin = false) {
  return new Promise((resolve,reject) => {
    let status = 200,headers={},done=false;
    const req={userId,user:{isAdmin}};
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
  assert.match(source,/FROM voti_grazia v[\s\S]*AND \(\$2::boolean OR EXISTS/);
  assert.match(source,/gc\.attivo = TRUE AND gc\.pubblicato = TRUE/);
  assert.match(source,/FROM voti_amnistia v/);
  assert.match(source,/FROM voti_iniziative_popolari v/);
  assert.match(source,/FROM opinioni_proposte p/);
  assert.match(source,/FROM voti_opinioni_proposte v/);
  assert.match(source,/JOIN opinioni_proposte p ON p\.id::text = v\.opinione_id::text/);
  assert.match(source,/v\.utente_id = u\.id/);
  assert.match(source,/p\.id::text = u\.opinione_proposta_id::text/);
  assert.doesNotMatch(source,/JOIN users (?:proposer|proponent)/i);
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
  assert.equal(r.data.data.version,4);
  assert.deepEqual(Array.from(r.data.data.opinioniProposteVotate), ['Embargo per Israele']);
  assert.equal(r.data.data.opinioneProposta,'Una legge inventata deve essere discussa');
  assert.equal(r.data.data.capoStatoAvatars['una persona inventata'].hairStyle,'short');
  assert.equal(r.data.data.attivistaAvatar.hairStyle,'short');
  assert.equal(r.data.data.organizzazioneAvatar,null);
  assert.equal(Object.keys(r.data.data.graziaAvatars).length,0,
    'Non-Admin must never receive private Grazia avatars');
});
test('Grazia selections are visible to Admin, or to owners after individual publication',async()=>{
  const admin=await execute('synthetic-owner',true);
  assert.equal(admin.status,200);
  assert.deepEqual(Array.from(admin.data.data.grazia),['Persona riservata']);
  assert.equal(admin.data.data.graziaAvatars['persona riservata'].hairStyle,'short',
    'Only Admin can see a separately curated Grazia portrait');
  const ordinary=await execute('synthetic-owner',false);
  assert.deepEqual(Array.from(ordinary.data.data.grazia),[]);
  assert.equal(Object.keys(ordinary.data.data.graziaAvatars).length,0);
});
test('initiative votes resolve a human title from the canonical civic-process catalog', () => {
  assert.match(source, /FROM civic_processes cp/);
  assert.match(source, /cp\.id::text = v\.iniziativa_id/);
  assert.match(source, /cp\.canonical_title/);
  assert.match(source, /FROM iniziative_popolari p/);
  assert.match(source, /FROM iniziative_ministero m/);
  assert.match(source, /Iniziativa non più disponibile/);
  assert.doesNotMatch(source, /\), v\.iniziativa_id\s*\)/,
    'Never display the raw vote UUID as the initiative title');
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
