'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_FREE_GROQ_MODEL,
  FREE_GROQ_MODELS,
  RETIRED_GROQ_MODELS,
  resolveFreeGroqModel,
  isGroqConfigured,
} = require('../services/parliamentFreeAiPolicy');

test('parliamentary AI defaults to a documented Groq free-tier model', () => {
  assert.equal(DEFAULT_FREE_GROQ_MODEL, 'openai/gpt-oss-120b');
  assert.equal(resolveFreeGroqModel(), DEFAULT_FREE_GROQ_MODEL);
  assert.ok(FREE_GROQ_MODELS.includes(DEFAULT_FREE_GROQ_MODEL));
});

test('only explicitly reviewed Groq free-tier model IDs are selectable', () => {
  for (const id of FREE_GROQ_MODELS) {
    assert.equal(resolveFreeGroqModel(id), id);
    assert.equal(resolveFreeGroqModel('  ' + id + '  '), id);
  }
  for (const id of ['gpt-4o-mini', 'openai/gpt-5', 'not-a-real-model', 'groq/compound']) {
    assert.throws(() => resolveFreeGroqModel(id), /GROQ_MODEL_NOT_ALLOWLISTED_FREE_TIER/);
  }
});

test('retired model IDs fail closed instead of silently calling them', () => {
  for (const retired of RETIRED_GROQ_MODELS) {
    assert.throws(() => resolveFreeGroqModel(retired), /GROQ_MODEL_RETIRED_FOR_FREE_TIER/);
  }
});

test('only an existing non-empty Groq key enables provider selection', () => {
  assert.equal(isGroqConfigured({}), false);
  assert.equal(isGroqConfigured({ OPENAI_API_KEY: 'paid-key' }), false);
  assert.equal(isGroqConfigured({ GROQ_API_KEY: '  ' }), false);
  assert.equal(isGroqConfigured({ GROQ_API_KEY: 'private-groq-key' }), true);
});

for (const servicePath of ['aiExplanationService.js', 'leggeAnalysisService.js']) {
  test(servicePath + ' is guarded by the shared free-only policy', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', servicePath), 'utf8');
    assert.match(src, /resolveFreeGroqModel\(process\.env\.GROQ_MODEL\)/);
    assert.match(src, /isGroqConfigured\(\)/);
    assert.doesNotMatch(src, /new OpenAI\s*\(/);
    assert.doesNotMatch(src, /llama-3\.3-70b-versatile/);
    assert.doesNotMatch(src, /GROQ_API_KEY\.substring\s*\(/);
    assert.doesNotMatch(src, /process\.env\.OPENAI_API_KEY/);
  });
}
