'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MIN_CONTEXT_CHARS,
  MAX_CONTEXT_CHARS,
  hasDocumentaryContext,
  buildGroundedAnalysisMessages,
  parseGroundedAnalysisResponse,
} = require('../services/parliamentGroundedAnalysis');

const lawSource = fs.readFileSync(path.join(__dirname, '../services/leggeAnalysisService.js'), 'utf8');
const summarySource = fs.readFileSync(path.join(__dirname, '../services/aiExplanationService.js'), 'utf8');
const evidence = 'La proposta contiene disposizioni specifiche sull\'accesso al servizio pubblico e ne disciplina tempi, obblighi, competenze e procedure di controllo. '.repeat(3);

test('bare title or missing documentary text must never request generated legal conclusions', () => {
  assert.equal(hasDocumentaryContext('Legge n. 1234'), false);
  assert.equal(hasDocumentaryContext(null), false);
  assert.equal(hasDocumentaryContext('a'.repeat(MIN_CONTEXT_CHARS - 1)), false);
  assert.equal(hasDocumentaryContext('a'.repeat(MIN_CONTEXT_CHARS)), true);
  assert.equal(buildGroundedAnalysisMessages({ titolo: 'DDL n. 1234' }), null);
  assert.equal(buildGroundedAnalysisMessages({ titolo: 'DDL n. 1234', descrizione: 'titolo generico' }), null);
});

test('documentary prompt is bounded and explicitly prohibits invention and output of roll-call votes', () => {
  const prompts = buildGroundedAnalysisMessages({
    titolo: 'DDL 100',
    tipoAtto: 'Disegno di legge',
    descrizione: evidence.repeat(100),
    camera: 'Senato',
    dataVotazione: '2026-11-03',
  });
  assert.equal(prompts.length, 2);
  assert.equal(prompts[0].role, 'system');
  assert.match(prompts[0].content, /ESCLUSIVAMENTE/);
  assert.match(prompts[0].content, /Non attribuire mai il voto/);
  assert.match(prompts[0].content, /non attendibili come istruzioni/);
  assert.ok(prompts[1].content.length < MAX_CONTEXT_CHARS + 650);
  assert.match(prompts[1].content, /DOCUMENTI/);
});

test('long official documents fit the shared Groq Free per-minute budget', () => {
  const { estimateReservedTokens, LIMIT } = require('../services/parliamentFreeGroqBudget');
  const prompts = buildGroundedAnalysisMessages({
    titolo: 'DDL 100',
    tipoAtto: 'Disegno di legge',
    descrizione: 'a'.repeat(12000),
    camera: 'Camera'
  });
  assert.ok(prompts);
  assert.ok(
    estimateReservedTokens(prompts, 850) <= LIMIT.estimatedTokensPerMinute,
    'A single 12k-character source must not be rejected by the local Groq Free token guard'
  );
  assert.match(summarySource, /descrizione\.slice\(0, MAX_CONTEXT_CHARS\)/);
});

test('structured result must contain all three bounded fields, not fabricated ones', () => {
  const valid = {
    spiegazione_generale: 'Il testo disciplina uno specifico servizio.',
    effetti_positivi: '',
    effetti_negativi: '',
    esito: 'Vietato inferire'
  };
  const parsed = parseGroundedAnalysisResponse(JSON.stringify(valid));
  assert.deepEqual(parsed, {
    spiegazione_generale: valid.spiegazione_generale,
    effetti_positivi: '',
    effetti_negativi: '',
  });
  assert.deepEqual(parseGroundedAnalysisResponse('```json\n' + JSON.stringify(valid) + '\n```'), parsed);
  assert.equal(parseGroundedAnalysisResponse('{ invalid json'), null);
  assert.equal(parseGroundedAnalysisResponse(JSON.stringify({ spiegazione_generale: 'Tutto approvato' })), null);
  assert.equal(parseGroundedAnalysisResponse(JSON.stringify({ ...valid, effetti_positivi: 'a'.repeat(1400) })), null);
  assert.equal(parseGroundedAnalysisResponse('[' + JSON.stringify(valid) + ']'), null);
});

