const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getUserOpinionCompletion,
  buildPoliticalMatches
} = require('../services/politicalMatchingService');

function createPool({ opinionIds, rows, consentByUser = {}, overrideByUser = {} }) {
  const calls = [];

  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });

      if (sql.includes('FROM opinioni_domande')) {
        return { rows: opinionIds.map((id) => ({ id })) };
      }

      if (sql.includes('FROM opinioni_risposte')) {
        // The same SQL statement must enforce consent for every user in the batch.
        assert.match(sql, /JOIN\s+users\s+u\s+ON\s+u\.id\s*=\s*r\.user_id/);
        assert.match(sql, /LEFT\s+JOIN\s+user_consents\s+uc\s+ON\s+uc\.user_id\s*=\s*u\.id/);
        assert.match(sql, /COALESCE\s*\(\s*uc\.political_opinions_consent\s*,\s*u\.political_opinions_consent\s*,\s*false\s*\)\s+IS\s+TRUE/);
        const requestedIds = new Set((params?.[0] || []).map(String));
        return {
          rows: rows.filter((row) => {
            const id = String(row.user_id);
            const granted = Object.hasOwn(overrideByUser, id)
              ? overrideByUser[id] : (Object.hasOwn(consentByUser, id) ? consentByUser[id] : true);
            return requestedIds.has(id) && granted === true;
          })
        };
      }

      throw new Error(`Query non prevista nel fake pool: ${sql}`);
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
  assert.equal(questionQueries.length, 1);
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
    grade: 'N',
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

test('revoca del consenso del richiedente: risposte residue non producono suggerimenti', async () => {
  const pool = createPool({
    opinionIds: ['o1', 'o2'],
    rows: [{ user_id: 'user', o1: 'f', o2: 'c' }, { user_id: 'candidate', o1: 'f', o2: 'c' }],
    consentByUser: { user: true, candidate: true },
    overrideByUser: { user: false }
  });
  const result = await buildPoliticalMatches({
    pool, userId: 'user', grade: 'N',
    subjects: [{ id: 'candidate', nome: 'Synthetic', cognome: 'Candidate' }]
  });
  assert.equal(result.isComplete, false);
  assert.deepEqual(result.userAnswers, {});
  assert.deepEqual(result.matches, []);
});

test('revoca del consenso del candidato: matching non inferisce le posizioni residue', async () => {
  const pool = createPool({
    opinionIds: ['o1', 'o2'],
    rows: [{ user_id: 'user', o1: 'f', o2: 'c' }, { user_id: 'candidate', o1: 'f', o2: 'c' }],
    consentByUser: { user: true, candidate: true },
    overrideByUser: { candidate: false }
  });
  const result = await buildPoliticalMatches({
    pool, userId: 'user', grade: 'N',
    subjects: [{ id: 'candidate', nome: 'Synthetic', cognome: 'Candidate' }]
  });
  assert.equal(result.isComplete, true);
  assert.equal(result.matches[0].copertura_posizioni, 0);
  assert.equal(result.matches[0].matching_score, 0);
  assert.equal(result.matches[0].posizioni_mancanti, 2);
});

test('assenza di consenso e override esplicito prevalgono sui dati legacy', async () => {
  const pool = createPool({
    opinionIds: ['o1'],
    rows: [{ user_id: 'user', o1: 'f' }, { user_id: 'candidate', o1: 'c' }],
    consentByUser: { user: true, candidate: false },
    overrideByUser: { user: false, candidate: true }
  });
  const completion = await getUserOpinionCompletion(pool, 'user', 'N');
  assert.equal(completion.isComplete, false);
  const candidate = await getUserOpinionCompletion(pool, 'candidate', 'N');
  assert.equal(candidate.isComplete, true);
  assert.equal(candidate.userAnswers.o1, 'c');
  const missingPool = createPool({
    opinionIds: ['o1'], rows: [{ user_id: 'missing', o1: 'f' }],
    consentByUser: { missing: null }
  });
  assert.deepEqual((await getUserOpinionCompletion(missingPool, 'missing', 'N')).userAnswers, {});
});
