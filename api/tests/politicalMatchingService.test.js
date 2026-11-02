const test = require('node:test');
const assert = require('node:assert/strict');

// Stub only the static grade catalogue; exercise the REAL matching service
// with minimal synthetic IDs, without any PostgreSQL or user data.
const Module = require('node:module');
const servicePath = require.resolve('../services/politicalMatchingService');
const oldLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename === servicePath && request === './opinionCatalog') {
    return { getOpinionIdsForGrade(grade) {
      return grade === 'E' ? ['o1','o2'] : grade === 'R' ? ['o1','o2','o3'] : ['o1','o2','o3','o4'];
    } };
  }
  return oldLoad.apply(this, arguments);
};
let getUserOpinionCompletion, buildPoliticalMatches;
try {
  ({getUserOpinionCompletion, buildPoliticalMatches} = require('../services/politicalMatchingService'));
} finally {
  Module._load = oldLoad;
}

function createPool({ rows, consentByUser={}, overrideByUser={}, outage=false }) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      sql = String(sql);
      calls.push({sql,params});
      if (!sql.includes('FROM opinioni_risposte r')) {
        throw Error('Unexpected extra SQL read');
      }
      const sqlConsent = /COALESCE\s*\(\s*uc\.political_opinions_consent\s*,\s*u\.political_opinions_consent\s*,\s*false\s*\)\s+IS\s+TRUE/i;
      assert.match(sql, /JOIN users u ON u.id = r.user_id/);
      assert.match(sql, /LEFT JOIN user_consents uc ON uc.user_id = u.id/);
      assert.match(sql, sqlConsent);
      if (outage) throw Error('SYNTHETIC_DB_OUTAGE');
      const wanted = new Set((params?.[0]||[]).map(String));
      const allowed = id => {
        if (Object.hasOwn(overrideByUser,id)) return overrideByUser[id] === true;
        if (Object.hasOwn(consentByUser,id)) return consentByUser[id] === true;
        return true; // Existing ranking fixtures explicitly represent consented users.
      };
      return {rows:rows.filter(row=>wanted.has(String(row.user_id)) && allowed(String(row.user_id)))};
    }
  };
}

test('buildPoliticalMatches applica ranking DEMOS e carica le risposte in batch', async () => {
  const pool = createPool({
    opinionIds: ['o1', 'o2', 'o3', 'o4'],
    rows: [
      { user_id: 'user', o1: 'f', o2: 'c', o3: 'i', o4: 'f' },
      // 3 + 3 + 1 - 1 = 6
      { user_id: 'a', o1: 'f', o2: 'c', o3: 'i', o4: 'c' },
      // 3 + 0 + 0 + 3 = 6, ma copertura completa: parità risolta alfabeticamente
      { user_id: 'b', o1: 'f', o2: 'i', o3: 'f', o4: 'f' },
      // 3 + 0 + 0 + 0 = 3, una posizione mancante
      { user_id: 'c', o1: 'f', o2: 'i', o3: 'f', o4: null }
    ]
  });

  const result = await buildPoliticalMatches({
    pool,
    userId: 'user',
    grade: 'N',
    subjects: [
      { id: 'c', nome: 'Carlo', cognome: 'Verdi' },
      { id: 'b', nome: 'Bruno', cognome: 'Bianchi' },
      { id: 'a', nome: 'Anna', cognome: 'Alberti' }
    ]
  });

  assert.equal(result.isComplete, true);
  assert.deepEqual(result.matches.map((m) => m.id), ['a', 'b', 'c']);
  assert.equal(result.matches[0].matching_score, 6);
  assert.equal(result.matches[0].compatibilita_percentuale, 50);
  assert.equal(result.matches[0].copertura_posizioni, 4);
  assert.equal(result.matches[0].copertura_totale, 4);
  assert.equal(result.matches[2].copertura_posizioni, 3);

  const questionQueries = pool.calls.filter((call) => call.sql.includes('FROM opinioni_domande'));
  const answerQueries = pool.calls.filter((call) => call.sql.includes('FROM opinioni_risposte'));
  assert.equal(questionQueries.length, 0, 'opinion catalog is static code and costs no SQL');
  assert.equal(answerQueries.length, 1);
});

