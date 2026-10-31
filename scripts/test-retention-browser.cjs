'use strict';

/**
 * Browser regression for the real compiled DEMOS Data Retention route.
 * All responses are synthetic. No production endpoints, accounts, providers or writes.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ORIGIN = 'http://localhost:4173';
const USER = '00000000-0000-4000-8000-000000009374';
const TOKEN = [
  'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({ userId: USER, role: 'AD', exp: 4102444800 })).toString('base64url'),
  'synthetic-retention-browser-only',
].join('.');

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const [width, height] of [[390, 844], [1280, 800]]) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 600,
        hasTouch: width < 600,
        serviceWorkers: 'block',
        reducedMotion: 'reduce',
      });
      await context.addInitScript(token => {
        localStorage.setItem('auth_token', token);
      }, TOKEN);
      const page = await context.newPage();
      const pageErrors = [];
      const calls = [];
      let running = false;
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.route('**/*', route => {
        const req = route.request();
        const url = new URL(req.url());
        if (!url.pathname.startsWith('/api/')) {
          return url.origin === ORIGIN ? route.continue() : route.abort();
        }
        calls.push(req.method() + ' ' + url.pathname);
        const respond = (status, body) => route.fulfill({
          status, contentType: 'application/json',
          headers: { 'cache-control': 'no-store' },
          body: JSON.stringify(body),
        });
        if (url.pathname === '/api/auth/me') {
          return respond(200, { success: true, user: {
            id: USER, role: 'AD', ruolo: 'AD', status: 'a',
            account_type: 'p', is_admin: true,
            capabilities: { isAdmin: true },
          } });
        }
        if (url.pathname === '/api/admin/data-retention/job/status' && req.method() === 'GET') {
          return respond(200, { success: true, data: { status: {
            isRunning: running,
            hasCleanupInterval: running,
            hasNotificationInterval: running,
          } } });
        }
        if (url.pathname === '/api/admin/data-retention/job/stop' && req.method() === 'POST') {
          running = false;
          return respond(200, { success: true, data: { status: {
            isRunning: false,
            hasCleanupInterval: false,
            hasNotificationInterval: false,
          } } });
        }
        if (req.method() === 'GET') return respond(200, { success: true, data: {} });
        return respond(403, { success: false, error: 'SYNTHETIC_WRITES_FORBIDDEN' });
      });

      await page.goto(ORIGIN + '/data-retention', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Data Retention' }).waitFor({ timeout: 30000 });
      await page.getByText('Politica di retention non approvata.').waitFor({ timeout: 15000 });
      await page.getByText('Non in esecuzione').waitFor({ timeout: 15000 });
      assert.equal(await page.getByRole('button', { name: 'Avvia', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Pulizia Immediata' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Ferma job' }).count(), 0);
      assert.equal(calls.filter(x => x === 'GET /api/admin/data-retention/job/status').length, 1);

      // A running job can be stopped, but must never be started or deleted from this UI.
      running = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Ferma job' }).waitFor({ timeout: 30000 });
      assert.equal(await page.getByRole('button', { name: 'Avvia', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Pulizia Immediata' }).count(), 0);
      await page.getByRole('button', { name: 'Ferma job' }).click();
      await page.getByText('Non in esecuzione').waitFor({ timeout: 15000 });
      assert.equal(calls.filter(x => x === 'POST /api/admin/data-retention/job/stop').length, 1,
        'stop request must be made exactly once');
      assert.equal(await page.getByRole('button', { name: 'Ferma job' }).count(), 0);
      assert.equal(calls.filter(x => x === 'GET /api/admin/data-retention/job/status').length, 3,
        'status only: initial, reload, after stop');
      assert.equal(calls.filter(x => x.startsWith('GET /api/admin/data-retention/')).length, 3,
        'legacy policy/statistics endpoints must never be loaded');
      assert.equal(calls.filter(x => x.startsWith('POST /api/admin/data-retention/')).length, 1,
        'only emergency stop is allowed');
      assert.deepEqual(pageErrors, [], 'browser JS errors: ' + pageErrors.join(' | '));
      console.log(JSON.stringify({ viewport: width + 'x' + height,
        result: 'PASS', retentionCalls: calls.filter(x => x.includes('data-retention')) }));
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
