'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessOfficialAnswer, runOfficialCaseQA, diagnoseSenateExplanation, diagnoseAmendmentExplanation, diagnoseIlvaAmendmentExplanation } = require('../staging/groq_official_case_qa');

test('amendment explanation diagnosis requires both the proposed duration and its rejection', () => {
  assert.deepEqual(diagnoseAmendmentExplanation('L’emendamento di 18 mesi è stato respinto.'), { timingFound: true, rejectedFound: true });
  assert.deepEqual(diagnoseAmendmentExplanation('Si proponeva un rinvio di 18 mesi.'), { timingFound: true, rejectedFound: false });
  assert.deepEqual(diagnoseAmendmentExplanation('Il Senato ha respinto la proposta.'), { timingFound: false, rejectedFound: true });
});

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
    { success: true, verifiedFields: 10, failedFields: [], explanationDiagnostics: { timingFound: true, rejectedFound: true } });
  assert.deepEqual(assessOfficialAnswer({ ...t009, esito: 'APPROVATO DEFINITIVAMENTE' }, 'T009'),
    { success: false, verifiedFields: 9, failedFields: ['esito'], explanationDiagnostics: { timingFound: true, rejectedFound: true } });
  assert.deepEqual(assessOfficialAnswer({ ...t009, numero_legge: 180 }, 'T009'),
    { success: false, verifiedFields: 9, failedFields: ['numero_legge'], explanationDiagnostics: { timingFound: true, rejectedFound: true } });
  assert.deepEqual(assessOfficialAnswer({ ...t009, spiegazione: 'Il Senato ha respinto un emendamento sulla legge elettorale.' }, 'T009'),
    { success: false, verifiedFields: 9, failedFields: ['spiegazione'], explanationDiagnostics: { timingFound: false, rejectedFound: true } });
});

test('T010 Pirondini rejected amendment is second legislature, not T009 18 months', () => {
  const correct = {
    atto: 'Em. 9.0.2', data_voto: '14/09/2026',
    favorevoli: 48, contrari: 91, astenuti: 2,
    esito: 'RESPINTO', numero_legge: null,
    data_pubblicazione: null, data_entrata_in_vigore: null,
    spiegazione: 'La proposta di applicare la legge dalla seconda legislatura successiva è stata respinta dal Senato.'
  };
  const expected = { secondLegislatureFound: true, rejectedFound: true, wrong18MonthFound: false };
  assert.deepEqual(assessOfficialAnswer(correct, 'T010'),
    { success: true, verifiedFields: 10, failedFields: [], explanationDiagnostics: expected });
  assert.deepEqual(assessOfficialAnswer({ ...correct, contrari: 89 }, 'T010'),
    { success: false, verifiedFields: 9, failedFields: ['contrari'], explanationDiagnostics: expected });
  const confused = assessOfficialAnswer({ ...correct, spiegazione: 'La proposta di un rinvio di 18 mesi è stata respinta.' }, 'T010');
  assert.equal(confused.success, false);
  assert.deepEqual(confused.failedFields, ['spiegazione']);
  assert.deepEqual(confused.explanationDiagnostics,
    { secondLegislatureFound: false, rejectedFound: true, wrong18MonthFound: true });
  assert.equal(assessOfficialAnswer({ ...correct, esito: 'APPROVATO DEFINITIVAMENTE' }, 'T010').success, false);
});

test('T006 definitive Senate archive bill is not yet a published law', () => {
  const correct = {
    atto: 'S.1804', data_voto: '28/10/2026', favorevoli: 75, contrari: 52,
    astenuti: 0, esito: 'APPROVATO DEFINITIVAMENTE',
    numero_legge: null, data_pubblicazione: null, data_entrata_in_vigore: null,
    spiegazione: 'Il Senato ha definitivamente approvato la proposta di ridenominazione dell’Archivio centrale dello Stato in Archivio nazionale, non ancora pubblicata.'
  };
  assert.deepEqual(assessOfficialAnswer(correct, 'T006'),
    { success: true, verifiedFields: 10, failedFields: [] });
  assert.deepEqual(assessOfficialAnswer({ ...correct, numero_legge: 2026 }, 'T006'),
    { success: false, verifiedFields: 9, failedFields: ['numero_legge'] });
  assert.deepEqual(assessOfficialAnswer({ ...correct, esito: 'APPROVATO NON DEFINITIVAMENTE' }, 'T006'),
    { success: false, verifiedFields: 9, failedFields: ['esito'] });
  assert.deepEqual(assessOfficialAnswer({ ...correct, spiegazione: 'Approvato un provvedimento.' }, 'T006'),
    { success: false, verifiedFields: 9, failedFields: ['spiegazione'] });
});

