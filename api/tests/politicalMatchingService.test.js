const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getUserOpinionCompletion,
  buildPoliticalMatches
} = require('../services/politicalMatchingService');

function createPool({ opinionIds, rows }) {
  const calls = [];

  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });

      if (sql.includes('FROM opinioni_domande')) {
        return { rows: opinionIds.map((id) => ({ id })) };
      }

      if (sql.includes('FROM opinioni_risposte')) {
        const requestedIds = new Set((params?.[0] || []).map(String));
        return {
          rows: rows.filter((row) => requestedIds.has(String(row.user_id)))
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
