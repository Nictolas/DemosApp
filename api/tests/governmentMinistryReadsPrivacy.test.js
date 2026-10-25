'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const full = fs.readFileSync(path.join(__dirname, '../routes/governo.js'), 'utf8');
const fromVoti = full.indexOf('// GET /api/governo/voti -');
const toVoti = full.indexOf('// POST /api/governo/vota -', fromVoti);
const fromIdeale = full.indexOf('// GET /api/governo/ideale -');
const toIdeale = full.indexOf('// POST /api/governo - Aggiungi membro governo', fromIdeale);
assert.ok(fromVoti >= 0 && toVoti > fromVoti && fromIdeale > toVoti && toIdeale > fromIdeale);

const ministryNames = [
  'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno',
  'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente',
  'ambiente_sicurezza_energetica', 'cultura', 'sport'
];
const allowlistedTables = new Set(ministryNames.map(name => 'voti_' + name));

function validateJoinedSql(sql, personal) {
  const match = sql.match(/FROM (voti_[a-z_]+) v/);
  assert.ok(match && allowlistedTables.has(match[1]), 'Only allowlisted ministry tables can be read');
  assert.match(sql, /JOIN users u ON u\.id::text = v\.userid::text/);
  assert.match(sql, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
  assert.match(sql, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
  if (personal) assert.match(sql, /WHERE v\.userid::text = \$1::text/);
  return match[1].slice(5);
}

async function perform(route, {
  granted = true, finalRevoked = false, authenticated = true,
  missingTable = null, unexpectedFailure = false, admin = false,
  rowsByMinistry = { difesa: 'Synthetic Minister', esteri: 'Second Minister' }
} = {}) {
  const logs = [], queries = [], cooldowns = [];
  let checks = 0, handlers;
  const pool = {
    async query(sql, params) {
      const q = String(sql).replace(/\s+/g, ' ').trim();
      queries.push(q);
      const personal = !q.includes('COUNT(*)::integer');
      const ministry = validateJoinedSql(q, personal);
      if (unexpectedFailure && ministry === 'difesa') throw Error('synthetic-private-SQL-details');
      if (ministry === missingTable) {
        const error = Error('missing synthetic table');
        error.code = '42P01';
        throw error;
      }
      if (!personal) {
        const rows = granted && rowsByMinistry[ministry]
          ? [{ nome: rowsByMinistry[ministry], voti: 1 }] : [];
        return { rows };
      }
      assert.deepEqual(Array.from(params), ['synthetic-user']);
      const rows = granted && rowsByMinistry[ministry] ? [{
        nome: rowsByMinistry[ministry],
        nome_display: rowsByMinistry[ministry],
        timestamp: '2026-10-25T08:00:00Z'
      }] : [];
      return { rows };
    }
  };
  const router = { get(routePath, ...list) {
    assert.equal(routePath, route);
    handlers = list;
  }};
  const pass = (_req, _res, next) => next();
  const code = route === '/voti' ? full.slice(fromVoti, toVoti) : full.slice(fromIdeale, toIdeale);
  vm.runInNewContext(code, {
    router, pool,
    verifyToken: authenticated ? pass : (_req, res) => res.status(401).json({ success: false }),
    getPoliticalConsentState: async (db, id) => {
      assert.equal(db, pool);
      assert.equal(id, 'synthetic-user');
      checks++;
      return { exists: true, granted: granted && (!finalRevoked || checks === 1) };
    },
    getPreferenceCooldown: async (db, opts) => {
      assert.equal(db, pool);
      cooldowns.push(opts);
      return { isBlocked: true, unlockDate: '2026-10-26T08:00:00Z' };
    },
    console: { log: (...v) => logs.push(v), error: (...v) => logs.push(v), warn: (...v) => logs.push(v) },
    Number, Object
  });
  assert.equal(handlers.length, 3, 'no-store middleware must precede auth');
  const res = {
    statusCode: 200, headers: {}, body: null,
    set(key, val) { this.headers[key.toLowerCase()] = val; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; }
  };
  const req = { userId: 'synthetic-user', user: { id: 'synthetic-user', isAdmin: admin } };
  for (const handler of handlers) {
    let next = false;
    await handler(req, res, () => { next = true; });
    if (!next) break;
  }
  assert.match(res.headers['cache-control'] || '', /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'] || '', /(?:^|,\s*)no-store(?:,|$)/);
  assert.doesNotMatch(JSON.stringify(logs), /synthetic-private-SQL-details|synthetic-user|Synthetic Minister/);
  return { res, queries, cooldowns, checks };
}

test('GET /voti aggregates only active consent and reads own votes on consented SQL', async () => {
  const { res, queries, cooldowns, checks } = await perform('/voti');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.classifiche.difesa[0].voti, 1);
  assert.equal(res.body.classifiche.difesa[0].nome, 'Synthetic Minister');
  assert.equal(res.body.mieiVoti.difesa, 'Synthetic Minister');
  assert.equal(res.body.mieiVoti.esteri, 'Second Minister');
  assert.equal(res.body.blocchi.difesa.isBlocked, true);
  assert.equal(res.body.blocco.isBlocked, true);
  assert.equal(cooldowns.length, 14);
  assert.equal(queries.length, 28);
  assert.equal(checks, 2);
});

test('GET /voti after revocation excludes own residual votes and cooldown history', async () => {
  const { res, queries, cooldowns, checks } = await perform('/voti', { granted: false });
  assert.equal(res.statusCode, 200);
  assert.equal(Object.keys(res.body.mieiVoti).length, 0);
  assert.equal(res.body.classifiche.difesa.length, 0);
  assert.equal(res.body.blocchi.difesa.isBlocked, false);
  assert.equal(res.body.blocco.isBlocked, false);
  assert.equal(cooldowns.length, 0);
  assert.equal(queries.length, 14, 'No private vote queries for revoked users');
  assert.equal(checks, 2);
});

test('GET /voti revocation after queries clears personal data before response', async () => {
  const { res } = await perform('/voti', { finalRevoked: true });
  assert.equal(res.statusCode, 200);
  assert.equal(Object.keys(res.body.mieiVoti).length, 0);
  assert.equal(res.body.blocco.isBlocked, false);
  assert.equal(res.body.blocchi.esteri.unlockDate, null);
});

test('GET /voti preserves old behavior for missing ministry tables only', async () => {
  const { res } = await perform('/voti', { missingTable: 'cultura' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.classifiche.cultura.length, 0);
  assert.equal(res.body.blocchi.cultura.isBlocked, false);
  assert.equal(res.body.mieiVoti.difesa, 'Synthetic Minister');
});

test('GET /voti unexpected DB errors fail closed, not partially expose votes', async () => {
  const { res } = await perform('/voti', { unexpectedFailure: true });
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('synthetic-private-SQL-details'), false);
});

test('GET /ideale returns only own active-consent preferences', async () => {
  const { res, queries, cooldowns, checks } = await perform('/ideale');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.difesa, 'Synthetic Minister');
  assert.equal(queries.length, 14);
  assert.equal(cooldowns.length, 0);
  assert.equal(checks, 2);
});

test('GET /ideale denied consent reads no minister votes and returns empty object', async () => {
  const { res, queries, checks } = await perform('/ideale', { granted: false });
  assert.equal(res.statusCode, 200);
  assert.equal(Object.keys(res.body.data).length, 0);
  assert.equal(queries.length, 0);
  assert.equal(checks, 1);
});

test('GET /ideale revocation during query clears earlier results', async () => {
  const { res } = await perform('/ideale', { finalRevoked: true });
  assert.equal(res.statusCode, 200);
  assert.equal(Object.keys(res.body.data).length, 0);
});

test('GET /ideale handles absent tables without leaking errors', async () => {
  const { res } = await perform('/ideale', { missingTable: 'cultura' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.cultura, undefined);
  assert.equal(res.body.data.difesa, 'Synthetic Minister');
});

test('GET /ideale unexpected errors return sanitized 500 without partial data', async () => {
  const { res } = await perform('/ideale', { unexpectedFailure: true });
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('synthetic-private-SQL-details'), false);
});

test('both GET routes return no-store 401 without any DB reads', async () => {
  for (const route of ['/voti', '/ideale']) {
    const { res, queries, checks } = await perform(route, { authenticated: false });
    assert.equal(res.statusCode, 401);
    assert.equal(queries.length, 0);
    assert.equal(checks, 0);
  }
});

test('government personalized political endpoints already bypass Cloudflare cache policy', () => {
  const policy = require('../config/publicCachePolicy');
  for (const p of ['/api/governo/voti', '/api/governo/ideale']) {
    assert.ok(policy.neverCachePathPrefixes.some(prefix => p.startsWith(prefix)), p);
  }
});

test('neither GET route prints personal preferences or SQL exception objects', () => {
  for (const code of [full.slice(fromVoti, toVoti), full.slice(fromIdeale, toIdeale)]) {
    assert.doesNotMatch(code, /console\.(?:log|warn)\s*\(/);
    assert.doesNotMatch(code, /console\.error\([^)]*(?:error|req|userId)/);
  }
});
