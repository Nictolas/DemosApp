const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const allowlists = [...appSource.matchAll(/const allowedOrigins = \[([\s\S]*?)\];/g)].map(match => match[1]);

test('official Render frontend is explicitly trusted by all three active CORS checks', () => {
  assert.equal(allowlists.length, 3, 'keep callback, middleware, and preflight policy in sync');

  for (const entries of allowlists) {
    assert.match(entries, /'https:\/\/demos-frontend-r3so\.onrender\.com'/);
    assert.match(entries, /'https:\/\/www\.demos\.community'/);
    assert.match(entries, /'https:\/\/demos\.community'/);
    assert.doesNotMatch(entries, /\*\.onrender\.com|\*/);
  }
});

test('unknown Render domains are not implicitly trusted', () => {
  for (const entries of allowlists) {
    assert.doesNotMatch(entries, /attacker\.onrender\.com/);
    assert.doesNotMatch(entries, /'https:\/\/\.onrender\.com'/);
  }
});
