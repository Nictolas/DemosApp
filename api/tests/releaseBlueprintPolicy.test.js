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