test('utente incompleto non riceve alcun suggerimento', async () => {
  const pool = createPool({
    opinionIds: ['o1', 'o2', 'o3'],
    rows: [
      { user_id: 'user', o1: 'f', o2: null, o3: 'i' },
      { user_id: 'a', o1: 'f', o2: 'c', o3: 'i' }
    ]
  });

  const result = await buildPoliticalMatches({
    pool,
    userId: 'user',
    grade: 'R',
    subjects: [{ id: 'a', nome: 'Anna', cognome: 'Alberti' }]
  });

  assert.equal(result.isComplete, false);
  assert.equal(result.missingOpinions, 1);
  assert.deepEqual(result.missingOpinionIds, ['o2']);
  assert.deepEqual(result.matches, []);
});

test('getUserOpinionCompletion considera Non lo so una risposta valida', async () => {
  const pool = createPool({
    opinionIds: ['o1', 'o2'],
    rows: [{ user_id: 'user', o1: 'i', o2: 'c' }]
  });

  const result = await getUserOpinionCompletion(pool, 'user', 'E');
  assert.equal(result.isComplete, true);
  assert.equal(result.answeredOpinions, 2);
  assert.equal(result.completionPercentage, 100);
});

test('richiedente senza consenso: nessuna risposta residua viene usata per il matching',async()=>{
  const pool=createPool({
    rows:[{user_id:'user',o1:'f',o2:'f',o3:'f',o4:'f'},{user_id:'a',o1:'f',o2:'f',o3:'f',o4:'f'}],
    consentByUser:{user:true,a:true},overrideByUser:{user:false}
  });
  const result=await buildPoliticalMatches({pool,userId:'user',grade:'N',subjects:[{id:'a',nome:'Anna'}]});
  assert.equal(result.isComplete,false);
  assert.deepEqual(result.userAnswers,{});
  assert.deepEqual(result.matches,[]);
  assert.equal(pool.calls.length,1);
});

test('candidato con consenso revocato: risposte residue non influiscono sul punteggio',async()=>{
  const pool=createPool({
    rows:[{user_id:'user',o1:'f',o2:'c',o3:'i',o4:'f'},{user_id:'a',o1:'f',o2:'c',o3:'i',o4:'f'}],
    consentByUser:{user:true,a:true},overrideByUser:{a:false}
  });
  const result=await buildPoliticalMatches({pool,userId:'user',grade:'N',subjects:[{id:'a',nome:'Anna'}]});
  assert.equal(result.isComplete,true);
  assert.equal(result.matches.length,1);
  assert.equal(result.matches[0].copertura_posizioni,0);
  assert.equal(result.matches[0].matching_score,0);
  assert.equal(result.matches[0].posizioni_mancanti,4);
});

test('consenso esplicito corrente prevale sul legacy, assenza = fail closed',async()=>{
  const pool=createPool({
    rows:[{user_id:'user',o1:'i',o2:'c'},{user_id:'other',o1:'f',o2:'f'}],
    consentByUser:{user:false,other:null},overrideByUser:{user:true}
  });
  const ok=await getUserOpinionCompletion(pool,'user','E');
  const missing=await getUserOpinionCompletion(pool,'other','E');
  assert.equal(ok.isComplete,true);
  assert.deepEqual(missing.userAnswers,{});
  assert.equal(missing.isComplete,false);
});

test('SQL outage cannot fall back to processing unconsented residual answers',async()=>{
  const pool=createPool({rows:[],outage:true});
  await assert.rejects(
    getUserOpinionCompletion(pool,'user','N'),
    /SYNTHETIC_DB_OUTAGE/
  );
});
