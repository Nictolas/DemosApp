const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..', '..');
const matcherPath = path.join(root, 'client', 'src', 'lib', 'privacy', 'clientMatching.js');
const matcherTypesPath = path.join(root, 'client', 'src', 'lib', 'privacy', 'clientMatching.d.ts');
const flagsPath = path.join(root, 'client', 'src', 'lib', 'privacy', 'privacyFeatures.ts');
const docPath = path.join(root, 'docs', 'privacy', 'client-side-matching-boundary.md');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

test('client matcher computes ranking in memory without identity input', async () => {
  const module = await import(pathToFileURL(matcherPath).href);
  const result = module.computeClientMatches({
    citizenOpinions: {
      energia: 'f',
      caccia: 'c',
      trasporti: 'i'
    },
    publicFigures: [
      { id: 'b', opinions: { energia: 'f', caccia: 'f', trasporti: 'i' } },
      { id: 'a', opinions: { energia: 'f', caccia: 'c', trasporti: 'i' } },
      { id: 'ignored', opinions: { energia: null, caccia: null, trasporti: null } }
    ]
  });

  assert.deepEqual(result, [
    {
      publicFigureId: 'a',
      commonOpinions: 3,
      comparedOpinions: 3,
      matchRatio: 1
    },
    {
      publicFigureId: 'b',
      commonOpinions: 2,
      comparedOpinions: 3,
      matchRatio: 2 / 3
    }
  ]);
});

test('client matcher source has no network, persistence, identity or logging dependency', () => {
  const source = read(matcherPath);
  const forbidden = [
    /\bfetch\s*\(/,
    /\bapiRequest\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\buserId\b/,
    /\bemail\b/,
    /console\./
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test('client matcher types expose a political vector without citizen identity fields', () => {
  const source = read(matcherTypesPath);
  assert.match(source, /CitizenOpinionVector/);
  assert.match(source, /citizenOpinions:/);
  assert.match(source, /publicFigures:/);
  assert.doesNotMatch(source, /userId|accountId|email/);
});

test('client matching feature flag is opt-in and defaults disabled', () => {
  const source = read(flagsPath);
  assert.match(source, /VITE_PRIVACY_CLIENT_MATCHING/);
  assert.match(source, /=== 'true'/);
  assert.doesNotMatch(source, /clientMatching:\s*true/);
});

test('architecture note keeps legacy backend matching active until privacy boundary is ready', () => {
  const source = read(docPath);
  assert.match(source, /NON è collegato al flusso di produzione/i);
  assert.match(source, /non deve ricevere il vettore politico/i);
  assert.match(source, /VITE_PRIVACY_CLIENT_MATCHING=false/);
});
