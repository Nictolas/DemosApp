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

test('release Blueprint policy check runs on every PR to main (no paths filters)', () => {
  assert.match(workflow, /^on:\s*\n\s+pull_request:\s*\n\s+branches:\s*\n\s+- main\s*$/m);
  assert.doesNotMatch(workflow, /^\s+paths(?:-ignore)?:/m);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow, /push:\s*\n/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
});