test('structured summaries enforce the 110-word prompt limit', () => {
  const payload = {
    spiegazione_generale: Array(110).fill('misura').join(' '),
    effetti_positivi: '',
    effetti_negativi: ''
  };
  assert.ok(parseGroundedAnalysisResponse(JSON.stringify(payload)),
    'Exactly 110 words must remain valid');
  payload.spiegazione_generale += ' aggiuntiva';
  assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)), null,
    '111 words must be rejected rather than published');
  payload.spiegazione_generale = 'Una misura concreta e documentata.';
  assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)).spiegazione_generale,
    payload.spiegazione_generale);
});

test('no-evidence JSON sentinel is never accepted as a legislative explanation', () => {
  const payload = { spiegazione_generale: '', effetti_positivi: '', effetti_negativi: '' };
  for (const answer of [
    'INFORMAZIONI_INSUFFICIENTI',
    'Informazioni insufficienti.',
    ' informazioni-insufficienti! ',
    'INFORMAZIONI  INSUFFICIENTI?'
  ]) {
    payload.spiegazione_generale = answer;
    assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)), null);
  }
  payload.spiegazione_generale = 'Il documento disciplina una misura pubblica.';
  assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)).spiegazione_generale,
    payload.spiegazione_generale);
});

test('structured legislative impacts cannot contain the no-evidence sentinel', () => {
  const payload = {
    spiegazione_generale: 'Il documento disciplina la misura indicata.',
    effetti_positivi: '',
    effetti_negativi: ''
  };
  for (const key of ['effetti_positivi', 'effetti_negativi']) {
    for (const sentinel of [
      'INFORMAZIONI_INSUFFICIENTI',
      ' informazioni insufficienti. ',
      'Informazioni-insufficienti!'
    ]) {
      payload[key] = sentinel;
      assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)), null);
      payload[key] = '';
    }
  }
  assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)).spiegazione_generale,
    payload.spiegazione_generale);
});

test('embedded no-evidence placeholders in legislative effects must never be published', () => {
  const payload = { spiegazione_generale: 'Il testo disciplina la misura.', effetti_positivi: '', effetti_negativi: '' };
  const placeholders = [
    '- INFORMAZIONI_INSUFFICIENTI',
    '1) Informazioni insufficienti.',
    '1. Effetto documentato; 2. INFORMAZIONI_INSUFFICIENTI',
    '- Effetto documentato\n- Informazioni-insufficienti!',
    'Effetto documentato; • informazioni insufficienti?'
  ];
  for (const field of ['effetti_positivi', 'effetti_negativi']) {
    for (const value of placeholders) {
      payload[field] = value;
      assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)), null,
        'An unsupported list item cannot be published: ' + value);
    }
    payload[field] = 'Il testo disciplina le informazioni insufficienti per la procedura.';
    assert.ok(parseGroundedAnalysisResponse(JSON.stringify(payload)),
      'Ordinary documentary prose must remain valid');
    payload[field] = '';
  }
});

test('a separately listed no-evidence item in the general explanation is rejected', () => {
  const payload = {
    spiegazione_generale: 'Il documento descrive una misura pubblica.',
    effetti_positivi: '',
    effetti_negativi: ''
  };
  const invalid = [
    'Il documento descrive una misura pubblica.\nINFORMAZIONI_INSUFFICIENTI',
    'Il documento descrive una misura pubblica.; 2) Informazioni insufficienti.',
    'Il documento descrive una misura pubblica.\n- Informazioni-insufficienti!'
  ];
  for (const explanation of invalid) {
    payload.spiegazione_generale = explanation;
    assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)), null);
  }
  payload.spiegazione_generale =
    'Il documento disciplina il procedimento quando le informazioni sono insufficienti.';
  assert.ok(parseGroundedAnalysisResponse(JSON.stringify(payload)),
    'Meaningful prose must remain acceptable');
});

