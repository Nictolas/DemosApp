const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', 'security-gate.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

test('global Semgrep SAST gate remains unchanged and still scans the full repository', () => {
  assert.match(
    workflow,
    /name: Semgrep CE SAST[\s\S]*semgrep scan --config "p\/expressjs" --error --metrics=off \./
  );
});

test('incremental Semgrep job runs only for pull requests with full git history', () => {
  assert.match(workflow, /name: Semgrep CE incremental/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /fetch-depth: 0/);
});

test('incremental Semgrep gate computes a current merge-base and blocks only new findings', () => {
  assert.match(
    workflow,
    /git merge-base HEAD "origin\/\$\{\{ github\.event\.pull_request\.base\.ref \}\}"/
  );
  assert.match(workflow, /--baseline-commit "\$BASE_SHA"/);
  assert.match(
    workflow,
    /semgrep scan --config "p\/expressjs" --error --metrics=off --baseline-commit/
  );
});

test('Research-scope Semgrep job scans all Research-named API JavaScript files', () => {
  assert.match(workflow, /name: Semgrep CE Research scope/);
  assert.match(workflow, /find api -type f -iname '\*research\*\.js'/);
  assert.match(workflow, /semgrep scan --config "p\/expressjs" --error --metrics=off "\$\{TARGETS\[@\]\}"/);
});

test('Research-scope Semgrep job fails closed when its target set is unexpectedly empty', () => {
  assert.match(workflow, /No Research scope targets found/);
  assert.match(workflow, /if \[ "\$\{#TARGETS\[@\]\}" -eq 0 \]/);
});
