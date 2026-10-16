const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const source = (name) => fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');

test('government administrative writes require capability-aware Admin middleware', () => {
  const governo = source('governo.js');
  const ministro = source('governo-ministro.js');

  assert.match(governo, /const \{ verifyToken, requireAdmin \} = require\('\.\.\/middleware\/auth'\)/);
  assert.match(governo, /router\.post\('\/', verifyToken, requireAdmin,/);
  assert.match(governo, /router\.put\('\/attuale\/:ruolo', verifyToken, requireAdmin,/);
  assert.doesNotMatch(governo, /userRole\s*!==\s*'A'/);
  assert.doesNotMatch(ministro, /userRole\s*===\s*'A'/);
  assert.match(ministro, /Boolean\(req\.user\?\.isAdmin\)/);
});

test('Grazia management and state transitions are Admin-only', () => {
  const grazia = source('grazia.js');
  assert.match(grazia, /router\.get\('\/richieste', verifyToken, requireAdmin,/);
  assert.match(grazia, /router\.post\('\/richiesta\/:id\/:action', verifyToken, requireAdmin,/);
});

test('ICE management and approval transitions are Admin-only', () => {
  const ice = source('ice.js');
  assert.match(ice, /router\.get\('\/richieste', verifyToken, requireAdmin,/);
  assert.match(ice, /router\.put\('\/:id', verifyToken, requireAdmin,/);
  assert.match(ice, /router\.post\('\/:id\/:action', verifyToken, requireAdmin,/);
});

test('Amnistia migration and diagnostic endpoints are Admin-only', () => {
  const amnistia = source('amnistia.js');
  for (const route of [
    /router\.post\('\/migrate', verifyToken, requireAdmin,/,
    /router\.post\('\/migrate-ids', verifyToken, requireAdmin,/,
    /router\.get\('\/test', verifyToken, requireAdmin,/,
    /router\.get\('\/debug', verifyToken, requireAdmin,/,
    /router\.post\('\/fix-primary-key', verifyToken, requireAdmin,/
  ]) assert.match(amnistia, route);
});

test('role diagnostics no longer expose arbitrary account privilege data anonymously', () => {
  const roles = source('verifica-ruoli.js');
  assert.match(roles, /router\.get\('\/utente\/:id', verifyToken, requireAdmin,/);
  assert.match(roles, /router\.post\('\/check-admin', verifyToken,/);
  assert.doesNotMatch(roles, /const \{ user_id \} = req\.body/);
  assert.match(roles, /Boolean\(req\.user\?\.isAdmin\)/);
});


test('Ministero diagnostics are Admin-only and public collection cannot force live fetches', () => {
  const ministero = source('ministero.js');
  assert.match(ministero, /router\.get\('\/sync\/status', verifyToken, requireAdmin,/);
  assert.match(ministero, /router\.get\('\/database', verifyToken, requireAdmin,/);
  assert.match(ministero, /router\.get\('\/logs', verifyToken, requireAdmin,/);
  assert.doesNotMatch(ministero, /source === 'ministero'/);
  const client = fs.readFileSync(path.join(ROOT, '..', 'client', 'src', 'pages', 'TestMinistero.tsx'), 'utf8');
  assert.match(client, /hasAdminCapability\(user\)/);
  assert.doesNotMatch(client, /user\.ruolo !== \"AD\"/);
});

test('manual notification creation and Ministero sync are Admin-only', () => {
  const notifiche = source('notifiche.js');
  const ministero = source('ministero.js');
  assert.match(notifiche, /const \{ verifyToken, requireAdmin \} = require\('\.\.\/middleware\/auth'\)/);
  assert.match(notifiche, /router\.post\('\/', verifyToken, requireAdmin,/);
  assert.match(ministero, /const \{ verifyToken, requireAdmin \} = require\('\.\.\/middleware\/auth'\)/);
  assert.match(ministero, /router\.post\('\/sync', verifyToken, requireAdmin,/);
});

test('latent category and extra-user role mutations are Admin-only before reuse', () => {
  const categorie = source('categorie.js');
  const gestione = source('gestione-utenti-aggiuntivi.js');
  assert.match(categorie, /router\.post\('\/', verifyToken, requireAdmin,/);
  assert.match(gestione, /router\.use\(verifyToken, requireAdmin\)/);
});

test('live admin database schema mutation requires authenticated Admin', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes', 'admin', 'database.js'), 'utf8');
  assert.match(src, /router\.post\('\/add-opinioni-columns', verifyToken, requireAdmin,/);
  assert.doesNotMatch(src, /TEMPORANEAMENTE SENZA AUTENTICAZIONE/);
});

test('dev migration, fix and cleanup routers require authenticated Admin globally', () => {
  for (const name of ['fix-database.js', 'migrations.js', 'cleanup.js', 'cleanup-reset-rate-limit.js']) {
    const src = source(name);
    assert.match(src, /const \{ verifyToken, requireAdmin \} = require\('\.\.\/middleware\/auth'\)/);
    assert.match(src, /router\.use\(verifyToken, requireAdmin\)/);
  }
});

test('diagnostic endpoints on live routers are Admin-only', () => {
  const checks = [
    ['comunicazioni.js', /router\.get\('\/debug-firebase-admin', verifyToken, requireAdmin,/, /router\.get\('\/debug-notifiche-demos', verifyToken, requireAdmin,/],
    ['iniziative-popolari.js', /router\.get\('\/debug', verifyToken, requireAdmin,/],
    [path.join('opinioni', 'stats.js'), /router\.get\('\/debug', verifyToken, requireAdmin,/],
    ['voti-politici.js', /router\.get\('\/debug', verifyToken, requireAdmin,/],
    ['opinioni-proposte.js', /router\.get\('\/test-voto', verifyToken, requireAdmin,/, /router\.get\('\/debug', verifyToken, requireAdmin,/]
  ];
  for (const [name, ...patterns] of checks) {
    const src = source(name);
    for (const pattern of patterns) assert.match(src, pattern);
  }
});

test('proposed-opinion deletion uses canonical Admin middleware instead of a legacy role query', () => {
  const src = source('opinioni-proposte.js');
  assert.match(src, /router\.delete\('\/:id', verifyToken, requireAdmin,/);
  assert.doesNotMatch(src, /Solo gli amministratori possono cancellare opinioni/);
});


test('Opinion approfondimento mutations use canonical Admin middleware', () => {
  const src = source(path.join('opinioni', 'user-answers.js'));
  assert.match(src, /router\.put\('\/:id\/approfondimento', verifyToken, requireAdmin,/);
  assert.doesNotMatch(src, /Solo gli amministratori possono modificare gli approfondimenti/);
});

test('Camera administrative tools use capability-aware Admin middleware', () => {
  const src = source('voti-camera.js');
  for (const route of [
    /router\.put\('\/:politico\/url', verifyToken, requireAdmin,/,
    /router\.delete\('\/:politico', verifyToken, requireAdmin,/,
    /router\.post\('\/sync', verifyToken, requireAdmin,/,
    /router\.post\('\/votazione\/:votazione_id\/spiegazione', verifyToken, requireAdmin,/,
    /router\.post\('\/:politico\/spiegazione', verifyToken, requireAdmin,/,
    /router\.post\('\/genera-spiegazioni', verifyToken, requireAdmin,/
  ]) assert.match(src, route);
  assert.doesNotMatch(src, /jwt\.verify\(token, process\.env\.JWT_SECRET\)/);
});

test('owner-or-Admin activist-type edit checks canonical Admin capability', () => {
  const src = source('attivismo-tipologie.js');
  assert.match(src, /const isAdmin = Boolean\(req\.user\?\.isAdmin\)/);
  assert.doesNotMatch(src, /req\.user\?\.ruolo === 'AD'/);
});


test('parliamentary data synchronization mutations are Admin-only', () => {
  const src = source('voti-politici.js');
  const syncRoutes = src.match(/router\.post\('\/sync[^']*', verifyToken, requireAdmin,/g) || [];
  assert.ok(syncRoutes.length >= 3, `expected at least 3 Admin-only sync routes, found ${syncRoutes.length}`);
});
