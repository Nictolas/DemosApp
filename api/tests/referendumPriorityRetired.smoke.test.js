const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const route = read('api/routes/referendum-abrogativi.js');
const app = read('client/src/App.tsx');
const voteHub = read('client/src/pages/Vota.tsx');
const desktop = read('client/src/pages/Preferiti/PreferitiDesktopHub.tsx');
const mobile = read('client/src/pages/Preferiti/index.tsx');
const activeHook = read('client/src/pages/ReferendumAbrogativi/hooks/useReferendumData.ts');
const activeActions = read('client/src/pages/ReferendumAbrogativi/hooks/useReferendumActions.ts');
const table = read('client/src/pages/ReferendumAbrogativi/components/ReferendumTable.tsx');

function between(src, start, end) {
  const s = src.indexOf(start);
  assert.notEqual(s, -1, `missing start marker: ${start}`);
  const e = src.indexOf(end, s + start.length);
  assert.notEqual(e, -1, `missing end marker: ${end}`);
  return src.slice(s, e);
}

test('normal referendum collection has no DEMOS priority payload or vote-table reads', () => {
  const get = between(route, "router.get('/', async (req, res) => {", '// POST /api/referendum-abrogativi -');
  assert.match(get, /req\.query\.vota === 'true'[\s\S]*referendumPriorityRetired/);
  assert.match(get, /buildQueryForTipo\('referendum', null, null, false, true\)/);
  assert.doesNotMatch(get, /voti_referendum_abrogativi|classifica\s*:|mieiVoti\s*:|blocco\s*:/);
});

test('legacy referendum priority write/delete endpoints are fail-closed', () => {
  const post = between(route, "router.post('/vota'", "// DELETE /api/referendum-abrogativi/vota");
  const del = between(route, "router.delete('/vota'", "// GET /api/referendum-abrogativi/prossima");
  assert.match(route, /PRIORITA_REFERENDUM_DISMESSA/);
  assert.match(post, /referendumPriorityRetired\(res\)/);
  assert.match(del, /referendumPriorityRetired\(res\)/);
  assert.doesNotMatch(post + del, /INSERT INTO voti_referendum_abrogativi|DELETE FROM voti_referendum_abrogativi|recordPreferenceChange|assertPreferenceChangeAllowed/);
  assert.doesNotMatch(route, /referendum-abrogativi:preferenza/);
});

test('legacy client voting URL redirects to official referendum collection', () => {
  assert.doesNotMatch(app, /import VotaReferendumAbrogativo/);
  assert.match(app, /path="\/vota-referendum-abrogativo"[\s\S]*Redirect to="\/referendum-abrogativi"/);
});

test('active navigation no longer advertises referendum priority', () => {
  assert.doesNotMatch(voteHub, /vota-referendum-abrogativo|Referendum<br \/>Abrogativo/);
  assert.doesNotMatch(desktop, /vota-referendum|Quale referendum ha la priorità|Vota Referendum/);
  assert.doesNotMatch(mobile, /path\.startsWith\("\/vota-referendum"\)/);
});

test('active referendum page is official-list only', () => {
  assert.match(activeHook, /GET", "\/api\/referendum-abrogativi"/);
  assert.doesNotMatch(activeHook, /mieiVoti|referendumProposte|getVotingLimit|hasReachedVotingLimit|remainingProposals/);
  assert.doesNotMatch(activeActions, /useMutation|POST|PUT|DELETE|accetta|rifiuta|VotingLimit/);
  assert.doesNotMatch(table, /mieiVoti|quorum === 'proposta'/);
  assert.match(table, /referendum\.signature_threshold/);
  assert.match(table, /firmeRaccolte >= sogliaFirme/);
  assert.doesNotMatch(table, />= 500000|< 500000/);
});

test('future referendum YES-NO semantics are not conflated with retired priority', () => {
  const activeSurface = activeHook + '\n' + activeActions + '\n' + table;
  assert.doesNotMatch(activeSurface, /preferenza.*referendum|priorità.*referendum/i);
});
