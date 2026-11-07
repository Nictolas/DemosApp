'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessOfficialAnswer, runOfficialCaseQA, diagnoseSenateExplanation } = require('../staging/groq_official_case_qa');

test('Senate explanation diagnostics only classify source topic and risky finality phrase', () => {
  assert.deepEqual(diagnoseSenateExplanation('Continuità degli impianti strategici, voto non conclusivo.'), {
    topicFound: true, definitivePhraseFound: false
  });
  assert.deepEqual(diagnoseSenateExplanation('Il Senato ha approvato definitivamente.'), {
    topicFound: false, definitivePhraseFound: true
  });
  assert.deepEqual(diagnoseSenateExplanation('Testo generico senza oggetto.'), {
    topicFound: false, definitivePhraseFound: false
  });
});

const CORRECT = {
  atto: 'C.3131',
  data_voto: '20/10/2026',
  favorevoli: 125,
  contrari: 43,
  astenuti: 52,
  esito: 'approvato definitivamente',
  numero_legge: 196,
  data_pubblicazione: '26/10/2026',
  data_entrata_in_vigore: '27/10/2026',
  spiegazione: 'Conversione del decreto-legge n. 154 sulla continuità operativa di impianti strategici. La Camera ha approvato definitivamente il provvedimento.'
};
test('QA rejects incorrect vote counts and mistaken enactment dates', () => {
  assert.deepEqual(assessOfficialAnswer(CORRECT), { success: true, verifiedFields: 10, failedFields: [] });
  assert.deepEqual(assessOfficialAnswer({ ...CORRECT, favorevoli: 43 }), { success: false, verifiedFields: 9, failedFields: ['favorevoli'] });
  assert.deepEqual(assessOfficialAnswer({ ...CORRECT, data_pubblicazione: '20/10/2026' }), { success: false, verifiedFields: 9, failedFields: ['data_pubblicazione'] });
  assert.deepEqual(assessOfficialAnswer({ ...CORRECT, esito: 'approvato in prima lettura' }), { success: false, verifiedFields: 9, failedFields: ['esito'] });
  assert.deepEqual(assessOfficialAnswer({ ...CORRECT, esito: 'La Camera ha approvato il testo in via definitiva' }), { success: true, verifiedFields: 10, failedFields: [] });
  assert.deepEqual(assessOfficialAnswer({ ...CORRECT, esito: 'approvazione definitiva' }), { success: true, verifiedFields: 10, failedFields: [] });
});
test('T003 electoral-law official evidence rejects wrong vote totals and law effective date', () => {
  const t003 = {
    atto: 'C.2822-B', data_voto: '08/10/2026',
    favorevoli: 227, contrari: 164, astenuti: 0,
    esito: 'APPROVATO DEFINITIVAMENTE',
    numero_legge: 180, data_pubblicazione: '09/10/2026',
    data_entrata_in_vigore: '24/10/2026',
    spiegazione: 'La Camera approva definitivamente le disposizioni in materia di elezioni dei due rami.'
  };
  assert.deepEqual(assessOfficialAnswer(t003, 'T003'),
    { success: true, verifiedFields: 10, failedFields: [] });
  assert.deepEqual(assessOfficialAnswer({ ...t003, favorevoli: 164 }, 'T003'),
    { success: false, verifiedFields: 9, failedFields: ['favorevoli'] });
  assert.deepEqual(assessOfficialAnswer({ ...t003, data_entrata_in_vigore: '09/10/2026' }, 'T003'),
    { success: false, verifiedFields: 9, failedFields: ['data_entrata_in_vigore'] });
  assert.deepEqual(assessOfficialAnswer({ ...t003, esito: 'APPROVATO NON DEFINITIVAMENTE' }, 'T003'),
    { success: false, verifiedFields: 9, failedFields: ['esito'] });
});

test('T009 rejected electoral amendment is distinct from approval of the parent bill', () => {
  const t009 = {
    atto: 'Em. 9.0.3', data_voto: '14/09/2026',
    favorevoli: 47, contrari: 89, astenuti: 2,
    esito: 'RESPINTO', numero_legge: null,
    data_pubblicazione: null, data_entrata_in_vigore: null,
    spiegazione: 'L’emendamento proponeva 18 mesi di rinvio dell’entrata in vigore della legge elettorale, ma il Senato lo ha respinto.'
  };
  assert.deepEqual(assessOfficialAnswer(t009, 'T009'),
    { success: true, verifiedFields: 10, failedFields: [] });
  assert.deepEqual(assessOfficialAnswer({ ...t009, esito: 'APPROVATO DEFINITIVAMENTE' }, 'T009'),
    { success: false, verifiedFields: 9, failedFields: ['esito'] });
  assert.deepEqual(assessOfficialAnswer({ ...t009, numero_legge: 180 }, 'T009'),
    { success: false, verifiedFields: 9, failedFields: ['numero_legge'] });
  assert.deepEqual(assessOfficialAnswer({ ...t009, spiegazione: 'Il Senato ha respinto un emendamento sulla legge elettorale.' }, 'T009'),
    { success: false, verifiedFields: 9, failedFields: ['spiegazione'] });
});

test('real case QA is one bounded provider request with no user data or paid model', async () => {
  let calls = 0;
  const r = await runOfficialCaseQA({
    env: { GROQ_API_KEY: 'mock-key', GROQ_MODEL: 'openai/gpt-oss-120b' },
    now: () => 1730000000000,
    clientFactory: apiKey => {
      assert.equal(apiKey, 'mock-key');
      return { chat: { completions: {} } };
    },
    request: async (_client, params) => {
      calls++;
      assert.equal(params.model, 'openai/gpt-oss-120b');
      assert.equal(params.max_completion_tokens, 1100);
      assert.equal(params.response_format.type, 'json_object');
      assert.match(params.messages[1].content, /20\/10\/2026/);
      assert.match(params.messages[1].content, /125 favorevoli/);
      return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(CORRECT) } }] };
    }
  });
  assert.equal(calls, 1);
  assert.deepEqual(r, {
    caseId: 'T008', status: 'OK', success: true,
    verifiedFields: 10, failedFields: [], latencyMs: 0
  });
  assert.doesNotMatch(JSON.stringify(r), /mock-key|spiegazione|1234/);
});
test('empty and partial generations are not accepted as real analysis', async () => {
  for (const [finish_reason,content] of [
    ['length', JSON.stringify(CORRECT)],
    ['stop',''],
    ['stop','garbage']
  ]) {
    const r = await runOfficialCaseQA({
      env: { GROQ_API_KEY: 'mock-key' },
      clientFactory: () => ({}),
      request: async () => ({ choices: [{ finish_reason, message: { content } }] })
    });
    assert.equal(r.success, false);
    assert.notEqual(r.status, 'OK');
  }
});
test('QA never invokes provider without configured Free key or allowed model', async () => {
  let calls=0;
  const request = async () => {calls++;return {};};
  const a = await runOfficialCaseQA({env: {},request});
  const b = await runOfficialCaseQA({env: { GROQ_API_KEY: 'mock-key', GROQ_MODEL: 'paid/model' },request});
  assert.equal(a.status,'NOT_CONFIGURED');
  assert.equal(b.status,'MODEL_NOT_ALLOWED');
  assert.equal(calls,0);
});
