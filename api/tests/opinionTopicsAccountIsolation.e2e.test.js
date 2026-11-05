'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const origin = 'http://localhost:3000';
const browserModule = process.env.DEMOS_PLAYWRIGHT_MODULE;

async function waitLocal(url) {
  for (let i = 0; i < 120; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error('Local synthetic QA server not reachable');
}
function syntheticToken(userId) {
  return 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({
    userId, role: 'E', status: 'a',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url') + '.synthetic-not-a-real-signature';
}
test('Chrome: two synthetic accounts never inherit another owner\'s political answers, progress or revoked consent', {
  skip: !browserModule, timeout: 150000
}, async () => {
  for (const key of ['DATABASE_URL','POSTGRES_URL','SUPABASE_DB_URL','SUPABASE_URL','PGHOST','PGDATABASE']) {
    assert.equal(process.env[key], undefined, 'Real database environment forbidden in browser QA');
  }
  const tokenA = syntheticToken('qa-synthetic-opinions-user');
  const tokenB = syntheticToken('qa-synthetic-opinions-user-b');
  const previous = {
    mode: process.env.DEMOS_OPINIONS_QA_ONLY,
    token: process.env.DEMOS_OPINIONS_QA_TOKEN,
    second: process.env.DEMOS_OPINIONS_QA_TOKEN_B,
  };
  process.env.DEMOS_OPINIONS_QA_ONLY = 'isolated-synthetic';
  process.env.DEMOS_OPINIONS_QA_TOKEN = tokenA;
  process.env.DEMOS_OPINIONS_QA_TOKEN_B = tokenB;
  let server, vite, browser, context;
  try {
    const { createQaApp } = require('../qa/opinionCatalogQaServer');
    const { chromium } = require(browserModule);
    server = http.createServer(createQaApp());
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(10000, resolve);
    });
    vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', 'localhost', '--port', '3000', '--strictPort'], {
      cwd: path.join(repo, 'client'),
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: 'ignore'
    });
    await waitLocal(origin + '/');
    await waitLocal('http://localhost:10000/healthz');
    browser = await chromium.launch({
      channel: 'chrome', headless: true, args: ['--no-sandbox','--disable-dev-shm-usage']
    });
    context = await browser.newContext({ viewport: { width: 390, height: 844 },
      serviceWorkers: 'block', permissions: [] });
    await context.addInitScript(token => {
      if (!localStorage.getItem('auth_token')) localStorage.setItem('auth_token', token);
    }, tokenA);
    const page = await context.newPage();
    const external = [];
    const personalGets = { A: 0, B: 0 };
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.protocol === 'http:' && url.hostname === 'localhost' && url.port === '3000') {
        return route.continue();
      }
      external.push(url.origin);
      return route.abort('blockedbyclient');
    });
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname !== '/api/opinioni-list' || request.method() !== 'GET') return;
      const header = request.headers().authorization;
      if (header === 'Bearer ' + tokenA) personalGets.A++;
      if (header === 'Bearer ' + tokenB) personalGets.B++;
    });
    const cards = page.locator('.opinioni-editor-page main section');
    const goToTopic = async () => {
      await page.goto(origin + '/opinioni-argomento/economia_lavoro_fisco', { waitUntil: 'domcontentloaded' });
      await cards.first().waitFor({ timeout: 25000 });
      assert.equal(await cards.count(), 14);
    };
    const switchAccount = async (token) => {
      await page.evaluate(value => {
        localStorage.setItem('auth_token', value);
        localStorage.setItem('token', value);
        localStorage.setItem('authToken', value);
      }, token);
      await goToTopic();
    };

    await goToTopic();
    assert.equal(await page.getByText('0 / 14 Opinioni salvate').count(), 1);
    const firstText = await cards.first().locator('h2').innerText();
    await cards.first().getByRole('button', { name: 'Favorevole' }).click();
    await page.getByRole('button', { name: 'Salva le mie opinioni' }).click();
    await page.waitForURL(origin + '/opinioni', { timeout: 20000 });
    await goToTopic();
    await page.getByText('1 / 14 Opinioni salvate').waitFor({ timeout: 25000 });
    assert.equal(personalGets.A, 4, 'Account A should use four existing cold GETs once');

    await switchAccount(tokenB);
    await page.getByText('0 / 14 Opinioni salvate').waitFor({ timeout: 25000 });
    assert.equal(await cards.locator('button[aria-pressed="true"]').count(), 0,
      'Account B must not inherit any answer from account A');
    assert.equal(personalGets.B, 4, 'Account B must make its own authorized cold GETs');
    await cards.nth(0).getByRole('button', { name: 'Contrario' }).click();
    await cards.nth(1).getByRole('button', { name: 'Indeciso' }).click();
    await page.getByRole('button', { name: 'Salva le mie opinioni' }).click();
    await page.waitForURL(origin + '/opinioni', { timeout: 20000 });
    await goToTopic();
    await page.getByText('2 / 14 Opinioni salvate').waitFor({ timeout: 25000 });

    await switchAccount(tokenA);
    await page.getByText('1 / 14 Opinioni salvate').waitFor({ timeout: 25000 });
    const original = cards.filter({ has: page.getByRole('heading', { name: firstText, exact: true }) });
    assert.equal(await original.getByRole('button', { name: 'Favorevole' }).getAttribute('aria-pressed'), 'true');
    assert.equal(personalGets.A, 4, 'Returning account A should safely reuse its own valid vault');

    const revokeB = await fetch('http://localhost:10000/qa/revoke', {
      method: 'POST', headers: { authorization: 'Bearer ' + tokenB }
    });
    assert.equal(revokeB.status, 200);
    await switchAccount(tokenB);
    await page.getByText(/consenso esplicito al trattamento/).waitFor({ timeout: 25000 });
    assert.equal(await cards.count(), 0, 'Revoked account B must not see its former answers');
    await switchAccount(tokenA);
    await page.getByText('1 / 14 Opinioni salvate').waitFor({ timeout: 25000 });
    assert.deepEqual(external, [], 'Browser must never request any real remote origin');
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (vite) vite.kill();
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [key, previousValue] of [
      ['DEMOS_OPINIONS_QA_ONLY', previous.mode],
      ['DEMOS_OPINIONS_QA_TOKEN', previous.token],
      ['DEMOS_OPINIONS_QA_TOKEN_B', previous.second],
    ]) {
      if (previousValue === undefined) delete process.env[key];
      else process.env[key] = previousValue;
    }
  }
});
