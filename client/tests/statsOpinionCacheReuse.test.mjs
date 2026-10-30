import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const selector = readFileSync(new URL('../src/pages/StatisticheOpinione/components/OpinionSelector.tsx', import.meta.url), 'utf8');

// This is a source-contract test; the behavior of the actual encrypted cache
// and its HTTP/consent gates is exercised by encryptedOpinionCategory.behavior.test.mjs.
test('statistics selector keeps verified per-user, per-consent cache isolation', () => {
  assert.match(selector, /useAuth\(\)/);
  assert.match(selector, /queryKey:\s*\['statsOpinionQuestions', user\?\.id, verifiedPoliticalConsent\?\.timestamp, grado\]/);
  assert.match(selector, /enabled:\s*!!user\?\.id && isSessionVerified && verifiedPoliticalConsent\?\.granted === true/);
  assert.match(selector, /!!verifiedPoliticalConsent\.timestamp/);
  assert.match(selector, /queryFn: async \(\{ signal \}\) => \{/);
  assert.doesNotMatch(selector, /queryKey:\s*\['opinioniQuestions', grado\]/);
});

test('all four canonical labels and grade codes share editor encrypted snapshots', () => {
  const match = selector.match(/const cacheGradeByLabel:[^=]*= (\{[\s\S]*?\});/);
  assert.ok(match, 'The grade mapping must be explicit and reviewable');
  const aliases = vm.runInNewContext('(' + match[1] + ')');
  for (const [grade, labels] of Object.entries({
    N: ['n', 'nazionale', 'nazionali'],
    E: ['e', 'europea', 'europee'],
    R: ['r', 'regionale', 'regionali'],
    CO: ['co', 'comunale', 'comunali'],
  })) for (const label of labels) assert.equal(aliases[label], grade, label);
  assert.equal(aliases.other, undefined, 'Unrecognized labels cannot impersonate a known grade');
});

test('known grades reuse the encrypted cache before any personal-answer network GET', () => {
  const query = selector.slice(selector.indexOf('queryFn: async'));
  const warm = query.indexOf('if (cacheGrade)');
  const cache = query.indexOf('return loadOpinionCategory(');
  const fallback = query.indexOf('const response = await apiRequest("GET",');
  assert.ok(warm >= 0 && cache > warm && fallback > cache,
    'Personal-answer GET must be a legacy-only fallback after a cache-eligible branch');
  assert.match(query, /loadOpinionCategory\(user!\.id, verifiedPoliticalConsent!\.timestamp,\s*cacheGrade, signal\)/);
  assert.match(query, /undefined, undefined, signal/);
  assert.match(query, /return response\.data/);
});

test('statistics selector never logs political payloads to the console', () => {
  assert.doesNotMatch(selector, /console\.(?:log|error)\s*\(/);
});
