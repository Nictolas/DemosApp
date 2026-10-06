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
      { matchHandle: 'mh1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', opinions: { energia: 'f', caccia: 'f', trasporti: 'i' } },
      { matchHandle: 'mh1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', opinions: { energia: 'f', caccia: 'c', trasporti: 'i' } },
      { matchHandle: 'mh1_iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii', opinions: { energia: null, caccia: null, trasporti: null } }
    ]
  });

  assert.deepEqual(result, [
    {
      matchHandle: 'mh1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      commonOpinions: 3,
      comparedOpinions: 3,
      matchRatio: 1
    },
    {
      matchHandle: 'mh1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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
  assert.match(source, /matchHandle:/);
  assert.doesNotMatch(source, /publicFigureId|userId|accountId|email/);
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


test('public-figure match bundle exposes only opaque handles and political vectors', () => {
  const {
    buildPublicFigureMatchBundle
  } = require('../services/publicFigureMatchBundlePolicy');

  const bundle = buildPublicFigureMatchBundle({
    contextId: 'ctx_0123456789abcdef',
    secret: Buffer.alloc(32, 7),
    figures: [
      {
        figureId: 'stable-figure-1',
        firstName: 'Nome',
        lastName: 'Cognome',
        publicSlug: 'nome-cognome',
        email: 'public@example.test',
        opinions: {
          energia: 'f',
          caccia: 'c',
          invalidAnswer: 'x'
        }
      }
    ]
  });

  assert.equal(bundle.candidates.length, 1);
  assert.deepEqual(bundle.candidates[0].opinions, {
    energia: 'f',
    caccia: 'c'
  });
  assert.match(bundle.candidates[0].matchHandle, /^mh1_[A-Za-z0-9_-]{32,64}$/);

  const serialized = JSON.stringify(bundle);
  for (const forbidden of [
    'stable-figure-1',
    'Nome',
    'Cognome',
    'nome-cognome',
    'public@example.test',
    'figureId',
    'publicSlug'
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('opaque match handles are context-scoped and deterministic only inside the same context', () => {
  const { deriveMatchHandle } = require('../services/publicFigureMatchBundlePolicy');
  const secret = Buffer.alloc(32, 9);

  const first = deriveMatchHandle({
    figureId: 'figure-123',
    contextId: 'ctx_0123456789abcdef',
    secret
  });
  const same = deriveMatchHandle({
    figureId: 'figure-123',
    contextId: 'ctx_0123456789abcdef',
    secret
  });
  const otherContext = deriveMatchHandle({
    figureId: 'figure-123',
    contextId: 'ctx_fedcba9876543210',
    secret
  });

  assert.equal(first, same);
  assert.notEqual(first, otherContext);
});

test('reveal boundary accepts at most four opaque handles and rejects citizen data', () => {
  const {
    deriveMatchHandle,
    validateMatchRevealRequest
  } = require('../services/publicFigureMatchBundlePolicy');

  const secret = Buffer.alloc(32, 5);
  const contextId = 'ctx_0123456789abcdef';
  const handles = ['a', 'b', 'c', 'd'].map((figureId) =>
    deriveMatchHandle({ figureId, contextId, secret })
  );

  assert.deepEqual(
    validateMatchRevealRequest({ contextId, matchHandles: handles }),
    { contextId, matchHandles: handles }
  );

  assert.throws(
    () => validateMatchRevealRequest({
      contextId,
      matchHandles: handles,
      citizenOpinions: { energia: 'f' }
    }),
    /forbidden fields/
  );

  assert.throws(
    () => validateMatchRevealRequest({
      contextId,
      matchHandles: [...handles, deriveMatchHandle({ figureId: 'e', contextId, secret })]
    }),
    /outside the allowed range/
  );
});
