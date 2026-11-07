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
