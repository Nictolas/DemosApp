'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const ROOT = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const routeSource = read('api/routes/voti-parlamento-europeo.js');
const clientSource = read('client/src/pages/VotiParlamentoEuropeo.tsx');
const serviceSource = read('api/services/leggeAnalysisService.js');

test('Groq Free QA does not restore historical nominal MEP import or modify voting records', () => {
  assert.match(routeSource, /DEMOS_GROQ_FREE_QA_ENABLED !== 'true'/);
  assert.match(routeSource, /router\.post\('\/rigenera-analisi\/:uri', verifyToken, requireAdmin/);
  assert.match(routeSource, /readEuropeanAggregateByUri\(uri\)/);
  assert.match(routeSource, /hasDocumentaryContext\(votazione\.descrizione\)/);
  assert.match(routeSource, /const votiNominaliMEPItaliani = null/);
  assert.doesNotMatch(routeSource, /getVotiNominaliMEPItaliani|sincronizzaVotazioniPE|INSERT INTO mep_voti_nominali/i);
  assert.match(routeSource, /Sincronizzazione storica disabilitata/);
  assert.match(serviceSource, /requestFreeGroq\(aiClient/);
  assert.doesNotMatch(serviceSource, /new OpenAI\(|OPENAI_API_KEY/);
  assert.match(read('api/env.example'), /DEMOS_GROQ_FREE_QA_ENABLED=false/);
});

test('European explanation button is admin-only and contains no political groups', () => {
  assert.match(clientSource, /const isAdmin = hasAdminCapability\(user\)/);
  assert.match(clientSource, /if \(!isAdmin \|\| !votazioneSelezionata\?\.uri\) return;/);
  assert.match(clientSource, /isAdmin && \(/);
  assert.match(clientSource, /Genera spiegazione \(QA Groq Free\)/);
  assert.match(clientSource, /await refetchDettagli\(\)/);
  assert.doesNotMatch(clientSource, /mep\.gruppo_politico/);
});

const sqlCalls = [];
let generated = 0;
let sampleRecord = null;
const db = {
  async query(sql, params) {
    sqlCalls.push({ sql, params });
    assert.match(sql, /FROM parlamento_europeo/);
    assert.doesNotMatch(sql, /(?:INSERT|UPDATE|DELETE)\s/i);
    return { rows: sampleRecord && params[0] === sampleRecord.uri ? [sampleRecord] : [] };
  }
};
const inject = (filename, exports) => {
  const file = require.resolve(filename);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
inject('../middleware/auth', {
  verifyToken: (req, _res, next) => { req.user = { isAdmin: req.headers['x-qa-admin'] === 'yes' }; next(); },
  requireAdmin: (req, res, next) => req.user.isAdmin ? next() : res.sendStatus(403)
});
inject('../config/database', { getPool: () => db });
inject('../services/leggeAnalysisService', {
  recuperaAnalisiDaCache: async () => null,
  generaAnalisiLegge: async () => {
    generated++;
    return { spiegazione_generale: 'Descrizione fondata sul documento', effetti_positivi: [], effetti_negativi: [], provider_ai: 'groq', modello_ai: 'openai/gpt-oss-120b' };
  }
});
const router = require('../routes/voti-parlamento-europeo');

test('QA HTTP: disabled by default, admin gated, verified document only, no nominal writes', async (t) => {
  const app = express();
  app.use('/api/voti-parlamento-europeo', router);
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const previous = process.env.DEMOS_GROQ_FREE_QA_ENABLED;
  t.after(() => {
    if (previous === undefined) delete process.env.DEMOS_GROQ_FREE_QA_ENABLED;
    else process.env.DEMOS_GROQ_FREE_QA_ENABLED = previous;
  });
  const url = 'http://127.0.0.1:' + server.address().port +
    '/api/voti-parlamento-europeo/rigenera-analisi/test-vote';
  const post = (admin = true) => fetch(url, {
    method: 'POST', headers: { 'x-qa-admin': admin ? 'yes' : 'no' }
  });
  delete process.env.DEMOS_GROQ_FREE_QA_ENABLED;
  sqlCalls.length = 0;
  assert.equal((await post()).status, 409);
  assert.equal(sqlCalls.length, 0);

  process.env.DEMOS_GROQ_FREE_QA_ENABLED = 'true';
  assert.equal((await post(false)).status, 403);
  assert.equal(sqlCalls.length, 0);

  assert.equal((await post()).status, 404);
  assert.equal(generated, 0);

  sampleRecord = { uri: 'test-vote', titolo: 'Titolo neutro', descrizione: 'Breve', data_votazione: '2026-11-09' };
  assert.equal((await post()).status, 503);
  assert.equal(generated, 0);

  sampleRecord.descrizione = 'Documento istituzionale completo che illustra le disposizioni votate, il campo di applicazione e le modifiche testuali. '.repeat(5);
  const success = await post();
  assert.equal(success.status, 200);
  const body = await success.json();
  assert.equal(body.success, true);
  assert.equal(body.data.provider_ai, 'groq');
  assert.equal(generated, 1);
  assert.ok(sqlCalls.length > 0);
  assert.ok(sqlCalls.every(call => call.params[0] === 'test-vote'));
});
