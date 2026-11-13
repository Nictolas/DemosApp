'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routeSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'voti-parlamento-europeo.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'VotiParlamentoEuropeo.tsx'), 'utf8');

function createApp() {
  const get = new Map(), post = new Map();
  let syncCalls = 0, aiCalls = 0, detailCalls = 0, listCalls = 0;
  const verifyToken = () => {}, requireAdmin = () => {};
  const router = {
    get(route, ...handlers) { get.set(route, handlers); },
    post(route, ...handlers) { post.set(route, handlers); }
  };
  const fakeRequire = name => {
    switch (name) {
      case 'express': return { Router: () => router };
      case '../middleware/auth': return { verifyToken, requireAdmin };
      case '../services/parlamentoEuropeoService': return {
        getUltimeVotazioni: async () => { listCalls++; return []; },
        getDettagliVotazione: async () => {
          detailCalls++;
          return {
            uri: 'urn:test-final', titolo: 'Votazione finale UE', descrizione: 'Testo pubblico',
            data_votazione: new Date().toISOString(), id: 1, votazione_id: 'v1'
          };
        },
        sincronizzaVotazioniPE: async () => { syncCalls++; return { salvate: 1, errori: 0 }; },
        getVotiNominaliMEPItaliani: async () => ({ disponibili: true, favorevoli: [], contrari: [], astenuti: [], assenti: [] })
      };
      case '../services/leggeAnalysisService': return {
        generaAnalisiLegge: async () => {
          aiCalls++;
          return { spiegazione_generale: 'Sintesi verificata', effetti_positivi: 'Nessuno', effetti_negativi: 'Nessuno' };
        },
        recuperaAnalisiDaCache: async () => null
      };
      default: throw new Error('Unexpected dependency ' + name);
    }
  };
  const mod = { exports: {} };
  vm.runInNewContext(routeSource, {
    require: fakeRequire, module: mod, exports: mod.exports, console: {log(){},warn(){},error(){}},
    Date, Promise, parseInt, decodeURIComponent, setTimeout: () => 1
  });
  function makeRes() {
    return {
      statusCode: 200, body: null,
      status(code) {this.statusCode=code; return this;},
      json(data) {this.body=data; return this;}
    };
  }
  return { get, post, verifyToken, requireAdmin, makeRes,
    counts: () => ({syncCalls, aiCalls, detailCalls, listCalls}) };
}

test('European Parliament mutating API paths require canonical Admin middleware', () => {
  const app = createApp();
  for (const route of ['/rigenera-analisi/:uri','/sincronizza','/aggiorna-titoli']) {
    const handlers = app.post.get(route);
    assert.equal(handlers?.[0], app.verifyToken, route);
    assert.equal(handlers?.[1], app.requireAdmin, route);
    assert.equal(typeof handlers?.[2], 'function', route);
  }
});

test('ordinary user cannot request a refresh that launches synchronization', async () => {
  const app=createApp();
  const handler=app.get.get('/ultime')?.at(-1);
  assert.equal(typeof handler,'function');
  const blocked=app.makeRes();
  await handler({query:{refresh:'true'},user:{isAdmin:false}},blocked);
  assert.equal(blocked.statusCode,403);
  assert.equal(app.counts().syncCalls,0);
  assert.equal(app.counts().listCalls,0, '403 must occur before any parliamentary SQL read');
  const normal=app.makeRes();
  await handler({query:{limit:'1'},user:{isAdmin:false}},normal);
  assert.equal(normal.statusCode,200);
  assert.equal(normal.body.success,true);
  assert.equal(app.counts().syncCalls,0);
  assert.equal(app.counts().listCalls,1);
  const approved=app.makeRes();
  await handler({query:{refresh:'true'},user:{isAdmin:true}},approved);
  assert.equal(approved.statusCode,200);
  assert.equal(app.counts().syncCalls,1, 'Admin can still request refresh');
  assert.equal(app.counts().listCalls,3, 'Admin reads before and after refresh');
});

test('reading voting details never launches AI for an ordinary user', async () => {
  const app=createApp();
  const handler=app.get.get('/dettagli/:uri')?.at(-1);
  assert.equal(typeof handler,'function');
  const ordinary=app.makeRes();
  await handler({params:{uri:'urn%3Atest-final'},user:{isAdmin:false}},ordinary);
  assert.equal(ordinary.statusCode,200);
  assert.equal(ordinary.body.success,true);
  assert.equal(ordinary.body.data.analisi_legge,null);
  assert.equal(app.counts().aiCalls,0);
  const admin=app.makeRes();
  await handler({params:{uri:'urn%3Atest-final'},user:{isAdmin:true}},admin);
  assert.equal(admin.statusCode,200);
  assert.equal(app.counts().aiCalls,1);
});

test('European UI hides the regeneration button without Admin capability', () => {
  assert.match(uiSource, /import \{ useAuth \} from "@\/hooks\/use-auth"/);
  assert.match(uiSource, /import \{ hasAdminCapability \} from "@\/lib\/admin-access"/);
  assert.match(uiSource, /const isAdmin = hasAdminCapability\(user\)/);
  assert.match(uiSource, /if \(!isAdmin \|\| !votazioneSelezionata\?\.uri\) return/);
  assert.match(uiSource, /\{isAdmin && \(\s*<Button[\s\S]{0,180}onClick=\{handleRigeneraAnalisi\}/);
});

test('European AI endpoints do not return or log provider stacks or raw errors', () => {
  assert.doesNotMatch(routeSource, /details:\s*\w+\.stack/);
  assert.doesNotMatch(routeSource, /\b(?:error|dbError|syncError|analisiError|analisiTimeoutError|votiError)\.(?:stack|message)\b/);
  assert.doesNotMatch(routeSource, /error:\s*error\.message/);
  assert.match(routeSource, /error: 'Errore interno'/);
});


test('European Parliament vote identifiers and titles are not printed in API logs', () => {
  const logLines = routeSource.split('\n').filter(line => /console\.(?:log|warn|error)\(/.test(line));
  const logs = logLines.join('\n');
  assert.doesNotMatch(logs, /console\.(?:log|warn|error)\([^\n]*(?:decodedUri|votazione\.uri|nuovoTitolo)/);
  assert.match(logs, /Richiesta dettagli votazione PE/);
  assert.match(logs, /Titolo votazione PE aggiornato/);
});
