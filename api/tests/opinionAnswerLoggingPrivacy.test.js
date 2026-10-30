'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Prevent incidental exposure of sensitive political answers in client
// JavaScript logs. This verifies exact production source files, not fixtures.
const read = p => fs.readFileSync(path.resolve(__dirname,'../..',p),'utf8');
const sources = [
  'client/src/pages/OpinioniNazionali.tsx',
  'client/src/pages/OpinioniRegionali.tsx',
  'client/src/pages/OpinioniComunali.tsx',
  'client/src/pages/OpinioniEuropee.tsx',
  'client/src/lib/api-request.ts'
];

test('political opinions screens and API wrapper never log individual answers or request bodies', () => {
  for (const file of sources) {
    const source = read(file);
    assert.doesNotMatch(source,/\bconsole\s*\.\s*(?:log|warn|error|debug)\s*\(/,file);
  }
});

test('opinion-save backend does not log user IDs or answer payloads', () => {
  const source = read('api/routes/opinioni/user-answers.js');
  const logCalls = source.split('\n').filter(line=>/\bconsole\s*\.\s*(?:log|warn|error|debug)\s*\(/.test(line));
  assert.equal(logCalls.length,1);
  assert.match(logCalls[0],/error\?\.code \|\| error\?\.name/);
  assert.doesNotMatch(logCalls.join('\n'),/userId|risposta|opinioniToSave|error\s*\)/i);
});
