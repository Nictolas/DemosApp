'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname,'..','..');
const source = fs.readFileSync(
  path.join(root,'.github','workflows','eci_sync.yml'), 'utf8');
const ministry = fs.readFileSync(
  path.join(root,'.github','workflows','civic-ministero-sync.yml'), 'utf8');

test('ECI schedule requires a separate release opt-in before any job starts',()=>{
  assert.match(source,/^on:\s*$/m);
  assert.match(source,/^  schedule:\s*$/m);
  assert.match(source,/^  workflow_dispatch:\s*$/m);
  assert.match(source,/^jobs:\s*\n  sync-eci:\s*\n(?:[^\n]*\n){0,5}    if: [$][{][{] vars\.CIVIC_ECI_SCHEDULER_ENABLED == 'true' [}][}]/m);
  assert.match(source,/^concurrency:\s*\n  group: demos-civic-eci-scheduler\s*\n  cancel-in-progress: false/m);
  assert.match(source,/^    timeout-minutes: 8\s*$/m);
  assert.match(source,/^    permissions:\s*\n      contents: read/m);
});

test('staging-only approval is not silently equated with dispatch approval',()=>{
  assert.match(source,/^\s*DATABASE_URL: [$][{][{] secrets\.DATABASE_URL [}][}]/m);
  assert.match(source,/^\s*CIVIC_RUNTIME_DATABASE_ID: [$][{][{] secrets\.CIVIC_RUNTIME_DATABASE_ID [}][}]/m);
  assert.match(source,/^\s*CIVIC_NEW_INITIATIVE_EVENTS_ENABLED: [$][{][{] vars\.CIVIC_NEW_INITIATIVE_EVENTS_ENABLED [}][}]/m);
  assert.match(source,/^\s*if: [$][{][{] vars\.CIVIC_NEW_INITIATIVE_PUSH_ENABLED == 'true' [}][}]/m);
  assert.match(source,/^\s*run: python api\/scripts\/sync_eci\.py\s*$/m);
  assert.doesNotMatch(source,/^\s*run:.*(--force|--enable-push|--production)/m);
  // Ministero and ECI opt in separately, never by the same env switch.
  assert.match(ministry,/^\s*if: [$][{][{] vars\.CIVIC_MINISTERO_SCHEDULER_ENABLED == 'true' [}][}]/m);
  assert.doesNotMatch(source,/CIVIC_MINISTERO_SCHEDULER_ENABLED/);
});
