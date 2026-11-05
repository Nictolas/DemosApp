'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { getAllOpinions, getOpinionsForGrade } = require('../services/opinionCatalog');

test('synthetic Render QA app uses actual candidate API and requires a nonproduction secret', async () => {
  const beforeToken = process.env.DEMOS_OPINIONS_QA_TOKEN;
  const beforeMode = process.env.DEMOS_OPINIONS_QA_ONLY;
  const beforeTokenB = process.env.DEMOS_OPINIONS_QA_TOKEN_B;
  process.env.DEMOS_OPINIONS_QA_ONLY = 'isolated-synthetic';
  process.env.DEMOS_OPINIONS_QA_TOKEN = 'ci-only-nonproduction-test-token-with-48-or-more-characters';
  process.env.DEMOS_OPINIONS_QA_TOKEN_B = 'ci-only-second-synthetic-token-with-48-or-more-characters';
  let server;
  try {
    const { createQaApp } = require('../qa/opinionCatalogQaServer');
    const app = createQaApp();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const root = 'http://127.0.0.1:' + server.address().port;
    const auth = { authorization: 'Bearer ' + process.env.DEMOS_OPINIONS_QA_TOKEN };
    const authB = { authorization: 'Bearer ' + process.env.DEMOS_OPINIONS_QA_TOKEN_B };
    assert.equal((await fetch(root + '/healthz')).status, 200);
    assert.equal((await fetch(root + '/api/opinioni-list?grado=N')).status, 401);
    assert.equal((await fetch(root + '/api/auth/me')).status, 401);
    assert.equal((await fetch(root + '/api/user/political-opinions-consent')).status, 401);
    const identity = await (await fetch(root + '/api/auth/me', { headers: auth })).json();
    assert.equal(identity.user.id, 'qa-synthetic-opinions-user');
    assert.equal(identity.user.email, '');
    const consentInfo = await (await fetch(root + '/api/user/political-opinions-consent', { headers: auth })).json();
    assert.equal(consentInfo.consent.granted, true);
    assert.equal((await fetch(root + '/api/opinioni', {headers: {authorization: 'Bearer invalid'}})).status, 401);
    const gradeData = {}; // Each GET uses one joined SQL request; no DB connection.
    for (const grade of ['N','R','CO','E']) {
      const response = await fetch(root + '/api/opinioni-list?grado=' + grade, {headers: auth});
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.total, getOpinionsForGrade(grade).length);
      gradeData[grade] = data;
    }
    const id = 'energia_nucleare';
    assert.ok(getAllOpinions().some(x => x.id === id));
    assert.equal(gradeData.N.data.find(x => x.id === id).userAnswer, null);
    const post = async answer => fetch(root + '/api/opinioni/salva', {
      method: 'POST',
      headers: {...auth, 'content-type': 'application/json'},
      body: JSON.stringify({opinioni: {[id]: answer}})
    });
    const first = await post('f');
    assert.equal(first.status, 200, JSON.stringify(await first.json()));
    let readback = await (await fetch(root + '/api/opinioni-list?grado=N', {headers:auth})).json();
    assert.equal(readback.data.find(x => x.id === id).userAnswer, 'f');
    const second = await post('c');
    assert.equal(second.status, 200);
    readback = await (await fetch(root + '/api/opinioni-list?grado=N', {headers:auth})).json();
    assert.equal(readback.data.find(x => x.id === id).userAnswer, 'c');

    // Second account must never read the first owner's answers, even when
    // both accounts use the same published catalogue and consent timestamp.
    const bInitial = await (await fetch(root + '/api/opinioni-list?grado=N', {headers:authB})).json();
    assert.equal(bInitial.data.find(x => x.id === id).userAnswer, null);
    const bIdentity = await (await fetch(root + '/api/auth/me', {headers:authB})).json();
    assert.equal(bIdentity.user.id, 'qa-synthetic-opinions-user-b');
    const bSaved = await fetch(root + '/api/opinioni/salva', {
      method: 'POST',
      headers: {...authB, 'content-type':'application/json'},
      body: JSON.stringify({opinioni: {[id]:'f'}})
    });
    assert.equal(bSaved.status, 200);
    const bBeforeRevocation = await (await fetch(root + '/api/opinioni-list?grado=N', {headers:authB})).json();
    assert.equal(bBeforeRevocation.data.find(x => x.id === id).userAnswer, 'f');
    readback = await (await fetch(root + '/api/opinioni-list?grado=N', {headers:auth})).json();
    assert.equal(readback.data.find(x => x.id === id).userAnswer, 'c');
    const metadata = await fetch(root + '/api/opinioni', {headers:auth});
    assert.equal(metadata.status, 200);
    assert.equal((await metadata.json()).data.length, 94);
    const revoke = await fetch(root + '/qa/revoke', {method:'POST',headers:auth});
    assert.equal(revoke.status, 200);
    const denied = await post('i');
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).consent_required, true);
    readback = await (await fetch(root + '/api/opinioni-list?grado=N', {headers:auth})).json();
    assert.equal(readback.data.find(x => x.id === id).userAnswer, null);
    // Revocation of A does not revoke B or destroy B's independent answer.
    const bAfterRevocation = await (await fetch(root + '/api/opinioni-list?grado=N', {headers:authB})).json();
    assert.equal(bAfterRevocation.data.find(x => x.id === id).userAnswer, 'f');
    const revokeB = await fetch(root + '/qa/revoke', {method:'POST',headers:authB});
    assert.equal(revokeB.status, 200);
    const bHidden = await (await fetch(root + '/api/opinioni-list?grado=N', {headers:authB})).json();
    assert.equal(bHidden.data.find(x => x.id === id).userAnswer, null);
    assert.equal((await fetch(root + '/api/opinioni-list?grado=N', {headers:{authorization:'Bearer incorrect'}})).status, 401);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (beforeToken === undefined) delete process.env.DEMOS_OPINIONS_QA_TOKEN;
    else process.env.DEMOS_OPINIONS_QA_TOKEN = beforeToken;
    if (beforeMode === undefined) delete process.env.DEMOS_OPINIONS_QA_ONLY;
    else process.env.DEMOS_OPINIONS_QA_ONLY = beforeMode;
    if (beforeTokenB === undefined) delete process.env.DEMOS_OPINIONS_QA_TOKEN_B;
    else process.env.DEMOS_OPINIONS_QA_TOKEN_B = beforeTokenB;
  }
});
