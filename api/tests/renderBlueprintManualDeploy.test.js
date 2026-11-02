'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const blueprint = readFileSync(path.join(root, 'render.yaml'), 'utf8');

function readServices(source) {
  const chunks = source.split(/^  - type: web\s*$/m).slice(1);
  return chunks.map(chunk => ({
    name: chunk.match(/^    name:\s*(\S+)\s*$/m)?.[1],
    content: chunk
  }));
}

test('Blueprint disables automatic code deploys for both existing production services', () => {
  const services = readServices(blueprint);
  assert.deepEqual(services.map(s => s.name), ['demos-backend', 'demos-frontend']);
  assert.equal((blueprint.match(/^    autoDeployTrigger: off\s*$/gm) || []).length, 2);
  assert.doesNotMatch(blueprint, /^\s*autoDeploy:/m, 'deprecated field can shadow runtime expectations');
  assert.doesNotMatch(blueprint, /^\s*autoDeployTrigger:\s*(?:commit|checksPass)/m);
  assert.doesNotMatch(blueprint, /^\s*(?:preDeployCommand|initialDeployHook):/m);
});

test('Blueprint build and publish fields match verified Render service metadata', () => {
  const [api, web] = readServices(blueprint).map(x => x.content);
  for (const field of ['rootDir: api', 'buildCommand: npm install', 'startCommand: node index.js']) {
    assert.ok(api.includes('    ' + field), 'backend drift: ' + field);
  }
  for (const field of ['rootDir: client', 'buildCommand: npm install; npm run build', 'staticPublishPath: dist']) {
    assert.ok(web.includes('    ' + field), 'frontend drift: ' + field);
  }
  // Each rootDir changes the interpretation of buildCommand and publish path.
  assert.doesNotMatch(web, /buildCommand: cd client/);
  assert.doesNotMatch(web, /staticPublishPath: client\/dist/);
});

test('Blueprint preserves external secret configuration and scoped security headers', () => {
  const [api, web] = readServices(blueprint).map(x => x.content);
  for (const key of ['DATABASE_URL','DB_PASSWORD','JWT_SECRET','JWT_REFRESH_SECRET','RESEND_API_KEY']) {
    assert.match(api, new RegExp('^      - key: ' + key + '\\n        sync: false(?:\\s|$)', 'm'));
  }
  for (const key of ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_VAPID_KEY']) {
    assert.match(web, new RegExp('^      - key: ' + key + '\\n        sync: false(?:\\s|$)', 'm'));
  }
  for (const header of ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','Referrer-Policy','Permissions-Policy','X-Frame-Options']) {
    assert.match(web, new RegExp('^        name: ' + header + '\\s*$', 'm'));
  }
});

test('This static YAML check explicitly does not claim to control Blueprint Auto Sync', () => {
  // Auto Sync belongs to an external Render Blueprint entity. A YAML edit,
  // even with autoDeployTrigger=off, cannot attest its live Auto Sync setting.
  assert.doesNotMatch(blueprint, /^\s*autoSync:\s*false/m,
    'Do not put a fake Blueprint Auto Sync guarantee in service YAML');
});
