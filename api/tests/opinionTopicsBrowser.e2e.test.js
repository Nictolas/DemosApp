'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const origin = 'http://localhost:3000';
const qaPort = 10000;
const requiredModule = process.env.DEMOS_PLAYWRIGHT_MODULE;

async function waitLocal(url) {
  for (let n = 0; n < 120; n++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error('Local QA server not reachable');
}

test('Chrome: topic menu, 94-ID partition, draft, ACK, consent and mobile layout', {
  skip: !requiredModule,
  timeout: 150000
}, async () => {
  for (const env of ['DATABASE_URL','POSTGRES_URL','SUPABASE_DB_URL','SUPABASE_URL','PGHOST','PGDATABASE']) {
    assert.equal(process.env[env], undefined, 'Synthetic QA forbids database environment');
  }
  const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({
    userId: 'qa-synthetic-opinions-user', role: 'E', status: 'a',
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url') + '.synthetic-no-secret';
  const original = {
    mode: process.env.DEMOS_OPINIONS_QA_ONLY,
    token: process.env.DEMOS_OPINIONS_QA_TOKEN
  };
  process.env.DEMOS_OPINIONS_QA_ONLY = 'isolated-synthetic';
  process.env.DEMOS_OPINIONS_QA_TOKEN = token;
  let server, vite, browser, context;
  try {
    const { createQaApp } = require('../qa/opinionCatalogQaServer');
    const { chromium } = require(requiredModule);
    server = http.createServer(createQaApp());
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(qaPort, resolve);
    });
    vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', 'localhost', '--port', '3000', '--strictPort'], {
      cwd: path.join(repo, 'client'), env: { ...process.env, NODE_ENV: 'development' }, stdio: 'ignore'
    });
    await waitLocal(origin + '/');
    await waitLocal('http://localhost:10000/healthz');
    browser = await chromium.launch({ channel: 'chrome', headless: true,
      args: ['--no-sandbox','--disable-dev-shm-usage'] });
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: 'block', permissions: []
    });
    await context.addInitScript((value) => localStorage.setItem('auth_token', value), token);
    const page = await context.newPage();
    const external = [];
    const personalGets = [];
    const savedPosts = [];
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === 'http:' && url.hostname === 'localhost' && url.port === '3000') return route.continue();
      external.push(url.origin);
      return route.abort('blockedbyclient');
    });
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/opinioni-list' && request.method() === 'GET') personalGets.push(url.search);
      if (url.pathname === '/api/opinioni/salva' && request.method() === 'POST') savedPosts.push(1);
    });
    await page.goto(origin + '/opinioni', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Per argomento' }).waitFor({ timeout: 25000 });
    assert.equal(await page.locator('.opinioni-button').count(), 4, 'Four geographic cards must remain');
    await page.getByRole('button', { name: 'Per argomento' }).click();
    assert.equal(await page.locator('[aria-label="Categorie tematiche"] button').count(), 11);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const fits = await page.locator('[aria-label="Categorie tematiche"]').evaluate(el =>
        el.scrollWidth <= el.clientWidth + 2);
      assert.equal(fits, true, 'Topic cards should not overflow horizontally at ' + width);
    }
    await page.getByRole('button', { name: /Economia, lavoro e fisco/ }).click();
    await page.getByRole('heading', { name: 'Economia, lavoro e fisco' }).waitFor({ timeout: 25000 });
    const cards = page.locator('.opinioni-editor-page main section');
    await cards.first().waitFor({ timeout: 25000 });
    assert.equal(await cards.count(), 14);
    assert.equal(personalGets.length, 4, 'Cold topic entry uses the four existing grade reads only');
    for (const [width, height] of [[320, 568], [390, 844], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      const geometry = await page.locator('.opinioni-editor-page').evaluate(el => {
        const main = el.querySelector('main');
        const footer = el.querySelector('footer');
        return {
          viewport: window.innerWidth,
          scrollWidth: el.scrollWidth,
          contentWidth: el.clientWidth,
          listScroll: main.scrollHeight > main.clientHeight,
          footerBottom: footer.getBoundingClientRect().bottom,
          viewportHeight: window.innerHeight
        };
      });
      assert.ok(geometry.scrollWidth <= geometry.contentWidth + 2,
        'Editor horizontal overflow at ' + width);
      assert.ok(geometry.listScroll, 'Editor question list must scroll at ' + width);
      assert.ok(geometry.footerBottom <= geometry.viewportHeight + 2,
        'Footer must remain visible at ' + width);
    }
    await page.getByRole('button', { name: 'Salva le mie opinioni' }).focus();
    assert.equal(await page.getByRole('button', { name: 'Salva le mie opinioni' }).evaluate(el => document.activeElement === el), true);

    assert.equal(await page.getByText('0 / 14 Opinioni salvate').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Salva le mie opinioni' }).isDisabled(), true);
    await cards.first().getByRole('button', { name: 'Favorevole' }).click();
    assert.equal(await page.getByText('0 / 14 Opinioni salvate').count(), 1,
      'Unsaved answer must not increase completion');
    await page.getByRole('button', { name: 'Indietro' }).click();
    await page.getByText('Opinioni non salvate').waitFor();
    await page.getByRole('button', { name: 'Annulla' }).click();
    assert.match(page.url(), /opinioni-argomento/);
    await page.getByRole('button', { name: 'Salva le mie opinioni' }).click();
    await page.waitForURL(origin + '/opinioni', { timeout: 20000 });
    assert.equal(savedPosts.length, 1, 'Exactly one delta save should be issued');
    await page.getByRole('button', { name: 'Per argomento' }).click();
    await page.getByText(/1 \/ 13 · 8%/).first().waitFor({ timeout: 12000 });
    const before = personalGets.length;
    await page.getByRole('button', { name: /Economia, lavoro e fisco/ }).click();
    await page.getByText('1 / 14 Opinioni salvate').waitFor({ timeout: 25000 });
    assert.equal(personalGets.length, before, 'Warm cache should avoid personal GETs');

    // Deliberate failure: a rejected POST must not change committed completion.
    const unanswered = page.locator('.opinioni-editor-page main section.bg-blue-50').first();
    await unanswered.getByRole('button', { name: 'Contrario' }).click();
    await page.route('**/api/opinioni/salva', route => route.fulfill({
      status: 503, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Synthetic failure' })
    }));
    await page.getByRole('button', { name: 'Salva le mie opinioni' }).click();
    await page.getByText(/Salvataggio non confermato/).waitFor({ timeout: 12000 });
    assert.equal(await page.getByText('1 / 14 Opinioni salvate').count(), 1);
    await page.unroute('**/api/opinioni/salva');

    const revoked = await fetch('http://localhost:10000/qa/revoke', {
      method: 'POST', headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(revoked.status, 200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText(/consenso esplicito al trattamento/).waitFor({ timeout: 25000 });
    assert.equal(await cards.count(), 0, 'Revoked account must not see personal answers');
    assert.deepEqual(external, [], 'No request is allowed outside synthetic localhost');
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (vite) vite.kill();
    if (server) await new Promise(resolve => server.close(resolve));
    if (original.mode === undefined) delete process.env.DEMOS_OPINIONS_QA_ONLY;
    else process.env.DEMOS_OPINIONS_QA_ONLY = original.mode;
    if (original.token === undefined) delete process.env.DEMOS_OPINIONS_QA_TOKEN;
    else process.env.DEMOS_OPINIONS_QA_TOKEN = original.token;
  }
});
