'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routeSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'capo-stato.js'),
  'utf8'
);

async function executeCapoStatoGet(userRole) {
  const getHandlers = new Map();
  const queries = [];
  let cooldownCalls = 0;

  const pool = {
    async query(statement) {
      const sql = String(statement);
      queries.push(sql);
      if (/FROM voti_capo_stato\s+GROUP BY nome/i.test(sql)) {
        return { rows: [{ nome: 'Candidato Test', voti: '3' }] };
      }
      if (/SELECT ruolo FROM users/i.test(sql)) {
        return { rows: [{ ruolo: userRole }] };
      }
      if (/FROM information_schema\.columns/i.test(sql)) {
        return { rows: [
          { column_name: 'id' },
          { column_name: 'userid' },
          { column_name: 'nome' },
          { column_name: 'timestamp' }
        ] };
      }
      if (/SELECT MAX\(timestamp\)/i.test(sql)) {
        return { rows: [{ last_changed_at: null }] };
      }
      if (/SELECT nome\s+FROM voti_capo_stato\s+WHERE/i.test(sql)) {
        return { rows: [{ nome: 'Candidato Test' }] };
      }
      throw new Error('Unexpected query in GET /api/capo-stato: ' + sql);
    }
  };

  const handlers = { Router() {
    return {
      get(name, ...callbacks) { getHandlers.set(name, callbacks.at(-1)); },
      post() {},
      delete() {}
    };
  } };

  const imports = {
    express: handlers,
    '../middleware/auth': { verifyToken() {} },
    '../middleware/politicalConsent': { requirePoliticalConsent() {} },
    '../middleware/civicIdentity': { requireVerifiedCivicIdentity() {} },
    '../config/database': { getPool: () => pool },
    '../services/preferenceCooldownService': {
      getPreferenceCooldown: async () => {
        cooldownCalls += 1;
        return { isBlocked: false, unlockDate: null };
      },
      assertPreferenceChangeAllowed() {},
      recordPreferenceChange() {},
      sendCooldownError() {}
    },
    jsonwebtoken: { verify: () => ({ userId: 'test-user-id' }) },
    dotenv: { config() {} }
  };

  const context = {
    require(name) {
      if (!Object.prototype.hasOwnProperty.call(imports, name)) {
        throw new Error('Unexpected import: ' + name);
      }
      return imports[name];
    },
    module: { exports: {} },
    process: { env: { JWT_SECRET: 'test-only' } },
    console: { log() {}, warn() {}, error() {} }
  };

  vm.runInNewContext(routeSource, context, { filename: 'capo-stato.js' });
  const get = getHandlers.get('/');
  assert.equal(typeof get, 'function');

  let result;
  const res = {
    json(data) { result = JSON.parse(JSON.stringify(data)); return this; },
    status(statusCode) {
      throw new Error('Unexpected status ' + statusCode);
    }
  };
  await get({ headers: { authorization: 'Bearer test-token' } }, res);
  return { queries, result, cooldownCalls };
}

test('ordinary user reads voto schema once and keeps cooldown and personal vote', async () => {
  const { queries, result, cooldownCalls } = await executeCapoStatoGet('P');
  assert.equal(queries.filter((sql) => sql.includes('information_schema.columns')).length, 1);
  assert.equal(cooldownCalls, 1);
  assert.equal(result.success, true);
  assert.equal(result.classifica[0].voti, 3);
  assert.deepEqual(result.mieiVoti, ['Candidato Test']);
  assert.equal(result.blocco.isBlocked, false);
});

test('admin still reads schema once without applying the standard cooldown', async () => {
  const { queries, result, cooldownCalls } = await executeCapoStatoGet('AD');
  assert.equal(queries.filter((sql) => sql.includes('information_schema.columns')).length, 1);
  assert.equal(cooldownCalls, 0);
  assert.deepEqual(result.mieiVoti, ['Candidato Test']);
});
