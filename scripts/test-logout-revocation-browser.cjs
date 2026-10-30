'use strict';
// Full compiled-browser smoke with synthetic accounts and intercepted APIs only.
// Never sends credentials to production, never mutates remote accounts.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ORIGIN = 'http://localhost:4173';
const A = '00000000-0000-4000-8000-000000000101';
const B = '00000000-0000-4000-8000-000000000202';
const makeToken = id => [
  'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({ userId: id, role: 'AD', exp: 4102444800 })).toString('base64url'),
  'synthetic-test-only'
].join('.');

async function scenario(browser, mode) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  });
  const tokenA = makeToken(A);
  const tokenB = makeToken(B);
  const seenAuthIds = [];
  const logoutRequests = [];
  const errors = [];
  await context.addInitScript(token => {
    // Seed only on the first document, not on the post-logout redirect.
    if (sessionStorage.getItem('__demos_test_seeded') === 'yes') return;
    sessionStorage.setItem('__demos_test_seeded', 'yes');
    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', 'synthetic-refresh-A');
  }, tokenA);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  const json = (route, status, body) => route.fulfill({
    status, contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });

  await page.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    // Fail-closed: external API and tracking traffic is never reachable.
    if (!url.pathname.startsWith('/api/')) {
      return url.origin === ORIGIN ? route.continue() : route.abort();
    }
    if (url.pathname === '/api/auth/me') {
      const auth = request.headers()['authorization'] || '';
      const id = auth.includes(tokenB) ? B : auth.includes(tokenA) ? A : 'unknown';
      seenAuthIds.push(id);
      if (id === 'unknown') return json(route, 401, { success: false });
      return json(route, 200, { success: true, user: {
        id, role: 'AD', ruolo: 'AD', status: 'A', is_admin: true,
        political_consent: { granted: true, timestamp: '2026-10-30T00:00:00Z' },
      } });
    }
    if (url.pathname === '/api/auth/logout') {
      logoutRequests.push({
        authorization: request.headers()['authorization'] || '',
        body: request.postDataJSON(),
      });
      if (mode === 'offline') return route.abort('failed');
      if (mode === 'unavailable') return json(route, 503, { success: false });
      if (mode === 'server-error') return json(route, 500, { success: false });
      return json(route, 200, { success: true });
    }
    return json(route, 200, { success: true, data: {} });
  });
  try {
    await page.goto(ORIGIN + '/impostazioni', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Logout/i }).waitFor({ timeout: 30000 });
    assert.ok(seenAuthIds.includes(A), 'Initial account A was not authenticated');
    await page.getByRole('button', { name: /Logout/i }).click();
    await page.getByRole('button', { name: 'Conferma' }).click();
    await page.waitForURL(url => url.pathname === '/', { timeout: 30000 });

    assert.equal(logoutRequests.length, 1, 'The browser must request one server logout');
    assert.equal(logoutRequests[0].authorization, 'Bearer ' + tokenA);
    assert.equal(logoutRequests[0].body.refreshToken, 'synthetic-refresh-A');
    const state = await page.evaluate(() => ({
      tokens: ['auth_token', 'token', 'authToken', 'refresh_token'].map(k => localStorage.getItem(k)),
      warning: sessionStorage.getItem('demos_logout_revocation_unconfirmed'),
    }));
    assert.ok(state.tokens.every(x => x == null), 'Logout left credentials in browser storage');
    if (mode === 'confirmed') {
      assert.equal(state.warning, null, 'Successful logout must not retain a warning');
      assert.equal(await page.getByText(/La revoca della sessione sul server non è confermata/).count(), 0);
    } else {
      await page.getByText(/La revoca della sessione sul server non è confermata/).first().waitFor({ timeout: 10000 });
      assert.equal(state.warning, null, 'Boolean warning must be consumed after redirect');
    }
    // Same browser can later open account B; A cannot be reintroduced from storage.
    await page.evaluate(next => {
      localStorage.setItem('auth_token', next);
      localStorage.setItem('refresh_token', 'synthetic-refresh-B');
    }, tokenB);
    await page.goto(ORIGIN + '/impostazioni', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Logout/i }).waitFor({ timeout: 30000 });
    assert.ok(seenAuthIds.includes(B), 'Browser did not authenticate B independently');
    assert.equal(await page.getByText(/La revoca della sessione sul server non è confermata/).count(), 0,
      'The old account warning leaked into B');
    assert.ok(errors.length === 0, 'Unexpected uncaught browser errors: ' + errors.join('; '));
    console.log('PASS real browser A -> logout -> B (' + mode + '): mock backend only');
  } catch (error) {
    await page.screenshot({ path: '/tmp/demos-logout-browser-' + mode + '.png', fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const mode of ['confirmed', 'unavailable', 'server-error', 'offline']) {
      await scenario(browser, mode);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
