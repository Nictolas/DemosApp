'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { resolvePoliticalOffice } = require('../services/politicalJurisdictionRegistryService');
const { isPoliticalOfficeVisible } = require('../services/politicalSelectionService');

const authPath = require.resolve('../middleware/auth');
const civicIdentityPath = require.resolve('../middleware/civicIdentity');

async function withIsolatedRoutes(run) {
  const priorAuth = require.cache[authPath];
  const priorCivic = require.cache[civicIdentityPath];
  const routeNames = ['rappresentanti', 'candidati', 'elezioni'];
  const routePaths = routeNames.map((name) => require.resolve(path.join(__dirname, '..', 'routes', name + '.js')));
  const priorRoutes = routePaths.map((routePath) => require.cache[routePath]);
  let queries = 0;
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      pool: { async query() { queries++; throw new Error('No SQL is allowed before release GO'); } },
      verifyToken(req, _res, next) { req.userId = 'synthetic'; req.user = { id: 'synthetic' }; next(); },
      requireAdmin(_req, _res, next) { next(); },
    },
  };
  require.cache[civicIdentityPath] = {
    id: civicIdentityPath, filename: civicIdentityPath, loaded: true,
    exports: { requireVerifiedCivicIdentity(_req, _res, next) { next(); } },
  };
  const app = express();
  for (let i = 0; i < routeNames.length; i++) {
    delete require.cache[routePaths[i]];
    app.use('/api/' + routeNames[i], require(routePaths[i]));
  }
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run('http://127.0.0.1:' + server.address().port, () => queries); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    routePaths.forEach((routePath, i) => {
      if (priorRoutes[i]) require.cache[routePath] = priorRoutes[i];
      else delete require.cache[routePath];
    });
    if (priorAuth) require.cache[authPath] = priorAuth;
    else delete require.cache[authPath];
    if (priorCivic) require.cache[civicIdentityPath] = priorCivic;
    else delete require.cache[civicIdentityPath];
  }
}

test('provincial read endpoints deny discovery until explicit GO without querying the DB', async () => {
  const prev = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  try {
    await withIsolatedRoutes(async (base, queries) => {
      const routes = [
        '/api/rappresentanti/disponibili?grado_elezione=it.provincial.trento',
        '/api/rappresentanti/disponibili?grado_elezione=CONSIGLIO_PROVINCIALE_BOLZANO',
        '/api/candidati/disponibili?grado_candidatura=it.provincial.bolzano',
        '/api/candidati/disponibili?grado_candidatura=CONSIGLIO_PROVINCIALE_TRENTO',
        '/api/elezioni/disponibili?grado=it.provincial.trento',
        '/api/elezioni/elezioni-utente/disponibili?grado=it.provincial.bolzano',
      ];
      for (const route of routes) {
        const response = await fetch(base + route);
        assert.equal(response.status, 409, route);
        assert.equal((await response.json()).error, 'PROVINCIAL_SELECTION_NOT_RELEASED', route);
      }
      assert.equal(queries(), 0);
    });
  } finally {
    if (prev === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prev;
  }
});

test('only explicit GO can expose autonomous councils, not an ordinary province', () => {
  const prev = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  try {
    delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    assert.equal(isPoliticalOfficeVisible(resolvePoliticalOffice('it.provincial.trento')), false);
    assert.equal(isPoliticalOfficeVisible(resolvePoliticalOffice('it.provincial.bolzano')), false);
    assert.equal(isPoliticalOfficeVisible(resolvePoliticalOffice('it.municipal')), true);
    process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
    assert.equal(isPoliticalOfficeVisible(resolvePoliticalOffice('it.provincial.trento')), true);
    assert.equal(isPoliticalOfficeVisible(resolvePoliticalOffice('it.provincial.bolzano')), true);
    assert.equal(resolvePoliticalOffice('PROVINCIALE'), null);
  } finally {
    if (prev === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prev;
  }
});
