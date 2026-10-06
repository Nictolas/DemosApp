const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

const routeSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'admin', 'axiom-migration.js'),
  'utf8'
);

test('legacy Axiom migration fails closed without a dedicated Neon source', () => {
  assert.match(routeSource, /process\.env\.NEON_MIGRATION_DATABASE_URL/);

  for (const route of ['migrate', 'migration-stats', 'status', 'delete-migrated']) {
    const escaped = route.replace('-', '\\-');
    const guardedRoute = new RegExp(
      `router\\.(?:post|get)\\('\\/${escaped}', verifyToken, requireAdmin, requireLegacyMigrationDatabase,`
    );
    assert.match(routeSource, guardedRoute, `${route} must require the legacy database guard`);
  }
});

test('auth probe remains non-destructive and does not require legacy database access', () => {
  assert.match(
    routeSource,
    /router\.get\('\/test-auth', verifyToken, requireAdmin, async/
  );
  assert.doesNotMatch(
    routeSource,
    /router\.get\('\/test-auth', verifyToken, requireAdmin, requireLegacyMigrationDatabase/
  );
});


test('legacy Axiom migration route is not mounted in the runtime app', () => {
  assert.doesNotMatch(appSource, /routes\/admin\/axiom-migration/);
  assert.doesNotMatch(appSource, /\/api\/admin\/axiom-migration/);
});
