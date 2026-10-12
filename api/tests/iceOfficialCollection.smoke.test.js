const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const iceRoute = read('api/routes/ice.js');
const eciRoute = read('api/routes/eci.js');
const syncScript = read('api/scripts/sync_eci.py');
const syncWorkflow = read('.github/workflows/eci_sync.yml');
const icePage = read('client/src/pages/ICE/index.tsx');
const iceTable = read('client/src/pages/ICE/components/ICETable.tsx');
const iceHook = read('client/src/pages/ICE/hooks/useICEData.ts');
const app = read('client/src/App.tsx');

test('canonical ICE collection reads the official ECI cache in neutral order', () => {
  assert.match(iceRoute, /FROM eci/);
  assert.match(iceRoute, /ORDER BY end_date ASC NULLS LAST, title ASC, id ASC/);
  assert.match(iceRoute, /ordering: 'neutral'/);
  assert.match(iceRoute, /source: 'eu_official'/);
  assert.doesNotMatch(iceRoute, /ORDER BY[^\n]*signature_count/i);
  assert.doesNotMatch(iceRoute, /voti_ice/);
  assert.doesNotMatch(iceRoute, /mieiVoti/);
});

test('official sync consumes the EU register API and only ONGOING initiatives', () => {
  assert.match(syncScript, /REGISTER_API = "https:\/\/register\.eci\.ec\.europa\.eu\/core\/api\/register"/);
  assert.match(syncScript, /STATUS = "ONGOING"/);
  assert.match(syncScript, /\/search\/\{STATUS\}\/\{LANGUAGE\}/);
  assert.match(syncScript, /\/details\/\{year\}\/\{number\}/);
  assert.match(syncScript, /item\.get\("status"\) != STATUS/);
  assert.match(syncScript, /detail\.get\("status"\) != STATUS/);
  assert.doesNotMatch(syncScript, /BeautifulSoup|playwright|chromium|SUCCESS.*1000000|1000000.*SUCCESS/i);
});

test('official sync is fail-closed, atomic and supports a source-only dry run', () => {
  assert.match(syncScript, /--dry-run/);
  assert.match(syncScript, /if not records:/);
  assert.match(syncScript, /Rifiutata sostituzione cache ECI con dataset vuoto/);
  assert.match(syncScript, /with conn:/);
  assert.match(syncScript, /DELETE FROM eci/);
  assert.match(syncScript, /SELECT COUNT\(\*\) FROM eci WHERE status = %s/);
  assert.match(syncScript, /raise SystemExit\(main\(\)\)/);
});

test('daily ECI workflow has only the dependencies used by the API sync and is bounded', () => {
  assert.match(syncWorkflow, /cron: '0 0 \* \* \*'/);
  assert.match(syncWorkflow, /permissions:\s*\n\s*contents: read/);
  assert.match(syncWorkflow, /group: eci-official-sync/);
  assert.match(syncWorkflow, /timeout-minutes: 10/);
  assert.match(syncWorkflow, /pip install --disable-pip-version-check requests psycopg2-binary/);
  assert.doesNotMatch(syncWorkflow, /playwright|beautifulsoup|chromium|Neon/i);
});

test('internal ICE creation, editing, approval and voting are fail-closed', () => {
  assert.match(iceRoute, /function officialSourceOnly/);
  assert.match(iceRoute, /res\.status\(410\)/);
  assert.match(iceRoute, /router\.post\('\/', verifyToken, officialSourceOnly\)/);
  assert.match(iceRoute, /router\.put\('\/:id', verifyToken, requireAdmin, officialSourceOnly\)/);
  assert.match(iceRoute, /router\.post\('\/vota', verifyToken, officialSourceOnly\)/);
  assert.match(iceRoute, /router\.post\('\/:id\/:action', verifyToken, requireAdmin, officialSourceOnly\)/);
  assert.doesNotMatch(iceRoute, /INSERT INTO voti_ice|UPDATE voti_ice|DELETE FROM voti_ice/);
});

test('legacy ECI API no longer ranks or splits initiatives by popularity', () => {
  assert.match(eciRoute, /ORDER BY end_date ASC NULLS LAST, title ASC, id ASC/);
  assert.match(eciRoute, /ordering: 'neutral'/);
  assert.match(eciRoute, /ongoing: initiatives/);
  assert.match(eciRoute, /successi: \[\]/);
  assert.doesNotMatch(eciRoute, /SUCCESSI_MIN_FIRME|sort\(|ORDER BY[^\n]*signature_count/i);
});

test('main ICE page is a read-only official collection with external signing action', () => {
  assert.match(iceHook, /apiRequest\("GET", "\/api\/ice"\)/);
  assert.doesNotMatch(iceHook, /mieiVoti|ice_proposti|getVotingLimit|hasReachedVotingLimit/);
  assert.doesNotMatch(icePage, /CreateButton|ICEForm|ICEStatsChart|useICEActions|useICEForms/);
  assert.match(icePage, /Non esistono voti o classifiche DEMOS sulle ICE/);
  assert.match(iceTable, /Firma sul portale ufficiale UE/);
  assert.match(iceTable, /target="_blank"/);
  assert.match(iceTable, /Firme ufficiali registrate/);
  assert.doesNotMatch(iceTable, /hasVoted|mieiVoti|Vota|Like|classifica/i);
});

test('legacy ICE client routes converge on the canonical /ice collection', () => {
  assert.match(app, /<Route path="\/eci">\s*<Redirect to="\/ice" \/>/);
  assert.match(app, /<Route path="\/vota-ice">\s*<Redirect to="\/ice" \/>/);
  assert.match(app, /<Route path="\/proponi-ice">\s*<Redirect to="\/ice" \/>/);
  assert.doesNotMatch(app, /import VotaICE/);
  assert.doesNotMatch(app, /import ECI from/);
  assert.doesNotMatch(app, /import ProponiICE/);
});
