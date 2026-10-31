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

function blueprintEnvironmentVariables(block) {
  const section = block.split(/^    envVars:\s*$/m)[1]?.split(/^    (?:customDomains|headers):\s*$/m)[0];
  assert.ok(section, 'Blueprint environment variable section missing');
  const entries = [...section.matchAll(/^      - key:\s+([A-Z][A-Z0-9_]*)\s*\n((?:^        [^\n]*(?:\n|$))*)/gm)];
  assert.ok(entries.length > 0, 'no Blueprint environment variables');
  return entries.map(entry => ({ key: entry[1], settings: entry[2] }));
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

test('Blueprint preserves required env names and does not inline private credentials', () => {
  const expected = {
    'demos-backend': [
      'NODE_ENV', 'NPM_CONFIG_OMIT', 'DATABASE_URL', 'DB_HOST', 'DB_USER',
      'DB_PASSWORD', 'DB_DATABASE', 'DB_PORT', 'RESEND_API_KEY', 'JWT_SECRET',
      'JWT_REFRESH_SECRET', 'FRONTEND_URL'
    ],
    'demos-frontend': [
      'NODE_ENV', 'VITE_API_URL', 'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_MEASUREMENT_ID',
      'VITE_FIREBASE_VAPID_KEY'
    ]
  };
  for (const service of serviceBlocks(yaml)) {
    const entries = blueprintEnvironmentVariables(service.block);
    const names = entries.map(x => x.key);
    assert.equal(new Set(names).size, names.length, service.name + ': duplicated env key');
    for (const required of expected[service.name]) {
      assert.ok(names.includes(required), service.name + ': missing env key ' + required);
    }
    for (const { key, settings } of entries) {
      if (
        expected[service.name].includes(key) &&
        !['NODE_ENV', 'NPM_CONFIG_OMIT', 'DB_PORT', 'FRONTEND_URL', 'VITE_API_URL'].includes(key)
        || /(?:PASSWORD|TOKEN|SECRET|API_KEY|DATABASE_URL)$/.test(key)
      ) {
        assert.match(settings, /^\s+sync: false(?:\s+#.*)?$/m,
          service.name + '/' + key + ': private value must be supplied by Render');
        assert.doesNotMatch(settings, /^\s+value:/m,
          service.name + '/' + key + ': never commit private credential values');
      }
    }
  }
});