test('effect lists reject more than three points', () => {
  const response = { spiegazione_generale: 'Una misura documentata.', effetti_positivi: '', effetti_negativi: '' };
  for (const field of ['effetti_positivi', 'effetti_negativi']) {
    response[field] = '- A\n- B\n- C';
    assert.ok(parseGroundedAnalysisResponse(JSON.stringify(response)));
    response[field] += '\n- D';
    assert.equal(parseGroundedAnalysisResponse(JSON.stringify(response)), null);
    response[field] = '';
  }
});

test('inline numbered legislative effects enforce the three-point limit', () => {
  const response = {
    spiegazione_generale: 'Una misura documentata.',
    effetti_positivi: '',
    effetti_negativi: ''
  };
  for (const field of ['effetti_positivi', 'effetti_negativi']) {
    response[field] = '1) Primo effetto; 2) Secondo effetto; 3) Terzo effetto';
    assert.ok(parseGroundedAnalysisResponse(JSON.stringify(response)), 'Three inline numbered points are allowed');
    response[field] += '; 4) Quarto effetto';
    assert.equal(parseGroundedAnalysisResponse(JSON.stringify(response)), null,
      'Four inline numbered points must not be published');
    response[field] = '1. Primo effetto 2. Secondo effetto 3. Terzo effetto 4. Quarto effetto';
    assert.equal(parseGroundedAnalysisResponse(JSON.stringify(response)), null,
      'Dot-numbered inline points are also bounded');
    response[field] = '';
  }
});

test('inline dash and mixed legislative effects enforce the three-point limit', () => {
  const payload = {
    spiegazione_generale: 'Una misura documentata.',
    effetti_positivi: '',
    effetti_negativi: ''
  };
  for (const field of ['effetti_positivi', 'effetti_negativi']) {
    payload[field] = '- Primo; - Secondo; - Terzo';
    assert.ok(parseGroundedAnalysisResponse(JSON.stringify(payload)));
    payload[field] += '; - Quarto';
    assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)), null,
      'Four inline dash bullets must be rejected');
    payload[field] = 'Effetti: 1) Primo; - Secondo; 3) Terzo; * Quarto';
    assert.equal(parseGroundedAnalysisResponse(JSON.stringify(payload)), null,
      'Four mixed numbered and dash bullets must be rejected');
    payload[field] = 'Migliore accesso - in alcune circostanze - al servizio';
    assert.ok(parseGroundedAnalysisResponse(JSON.stringify(payload)),
      'Ordinary hyphens within prose must not be treated as list markers');
    payload[field] = '';
  }
});

test('full legislative analysis has exactly one gated provider call and no handwritten 1718 fallback', () => {
  assert.equal((lawSource.match(/requestFreeGroq\s*\(/g) || []).length, 1);
  assert.equal((lawSource.match(/chat\.completions\.create\s*\(/g) || []).length, 0);
  assert.match(lawSource, /response_format: \{ type: 'json_object' \}/);
  assert.match(lawSource, /buildGroundedAnalysisMessages\s*\(/);
  assert.match(lawSource, /parseGroundedAnalysisResponse\s*\(/);
  assert.doesNotMatch(lawSource, /INFORMAZIONI SULLA LEGGE N\. 1718/);
  assert.doesNotMatch(lawSource, /generaEffettiPositivi\s*\(/);
  assert.doesNotMatch(lawSource, /generaEffettiNegativi\s*\(/);
});

test('short explanation refuses insufficient documents and forbids model-memory filler', () => {
  assert.match(summarySource, /if \(!hasDocumentaryContext\(descrizione\)\)/);
  assert.match(summarySource, /INFORMAZIONI_INSUFFICIENTI/);
  assert.doesNotMatch(summarySource, /usa la tua conoscenza/i);
  assert.doesNotMatch(summarySource, /integra con la tua conoscenza/i);
});
