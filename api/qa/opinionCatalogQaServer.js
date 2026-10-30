'use strict';
// Disposable QA server only. Never mount it into the production API.
const crypto = require('node:crypto');
const express = require('express');
const path = require('node:path');
const { getAllOpinions } = require('../services/opinionCatalog');

const USER_ID = 'qa-synthetic-opinions-user';
const ids = new Set(getAllOpinions().map(op => op.id));
const BLOCKED_DB_ENV = ['DATABASE_URL', 'POSTGRES_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'PGHOST', 'PGDATABASE'];

function createQaApp() {
  if (process.env.DEMOS_OPINIONS_QA_ONLY !== 'isolated-synthetic') {
    throw Error('QA-only flag missing: refusing startup');
  }
  const token = process.env.DEMOS_OPINIONS_QA_TOKEN || '';
  if (token.length < 48) throw Error('QA token missing or too short');
  for (const key of BLOCKED_DB_ENV) {
    if (process.env[key]) throw Error('Database environment is forbidden in synthetic QA: ' + key);
  }

  const state = { consent: true, answers: Object.create(null), hasRow: false };
  const normalize = sql => String(sql).replace(/\s+/g, ' ').trim();
  const validUser = params => params[0] === USER_ID;
  const query = async (statement, params = []) => {
    const sql = normalize(statement);
    if (/\bopinioni_domande\b/i.test(sql)) throw Error('Legacy catalog SQL is forbidden');
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK')
      return { rows: [], rowCount: 0 };
    if (sql.includes('FROM users u LEFT JOIN LATERAL') && sql.includes('FROM opinioni_risposte a WHERE a.user_id = u.id')) {
      if (sql.includes('fonti_opinioni') || sql.includes('SELECT *')) throw Error('QA GET must project only published answer columns');
      return { rows: validUser(params) ? [{
        id: USER_ID, status: 'a', ruolo: 'E',
        opinion_answers: state.hasRow ? { ...state.answers } : null
      }] : [] };
    }
    if (sql === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
      return { rows: validUser(params) ? [{ id: USER_ID }] : [], rowCount: validUser(params) ? 1 : 0 };
    }
    if (sql.includes('AS granted') && sql.includes('user_consents')) {
      return { rows: validUser(params) ? [{ granted: state.consent }] : [], rowCount: 1 };
    }
    if (sql.includes('information_schema.columns')) throw Error('No schema lookup in QA save');
    if (sql.includes('FROM opinioni_risposte') && sql.includes('FOR UPDATE')) {
      return { rows: state.hasRow && validUser(params) ? [{ user_id: USER_ID, ...state.answers }] : [], rowCount: state.hasRow ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO opinioni_risposte')) {
      const match = sql.match(/INSERT INTO opinioni_risposte\s*\(([^)]+)\)/i);
      if (!match || params[0] !== USER_ID) throw Error('Unexpected synthetic insert');
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
      if (!match || params[params.length - 1] !== USER_ID) throw Error('Unexpected synthetic update');
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
  const expected = Buffer.from('Bearer ' + token);
  const authorized = req => {
    const received = Buffer.from(String(req.headers.authorization || ''));
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  };
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
        req.userId = USER_ID;
        req.user = { id: USER_ID, isPolitician: false, isCandidate: false };
        req.userRole = 'E';
        next();
      },
      requireAdmin: (req, res, next) => authorized(req) ? next() : res.sendStatus(401)
    }
  };
  require.cache[jwtPath] = {
    id: jwtPath, filename: jwtPath, loaded: true, exports: {
      verifyAccessToken: raw => {
        if (raw !== token) throw Error('Invalid QA token');
        return { userId: USER_ID };
      }
    }
  };
  for (const p of [compatPath, managementPath, answersPath]) delete require.cache[p];

  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', qa: true, mode: 'synthetic', catalogueCount: ids.size }));
  app.use((req, res, next) => {
    if (!authorized(req)) return res.status(401).json({ success: false, error: 'QA credential required' });
    next();
  });
  app.use(express.json({ limit: '12kb' }));
  // Minimal, explicitly synthetic identity/consent endpoints let a real
  // browser render the existing protected Opinions pages in local-only CI.
  // These routes exist ONLY in this isolated QA server; never in production.
  app.get('/api/auth/me', (_req, res) => res.json({
    success: true, user: { id: USER_ID, email: '', status: 'a', ruolo: 'E',
      political_consent: { granted: state.consent,
        timestamp: state.consent ? '2026-10-01T00:00:00Z' : null } }
  }));
  app.get('/api/user/political-opinions-consent', (_req, res) => res.json({
    success: true, consent: {
      granted: state.consent,
      timestamp: state.consent ? '2026-10-01T00:00:00Z' : null,
      ipAddress: null, userAgent: null
    }
  }));
  app.post('/qa/reset', (_req, res) => {
    state.consent = true;
    state.hasRow = false;
    state.answers = Object.create(null);
    res.json({ success: true });
  });
  app.post('/qa/revoke', (_req, res) => {
    state.consent = false;
    state.hasRow = false;
    state.answers = Object.create(null);
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
