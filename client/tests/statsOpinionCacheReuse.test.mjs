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

test('base statistics route displays the selector, while deep links retain their opinion ID', () => {
  const source = readFileSync(new URL('../src/pages/StatisticheOpinione/hooks/useOpinionId.ts', import.meta.url), 'utf8');
  for (const [pathname, expected] of [
    ['/statistiche-opinione', ''],
    ['/statistiche-opinione/', ''],
    ['/statistiche-opinione/synthetic_opinion_01', 'synthetic_opinion_01'],
    ['/statistiche-opinione/synthetic_opinion_01/regione/toscana', 'synthetic_opinion_01'],
  ]) {
    const scope = {
      window: { location: { pathname } },
      console: { log() {} },
    };
    vm.runInNewContext(source.replace(/^export\s+/m, '') + '\nthis.readOpinionId = useOpinionId;', scope);
    assert.equal(scope.readOpinionId(), expected, pathname);
  }
});

test('disabled React Query cannot display cached political answers after consent loss', () => {
  const canRead = selector.indexOf('const canReadOpinions =');
  const renderGuard = selector.indexOf('if (!canReadOpinions) return null;');
  const display = selector.indexOf('const questions = questionsData.data;');
  assert.ok(canRead > 0 && renderGuard > canRead && display > renderGuard,
    'A revoked or unverified session must not render previously retained query data');
  assert.match(selector, /const canReadOpinions = !!user\?\.id && isSessionVerified &&\s*verifiedPoliticalConsent\?\.granted === true && !!verifiedPoliticalConsent\.timestamp/);
});

test('malformed grade labels cannot alias inherited object properties as cache grades', () => {
  assert.match(selector, /Object\.prototype\.hasOwnProperty\.call\(cacheGradeByLabel, grado\.trim\(\)\.toLowerCase\(\)\)/);
});
