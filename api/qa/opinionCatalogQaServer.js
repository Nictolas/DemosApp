'use strict';
// Disposable QA server only. Never mount it into the production API.
const crypto = require('node:crypto');
const express = require('express');
const path = require('node:path');
const { getAllOpinions } = require('../services/opinionCatalog');

const USER_ID = 'qa-synthetic-opinions-user';
const SECOND_USER_ID = 'qa-synthetic-opinions-user-b';
const ids = new Set(getAllOpinions().map(op => op.id));
const BLOCKED_DB_ENV = ['DATABASE_URL', 'POSTGRES_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'PGHOST', 'PGDATABASE'];

function createQaApp() {
  if (process.env.DEMOS_OPINIONS_QA_ONLY !== 'isolated-synthetic') {
    throw Error('QA-only flag missing: refusing startup');
  }
  const token = process.env.DEMOS_OPINIONS_QA_TOKEN || '';
  if (token.length < 48) throw Error('QA token missing or too short');
  const secondToken = process.env.DEMOS_OPINIONS_QA_TOKEN_B || null;
  if (secondToken && (secondToken.length < 48 || secondToken === token)) {
    throw Error('Second synthetic QA token invalid');
  }
  const accounts = new Map([[token, USER_ID]]);
  if (secondToken) accounts.set(secondToken, SECOND_USER_ID);
  for (const key of BLOCKED_DB_ENV) {
    if (process.env[key]) throw Error('Database environment is forbidden in synthetic QA: ' + key);
  }

  const stateByUser = new Map([...accounts.values()].map(id => [id, {
    consent: true, answers: Object.create(null), hasRow: false
  }]));
  const normalize = sql => String(sql).replace(/\s+/g, ' ').trim();
  const ownerOf = params => params.find(value => stateByUser.has(value));
  const validUser = params => !!ownerOf(params);
  const query = async (statement, params = []) => {
    const sql = normalize(statement);
    const owner = ownerOf(params);
    const state = stateByUser.get(owner);
    if (/\bopinioni_domande\b/i.test(sql)) throw Error('Legacy catalog SQL is forbidden');
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK')
      return { rows: [], rowCount: 0 };
    if (sql.includes('FROM users u LEFT JOIN user_consents uc') && sql.includes('FROM opinioni_risposte a WHERE a.user_id = u.id')) {
      if (!sql.includes('COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE')) {
        throw Error('QA GET does not enforce political consent in the answer SELECT');
      }
      if (sql.includes('fonti_opinioni') || sql.includes('SELECT *')) throw Error('QA GET must project only published answer columns');
      return { rows: validUser(params) ? [{
        id: owner, status: 'a', ruolo: 'E',
        opinion_answers: state.hasRow && state.consent ? { ...state.answers } : null
      }] : [] };
    }
    if (sql === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
      return { rows: validUser(params) ? [{ id: owner }] : [], rowCount: validUser(params) ? 1 : 0 };
    }
    if (sql.includes('AS granted') && sql.includes('user_consents')) {
      return { rows: validUser(params) ? [{ granted: state.consent }] : [], rowCount: 1 };
    }
    if (sql.includes('information_schema.columns')) throw Error('No schema lookup in QA save');
    if (sql.includes('FROM opinioni_risposte') && sql.includes('FOR UPDATE')) {
      return { rows: state?.hasRow && validUser(params) ? [{ user_id: owner, ...state.answers }] : [], rowCount: state?.hasRow ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO opinioni_risposte')) {
      const match = sql.match(/INSERT INTO opinioni_risposte\s*\(([^)]+)\)/i);
      if (!match || !state || params[0] !== owner) throw Error('Unexpected synthetic insert');
      const columns = match[1].split(',').map(s => s.trim().replace(/"/g, ''));
      if (columns[0] !== 'user_id') throw Error('Missing synthetic user ID');
      for (let i = 1; i < columns.length; i++) {
        if (!ids.has(columns[i])) throw Error('Unpublished opinion field');
        state.answers[columns[i]] = params[i];
      }
      state.hasRow = true;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('UPDATE opinioni_risposte')) {
      const match = sql.match(/\bSET\s+(.*?)\s+WHERE\s+user_id\b/i);
      if (!match || !state || params[params.length - 1] !== owner) throw Error('Unexpected synthetic update');
      const assignments = match[1].split(',');
      for (const assignment of assignments) {
        const found = assignment.trim().match(/^"?([a-z][a-z0-9_]*)"?\s*=\s*\$(\d+)$/i);
        if (!found || !ids.has(found[1])) throw Error('Unpublished opinion update');
        state.answers[found[1]] = params[Number(found[2]) - 1];
      }
      state.hasRow = true;
      return { rows: [], rowCount: 1 };
    }
    throw Error('Unsupported query in isolated QA server');
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const ownerFromToken = raw => {
    const received = Buffer.from(String(raw || ''));
    for (const [candidate, owner] of accounts) {
      const expected = Buffer.from('Bearer ' + candidate);
      if (received.length === expected.length && crypto.timingSafeEqual(received, expected)) return owner;
    }
    return null;
  };
  const authorized = req => !!ownerFromToken(req.headers.authorization);
  const base = path.resolve(__dirname, '..');
  const authPath = require.resolve(path.join(base, 'middleware/auth.js'));
  const jwtPath = require.resolve(path.join(base, 'utils/jwt.js'));
  const compatPath = require.resolve(path.join(base, 'routes/compatibility.js'));
  const managementPath = require.resolve(path.join(base, 'routes/opinioni/management.js'));
  const answersPath = require.resolve(path.join(base, 'routes/opinioni/user-answers.js'));
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true, exports: {
      pool,
      verifyToken: (req, res, next) => {
        if (!authorized(req)) return res.status(401).json({ success: false, error: 'Unauthorized synthetic QA' });
        const owner = ownerFromToken(req.headers.authorization);
        req.userId = owner;
        req.user = { id: owner, isPolitician: false, isCandidate: false };
        req.userRole = 'E';
        next();
      },
      requireAdmin: (req, res, next) => authorized(req) ? next() : res.sendStatus(401)
    }
  };
  require.cache[jwtPath] = {
    id: jwtPath, filename: jwtPath, loaded: true, exports: {
      verifyAccessToken: raw => {
        const owner = accounts.get(raw);
        if (!owner) throw Error('Invalid QA token');
        return { userId: owner };
      }
    }
  };
  for (const p of [compatPath, managementPath, answersPath]) delete require.cache[p];

  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', qa: true, mode: 'synthetic', catalogueCount: ids.size }));
  app.use((req, res, next) => {
    const owner = ownerFromToken(req.headers.authorization);
    if (!owner) return res.status(401).json({ success: false, error: 'QA credential required' });
    req.syntheticQaOwner = owner;
    next();
  });
  app.use(express.json({ limit: '12kb' }));
  // Minimal, explicitly synthetic identity/consent endpoints let a real
  // browser render the existing protected Opinions pages in local-only CI.
  // These routes exist ONLY in this isolated QA server; never in production.
  app.get('/api/auth/me', (req, res) => {
    const state = stateByUser.get(req.syntheticQaOwner);
    res.json({ success: true, user: { id: req.syntheticQaOwner, email: '', status: 'a', ruolo: 'E',
      political_consent: { granted: state.consent,
        timestamp: state.consent ? '2026-10-01T00:00:00Z' : null } } });
  });
  app.get('/api/user/political-opinions-consent', (req, res) => {
    const state = stateByUser.get(req.syntheticQaOwner);
    res.json({ success: true, consent: {
      granted: state.consent,
      timestamp: state.consent ? '2026-10-01T00:00:00Z' : null,
      ipAddress: null, userAgent: null
    } });
  });
  app.post('/qa/reset', (req, res) => {
    const state = stateByUser.get(req.syntheticQaOwner);
    state.consent = true;
    state.hasRow = false;
    state.answers = Object.create(null);
    res.json({ success: true });
  });
  app.post('/qa/revoke', (req, res) => {
    const state = stateByUser.get(req.syntheticQaOwner);
    // Deliberately preserve residual answers after revocation. The SQL
    // consent predicate (not fixture cleanup) must suppress readback.
    state.consent = false;
    res.json({ success: true });
  });
  app.use('/api', require(compatPath));
  app.use('/api/opinioni', require(managementPath));
  app.use('/api/opinioni', require(answersPath));
  app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));
  return app;
}

if (require.main === module) {
  const app = createQaApp();
  const port = Number(process.env.PORT || 10000);
  app.listen(port, '0.0.0.0', () => console.log('Synthetic QA Opinions API is ready'));
}
module.exports = { createQaApp };