test('T012 rejected S.2023 ex-ILVA amendment requires accurate subject and vote outcome', () => {
  const correct = {
    atto: 'Em. 1.13', data_voto: '07/10/2026',
    favorevoli: 45, contrari: 75, astenuti: 1, esito: 'RESPINTO',
    numero_legge: null, data_pubblicazione: null, data_entrata_in_vigore: null,
    spiegazione: 'Il Senato ha respinto l’emendamento ex ILVA: proponeva un accordo per la chiusura dell’area a caldo.'
  };
  const flags = { hotAreaFound: true, ilvaOrProgrammeFound: true, rejectedFound: true };
  assert.deepEqual(assessOfficialAnswer(correct, 'T012'),
    { success: true, verifiedFields: 10, failedFields: [], explanationDiagnostics: flags });
  assert.deepEqual(assessOfficialAnswer({ ...correct, favorevoli: 47 }, 'T012').failedFields, ['favorevoli']);
  assert.deepEqual(assessOfficialAnswer({ ...correct, esito: 'APPROVATO DEFINITIVAMENTE' }, 'T012').failedFields, ['esito']);
  assert.deepEqual(assessOfficialAnswer({ ...correct, numero_legge: 196 }, 'T012').failedFields, ['numero_legge']);
  const missing = assessOfficialAnswer({ ...correct, spiegazione: 'Il Senato ha respinto una proposta ex ILVA.' }, 'T012');
  assert.deepEqual(missing.failedFields, ['spiegazione']);
  assert.deepEqual(diagnoseIlvaAmendmentExplanation(correct.spiegazione), flags);
  assert.deepEqual(diagnoseIlvaAmendmentExplanation('Il Senato ha approvato l’emendamento per l’area a caldo.'),
    { hotAreaFound: true, ilvaOrProgrammeFound: false, rejectedFound: false });
});

test('T011 amendment to S.2023 cannot be confused with identically numbered fuel-bonus amendment to S.2029', () => {
  const t011 = {
    atto: 'Em. 1.0.6', data_voto: '07/10/2026', favorevoli: 47, contrari: 74,
    astenuti: 1, esito: 'RESPINTO', numero_legge: null,
    data_pubblicazione: null, data_entrata_in_vigore: null,
    spiegazione: 'Il Senato ha respinto l’emendamento che abrogava norme sulla responsabilità nella gestione di stabilimenti industriali strategici.'
  };
  assert.deepEqual(assessOfficialAnswer(t011, 'T011'), {
    success: true, verifiedFields: 10, failedFields: [],
    explanationDiagnostics: { liabilitySubjectFound: true, rejectedFound: true, wrongFuelSubjectFound: false }
  });
  const wrongSource = assessOfficialAnswer({ ...t011,
    spiegazione: 'Il Senato ha respinto il bonus carburante da 200 euro per i lavoratori.' }, 'T011');
  assert.deepEqual(wrongSource.failedFields, ['spiegazione']);
  assert.equal(wrongSource.explanationDiagnostics.wrongFuelSubjectFound, true);
  assert.deepEqual(assessOfficialAnswer({ ...t011, contrari: 75 }, 'T011').failedFields, ['contrari']);
  assert.deepEqual(assessOfficialAnswer({ ...t011, esito: 'APPROVATO DEFINITIVAMENTE' }, 'T011').failedFields, ['esito']);
});

test('T018 Senate confidence vote and conversion law preserve distinct voting, publication and effective dates', () => {
  const correct = {
    atto: 'S.2047', data_voto: '30/09/2026',
    favorevoli: 95, contrari: 53, astenuti: 2,
    esito: 'APPROVATO DEFINITIVAMENTE',
    numero_legge: 174, data_pubblicazione: '06/10/2026',
    data_entrata_in_vigore: '07/10/2026',
    spiegazione: 'Il Senato ha approvato la fiducia sul decreto in materia di pubblica amministrazione e protezione civile, convertendolo definitivamente.'
  };
  assert.deepEqual(assessOfficialAnswer(correct, 'T018'),
    { success: true, verifiedFields: 10, failedFields: [] });
  assert.deepEqual(assessOfficialAnswer({ ...correct, favorevoli: 53 }, 'T018').failedFields, ['favorevoli']);
  assert.deepEqual(assessOfficialAnswer({ ...correct, data_voto: '05/10/2026' }, 'T018').failedFields, ['data_voto']);
  assert.deepEqual(assessOfficialAnswer({ ...correct, data_pubblicazione: '30/09/2026' }, 'T018').failedFields, ['data_pubblicazione']);
  assert.deepEqual(assessOfficialAnswer({ ...correct, data_entrata_in_vigore: '06/10/2026' }, 'T018').failedFields, ['data_entrata_in_vigore']);
  assert.deepEqual(assessOfficialAnswer({ ...correct, esito: 'APPROVATO NON DEFINITIVAMENTE' }, 'T018').failedFields, ['esito']);
  assert.deepEqual(assessOfficialAnswer({ ...correct, spiegazione: 'Il Senato ha respinto la fiducia sulla pubblica amministrazione.' }, 'T018').failedFields, ['spiegazione']);
  assert.deepEqual(assessOfficialAnswer({ ...correct, spiegazione: 'Il Senato ha approvato il testo.' }, 'T018').failedFields, ['spiegazione']);
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
test('local Free quota rejection is not classified as a truncated generation', async () => {
  const result = await runOfficialCaseQA({
    env: { GROQ_API_KEY: 'mock-key', GROQ_MODEL: 'openai/gpt-oss-120b' },
    clientFactory: () => ({}),
    request: async () => null
  });
  assert.equal(result.status, 'FREE_QUOTA_UNAVAILABLE');
  assert.equal(result.success, false);
  assert.equal(result.verifiedFields, 0);
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
