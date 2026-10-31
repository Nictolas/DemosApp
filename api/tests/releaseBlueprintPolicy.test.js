'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');
const yaml = fs.readFileSync(path.join(repositoryRoot, 'render.yaml'), 'utf8');
const workflow = fs.readFileSync(
  path.join(repositoryRoot, '.github/workflows/release-blueprint-policy.yml'),
  'utf8'
);

function serviceBlocks(source) {
  return source.split(/^  - type: /m).slice(1).map(block => {
    const name = block.match(/^\s+name:\s+([^\s#]+)/m)?.[1];
    const trigger = block.match(/^\s+autoDeployTrigger:\s+([^\s#]+)/m)?.[1];
    return { name, trigger, block };
  });
}

test('Render Blueprint proposes manual deployment for both DEMOS production services', () => {
  const blocks = serviceBlocks(yaml);
  assert.equal(blocks.length, 2, 'unexpected number of production services in render.yaml');
  assert.deepEqual(
    blocks.map(({ name }) => name).sort(),
    ['demos-backend', 'demos-frontend']
  );
  for (const block of blocks) {
    assert.equal(block.trigger, 'off', block.name + ': autoDeployTrigger must be off');
    assert.doesNotMatch(block.block, /^\s*autoDeploy:\s*(true|yes)\s*$/m);
    assert.doesNotMatch(block.block, /^\s*autoDeployTrigger:\s*(commit|checksPass)\s*$/m);
  }
});

test('Blueprint preserves observed live Render build and publish paths', () => {
  const services = serviceBlocks(yaml);
  const backend = services.find(service => service.name === 'demos-backend');
  const frontend = services.find(service => service.name === 'demos-frontend');
  assert.ok(backend && frontend);

  // Snapshot from Render service metadata, 31 October 2026.
  // Refresh these expectations only after reviewing LIVE provider configuration.
  assert.match(backend.block, /^\s+rootDir:\s+api\s*$/m);
  assert.match(backend.block, /^\s+buildCommand:\s+npm install\s*$/m);
  assert.match(backend.block, /^\s+startCommand:\s+node index\.js\s*$/m);
  assert.match(frontend.block, /^\s+rootDir:\s+client\s*$/m);
  assert.match(frontend.block, /^\s+buildCommand:\s+npm install; npm run build\s*$/m);
  assert.match(frontend.block, /^\s+staticPublishPath:\s+dist\s*$/m);
});

test('release Blueprint policy check runs on every PR to main (no paths filters)', () => {
  assert.match(workflow, /^on:\s*\n\s+pull_request:\s*\n\s+branches:\s*\n\s+- main\s*$/m);
  assert.doesNotMatch(workflow, /^\s+paths(?:-ignore)?:/m);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow, /push:\s*\n/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
});

test('Blueprint Auto Sync risk is explicit before any merge or sync', () => {
  const runbook = fs.readFileSync(
    path.join(repositoryRoot, 'docs/operations/PRODUCTION_RELEASE_CONTROL_2026-10-31.md'),
    'utf8'
  );
  assert.match(runbook, /Blueprint Auto Sync/);
  assert.match(runbook, /Auto Sync.*No/);
  assert.match(runbook, /npm install; npm run build/);
  assert.match(runbook, /`rootDir`/);
  assert.match(runbook, /Non sincronizzare il Blueprint/);
  assert.match(runbook, /nessuna sincronizzazione Blueprint/i);
});

// Strict, intentionally small parser for this Blueprint's envVars layout.
// Reject unexpected YAML indentation/fields rather than silently skipping them.
function blueprintEnvironmentVariables(block) {
  const parts = block.split(/^    envVars:\s*$/m);
  assert.equal(parts.length, 2, 'expected exactly one envVars section');
  const section = parts[1].split(/^    (?:customDomains|headers):\s*$/m)[0];
  const entries = [];
  let current;
  for (const line of section.split('\n')) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const key = line.match(/^      - key:\s+([A-Z][A-Z0-9_]*)\s*$/);
    if (key) {
      current = { key: key[1], settings: [] };
      entries.push(current);
      continue;
    }
    assert.ok(current && /^        (?:sync|value):/.test(line),
      'unrecognized envVars item or indentation');
    current.settings.push(line);
  }
  assert.ok(entries.length > 0, 'empty envVars section');
  return entries;
}

const permittedBlueprintEnv = {
  'demos-backend': {
    NODE_ENV: 'value: production',
    NPM_CONFIG_OMIT: 'value: dev',
    DATABASE_URL: 'sync: false',
    DB_HOST: 'sync: false',
    DB_USER: 'sync: false',
    DB_PASSWORD: 'sync: false',
    DB_DATABASE: 'sync: false',
    DB_PORT: 'value: "5432"',
    RESEND_API_KEY: 'sync: false',
    JWT_SECRET: 'sync: false',
    JWT_REFRESH_SECRET: 'sync: false',
    FRONTEND_URL: 'value: https://www.demos.community'
  },
  'demos-frontend': {
    NODE_ENV: 'value: production',
    VITE_API_URL: 'value: https://api.demos.community',
    VITE_FIREBASE_API_KEY: 'sync: false',
    VITE_FIREBASE_AUTH_DOMAIN: 'sync: false',
    VITE_FIREBASE_PROJECT_ID: 'sync: false',
    VITE_FIREBASE_STORAGE_BUCKET: 'sync: false',
    VITE_FIREBASE_MESSAGING_SENDER_ID: 'sync: false',
    VITE_FIREBASE_APP_ID: 'sync: false',
    VITE_FIREBASE_MEASUREMENT_ID: 'sync: false',
    VITE_FIREBASE_VAPID_KEY: 'sync: false'
  }
};

function checkBlueprintEnv(block, serviceName) {
  const expected = permittedBlueprintEnv[serviceName];
  assert.ok(expected, 'unknown production service');
  const entries = blueprintEnvironmentVariables(block);
  const names = entries.map(e => e.key);
  assert.equal(new Set(names).size, names.length, 'duplicate env key');
  assert.deepEqual(names.slice().sort(), Object.keys(expected).sort(),
    'unreviewed env key, removed env key, or extra env configuration');
  for (const { key, settings } of entries) {
    assert.equal(settings.length, 1, serviceName + '/' + key + ': one setting required');
    const actual = settings[0].trim().replace(/\s+#.*$/, '');
    assert.equal(actual, expected[key],
      serviceName + '/' + key + ': unexpected literal or secret source');
  }
}

test('Blueprint retains scoped domains and security headers', () => {
  const blocks = serviceBlocks(yaml);
  const backend = blocks.find(s => s.name === 'demos-backend');
  const frontend = blocks.find(s => s.name === 'demos-frontend');
  assert.ok(backend && frontend);
  assert.match(backend.block, /^    customDomains:\s*$/m);
  assert.match(backend.block, /^      - name: api\.demos\.community\s*$/m);
  assert.match(frontend.block, /^    customDomains:\s*$/m);
  assert.match(frontend.block, /^      - name: www\.demos\.community\s*$/m);
  assert.match(frontend.block, /^    headers:\s*$/m);

  for (const header of [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'X-Frame-Options'
  ]) {
    assert.match(frontend.block, new RegExp('^        name: ' + header + '\\s*$', 'm'),
      'missing security header ' + header);
  }
  assert.match(frontend.block, /frame-ancestors 'none'/);
  assert.match(frontend.block, /object-src 'none'/);
  assert.match(frontend.block, /max-age=31536000; includeSubDomains/);
  for (const route of ['/assets/*', '/index.html', '/firebase-messaging-sw.js', '/manifest.json']) {
    assert.ok(frontend.block.includes('      - path: ' + route + '\n'),
      'missing cache-control scope ' + route);
  }
});

test('Blueprint uses exactly reviewed env keys with private values externalized', () => {
  for (const service of serviceBlocks(yaml)) {
    checkBlueprintEnv(service.block, service.name);
  }
});

test('Blueprint env gate rejects fake secret literals, duplicate keys and unreviewed fields', () => {
  const backend = serviceBlocks(yaml).find(s => s.name === 'demos-backend').block;
  const fakeSecret = backend.replace(
    '      - key: JWT_SECRET\n        sync: false',
    '      - key: JWT_SECRET\n        value: fake-test-only'
  );
  assert.notEqual(fakeSecret, backend, 'fixture must mutate');
  assert.throws(() => checkBlueprintEnv(fakeSecret, 'demos-backend'));

  const duplicate = backend.replace(
    '      - key: JWT_SECRET\n        sync: false',
    '      - key: JWT_SECRET\n        sync: false\n      - key: JWT_SECRET\n        sync: false'
  );
  assert.throws(() => checkBlueprintEnv(duplicate, 'demos-backend'));

  const unreviewedField = backend.replace(
    '      - key: JWT_SECRET\n        sync: false',
    '      - key: JWT_SECRET\n        sync: false\n        generateValue: true'
  );
  assert.throws(() => checkBlueprintEnv(unreviewedField, 'demos-backend'));

  const unexpectedVariable = backend.replace(
    '      - key: JWT_SECRET\n        sync: false',
    '      - key: JWT_SECRET\n        sync: false\n      - key: TEST_NEW_PRIVATE_KEY\n        value: fake-test-only'
  );
  assert.throws(() => checkBlueprintEnv(unexpectedVariable, 'demos-backend'));
});

function blueprintHeaderEntries(frontendBlock) {
  const parts = frontendBlock.split(/^    headers:\s*$/m);
  assert.equal(parts.length, 2, 'expected exactly one frontend headers section');
  const entries = [];
  let current;
  for (const line of parts[1].split('\n')) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const pathMatch = line.match(/^      - path:\s+(.+?)\s*$/);
    if (pathMatch) {
      current = { path: pathMatch[1] };
      entries.push(current);
      continue;
    }
    const fieldMatch = line.match(/^        (name|value):\s+(.+?)\s*$/);
    assert.ok(current && fieldMatch, 'unrecognized header field or indentation');
    assert.equal(Object.hasOwn(current, fieldMatch[1]), false,
      'duplicate header name or value field');
    current[fieldMatch[1]] = fieldMatch[2];
  }
  for (const entry of entries) {
    assert.equal(typeof entry.name, 'string');
    assert.equal(typeof entry.value, 'string');
  }
  return entries;
}

function checkBlueprintHeaders(frontendBlock) {
  const expected = [
    ['/assets/*', 'Cache-Control', 'public, max-age=31536000, immutable'],
    ['/index.html', 'Cache-Control', 'no-cache'],
    ['/firebase-messaging-sw.js', 'Cache-Control', 'no-cache, no-store, must-revalidate'],
    ['/manifest.json', 'Cache-Control', 'no-cache'],
    ['/*', 'Content-Security-Policy', "default-src 'self'; script-src 'self' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"],
    ['/*', 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
    ['/*', 'X-Content-Type-Options', 'nosniff'],
    ['/*', 'Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['/*', 'Permissions-Policy', 'geolocation=(), microphone=(), camera=()'],
    ['/*', 'X-Frame-Options', 'DENY']
  ];
  const actual = blueprintHeaderEntries(frontendBlock).map(e => [e.path, e.name, e.value]);
  assert.deepEqual(actual.slice().sort((a,b)=>a.join('|').localeCompare(b.join('|'))),
    expected.slice().sort((a,b)=>a.join('|').localeCompare(b.join('|'))),
    'header names, values and scoped paths must retain reviewed Blueprint baseline');
}

test('Blueprint security and cache header values stay scoped to the expected paths', () => {
  const frontend = serviceBlocks(yaml).find(s => s.name === 'demos-frontend').block;
  checkBlueprintHeaders(frontend);

  const weakerFramePolicy = frontend.replace('        value: DENY', '        value: SAMEORIGIN');
  assert.notEqual(weakerFramePolicy, frontend, 'fixture must mutate');
  assert.throws(() => checkBlueprintHeaders(weakerFramePolicy));

  const wrongCacheScope = frontend.replace('      - path: /manifest.json', '      - path: /assets/*');
  assert.notEqual(wrongCacheScope, frontend, 'fixture must mutate');
  assert.throws(() => checkBlueprintHeaders(wrongCacheScope));

  const missingCsp = frontend.replace(
    "        value: default-src 'self'; script-src",
    "        value: default-src *; script-src"
  );
  assert.notEqual(missingCsp, frontend, 'fixture must mutate');
  assert.throws(() => checkBlueprintHeaders(missingCsp));
});
