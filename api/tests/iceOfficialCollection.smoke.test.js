const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const iceRoute = read('api/routes/ice.js');
const eciRoute = read('api/routes/eci.js');
const syncScript = read('api/scripts/sync_eci.py');
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

test('official sync is already scoped to EU initiatives currently in signature collection', () => {
  assert.match(syncScript, /"STATUS\[0\]": "ONGOING"/);
  assert.match(syncScript, /STATUS%5B0%5D=ONGOING/);
  assert.match(syncScript, /status = "ONGOING"/);
  assert.doesNotMatch(syncScript, /SUCCESS.*1000000|1000000.*SUCCESS/);
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
