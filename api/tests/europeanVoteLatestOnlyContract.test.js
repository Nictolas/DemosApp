'use strict';

// PROD-041 privacy contract: the European Parliament detail GET must not
// accumulate individual roll-call history in a per-vote SQL cache.
// A separate reviewed latest-only writer is needed before persistence.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const service = fs.readFileSync(
  path.join(__dirname, '../services/parlamentoEuropeoService.js'), 'utf8');
const parltrack = fs.readFileSync(
  path.join(__dirname, '../services/parltrackService.js'), 'utf8');

test('European vote detail remains source-backed without per-vote persistence', () => {
  assert.match(service, /getVotiMEPItalianiDaParltrack/);
  assert.match(service, /estraiVotiMEPItalianiDaVoteResult/);
  assert.doesNotMatch(service, /salvaVotiMEPItaliani/);
  assert.doesNotMatch(service, /INSERT INTO parlamento_europeo_voti_nominali/i);
  assert.match(service, /PROD-041: data shown from fetched source/);
});

test('remove historical MEP writer, including its exported API', () => {
  assert.doesNotMatch(parltrack, /async function salvaVotiMEPItaliani/);
  assert.doesNotMatch(parltrack, /INSERT INTO parlamento_europeo_voti_nominali/i);
  const exported = parltrack.slice(parltrack.lastIndexOf('module.exports = {'));
  assert.match(exported, /getVotiMEPItalianiDaParltrack/);
  assert.doesNotMatch(exported, /salvaVotiMEPItaliani/);
});
