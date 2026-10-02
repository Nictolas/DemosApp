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

test('incremental Semgrep gate uses the explicit PR base SHA and blocks new findings', () => {
  assert.match(
    workflow,
    /--baseline-commit "\$\{\{ github\.event\.pull_request\.base\.sha \}\}"/
  );
  assert.match(
    workflow,
    /semgrep scan --config "p\/expressjs" --error --metrics=off --baseline-commit/
  );
});
