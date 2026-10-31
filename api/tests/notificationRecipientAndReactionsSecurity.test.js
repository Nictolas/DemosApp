'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Demos feed and latest notification never select another user by title', () => {
  const source = read('api/routes/notifiche.js');
  const canonicalRecipientFilter = 'WHERE (id_utente IS NULL OR id_utente = $1::uuid)';
  assert.equal(source.split(canonicalRecipientFilter).length - 1, 2, 'feed and latest notification must use the same recipient gate');
  assert.doesNotMatch(source, /titolo NOT LIKE 'DEMOS — %'/, 'title text cannot be used as an authorization condition');
  assert.match(source, /const user_id = req\.user\.id/);
  assert.match(source, /const userId = req\.user\.id/);
  assert.match(source, /const isAdmin = Boolean\(req\.user\?\.isAdmin\)/);
});

test('reactions cannot be written on behalf of another user', () => {
  const source = read('api/routes/reazioni-comunicazioni.js');
  assert.match(source, /router\.post\('\/', verifyToken, async \(req, res\)/);
  assert.match(source, /const utente_id = req\.user\.id/);
  assert.doesNotMatch(source, /const \{ comunicazione_id, utente_id, tipo \} = req\.body/);
  assert.match(source, /INSERT INTO reazioni \(id, comunicazione_id, utente_id, tipo/);
});

test('both personal reaction readers require JWT and enforce self ownership', () => {
  const source = read('api/routes/reazioni-comunicazioni.js');
  assert.match(source, /router\.get\('\/user\/:utente_id\/batch', verifyToken, async/);
  assert.match(source, /router\.get\('\/user\/:utente_id\/:comunicazione_id', verifyToken, async/);
  assert.equal((source.match(/req\.params\.utente_id !== req\.user\.id/g) || []).length, 2);
  assert.equal((source.match(/res\.status\(403\)\.json\(\{ success: false, error: 'Accesso non autorizzato' \}\)/g) || []).length, 2);
  // Aggregate public reaction totals do not contain a personal identifier.
  assert.match(source, /router\.get\('\/batch', async/);
});

test('public Grazia ranking never returns raw voter rows', () => {
  const source = read('api/routes/grazia.js');
  const publicRoute = source.split("router.get('/', async (req, res) => {")[1]?.split("// GET /api/grazia/richieste")[0];
  assert.ok(publicRoute, 'public route must exist');
  assert.doesNotMatch(publicRoute, /SELECT \*\s+FROM voti_grazia/, 'no SELECT * of personal preferences in public feed');
  assert.doesNotMatch(publicRoute, /richieste: result\.rows/, 'no personal vote rows in JSON');
  assert.match(publicRoute, /(?:COUNT\(\*\)::bigint|COUNT\(v\.id\)::integer) AS richieste/, 'aggregated ranking is preserved');
});
