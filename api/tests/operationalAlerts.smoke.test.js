const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const service = read('api/services/operationalAlertService.js');
const logger = read('api/services/centralizedLogger.js');
const notifications = read('api/services/notificationService.js');
const app = read('api/app.js');

test('operational alerts target Admin capability with legacy fallback only', () => {
  assert.match(service, /columnExists\('users', 'is_admin'\)/);
  assert.match(service, /COALESCE\(is_admin, FALSE\) = TRUE/);
  assert.match(service, /columnExists\('users', 'ruolo'\)/);
  assert.match(service, /ruolo = 'AD'/);
});

test('alerts persist privately for Admin and use canonical active FCM device tokens', () => {
  assert.match(service, /INSERT INTO notifiche_demos/);
  assert.match(service, /id_utente/);
  assert.match(service, /FROM user_devices/);
  assert.match(service, /is_active = TRUE/);
  assert.match(service, /getFirebaseAdmin/);
  assert.match(service, /firebaseAdmin\.messaging\(\)\.send/);
});

test('push content is minimal and does not ship stack traces or raw error details', () => {
  assert.doesNotMatch(service, /error\.stack|alert\.error|alert\.details/);
  assert.match(service, /type: 'operational_alert'/);
  assert.match(service, /url: '\/notifiche'/);
});

test('duplicate alert storms are suppressed by fingerprint and cooldown', () => {
  assert.match(service, /buildFingerprint/);
  assert.match(service, /OPERATIONAL_ALERT_COOLDOWN_MS/);
  assert.match(service, /recentAlerts/);
  assert.match(service, /suppressed: true/);
});

test('unhandled global API errors generate operational critical alerts', () => {
  assert.match(app, /globalError: true/);
  assert.match(logger, /meta\.globalError === true/);
  assert.match(logger, /OperationalAlertService\.sendCriticalAlert/);
  assert.match(logger, /type: 'UNHANDLED_API_ERROR'/);
});

test('malformed client URI errors are suppressed before critical delivery', () => {
  assert.match(service, /function isMalformedClientUriAlert/);
  assert.match(service, /alert\.type !== 'UNHANDLED_API_ERROR'/);
  assert.match(service, /alert\.code !== 'URIERROR'/);
  assert.match(service, /alert\.malformedClientUri === true/);
  assert.match(logger, /decodeURI\(String\(req\.originalUrl/);
  assert.match(service, /decodeURI\(endpoint\)/);
  assert.match(service, /if \(isMalformedClientUriAlert\(normalized\)\)/);
  assert.match(service, /reason: 'MALFORMED_CLIENT_URI'/);
});

test('legacy email-disabled notification facade routes critical/system alerts to the operational channel', () => {
  assert.match(notifications, /OperationalAlertService = require\('\.\/operationalAlertService'\)/);
  assert.match(notifications, /sendCriticalViolationNotification[\s\S]*OperationalAlertService\.sendCriticalAlert/);
  assert.match(notifications, /sendSystemAlertNotification[\s\S]*OperationalAlertService\.sendCriticalAlert/);
});


test('technical alerts describe the incident without unsafe raw paths or stacks', () => {
  assert.match(service, /Il server ha incontrato un errore imprevisto/);
  assert.match(service, /API non classificata/);
  assert.match(service, /Codice: \$\{normalized\.code\}/);
  assert.match(service, /safeDiagnosticCode/);
  assert.match(service, /INTERVAL '6 hours'/);
});

test('operational alert feed is limited to recipient in both feed and latest endpoints', () => {
  const feed = read('api/routes/notifiche.js');
  const restricted = feed.match(/WHERE \(id_utente IS NULL OR id_utente = \$1::uuid\)/g) || [];
  assert.equal(restricted.length, 2);
  assert.match(feed, /LIMIT 50\s+`\s*,\s*\[user_id\]/);
  assert.match(feed, /LIMIT 1\s+`\s*,\s*\[userId\]/);
  const broadcast = read('api/routes/comunicazioni.js');
  assert.match(broadcast, /SELECT id FROM notifiche_demos WHERE titolo LIKE 'Notifica Demos:%'/);
});


test('administrative diagnostics never enter citizen notification lists or the shared badge', () => {
  const api = read('api/routes/notifiche.js');
  const filter = /AND COALESCE\(titolo, ''\) !~ '\^DEMOS — \(Critico\|Elevato\|Attenzione\|CRITICAL\|HIGH\|WARN\): \(Errore server\|Avviso operativo\)\$'/g;
  // Main /api/notifiche and /api/notifiche/ultima must behave consistently.
  assert.equal((api.match(filter) || []).length, 2);
  // Keep records and push-to-admin unchanged: no DB DELETE and no alert suppression.
  assert.doesNotMatch(api, /DELETE FROM notifiche_demos/);
  assert.match(service, /INSERT INTO notifiche_demos/);
  assert.match(service, /pushToAdmins\(adminIds, title, body, normalized\)/);

  const frontend = read('client/src/lib/notificationFeed.ts');
  assert.match(frontend, /OPERATIONAL_ALERT_TITLE/);
  assert.match(frontend, /value\.tipo_notifica === 'demos'/);
  assert.match(frontend, /payload\.notifiche\.filter/);
  assert.match(frontend, /!isOperationalDiagnosticNotice\(item\)/);
  // Preserve nontechnical DEMOS announcements and parliamentary notifications.
  const predicate = /^DEMOS — (?:Critico|Elevato|Attenzione|CRITICAL|HIGH|WARN): (?:Errore server|Avviso operativo)$/;
  assert.equal(predicate.test('DEMOS — Critico: Errore server'), true);
  assert.equal(predicate.test('DEMOS — Elevato: Avviso operativo'), true);
  assert.equal(predicate.test('Notifica Demos: nuovo aggiornamento'), false);
  assert.equal(predicate.test('Il tuo deputato ha votato'), false);
});
