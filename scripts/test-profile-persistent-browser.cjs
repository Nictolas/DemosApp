'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ORIGIN = 'http://localhost:4173';
const OWNER = '00000000-0000-4000-8000-000000000101';
const token = [
  'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({ userId: OWNER, role: 'AD', exp: 4102444800 })).toString('base64url'),
  'synthetic-token',
].join('.');

async function test() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    await context.addInitScript(value => localStorage.setItem('auth_token', value), token);
    const page = await context.newPage();
    const count = new Map();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const fulfill = (route, body) => route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'cache-control': 'private, no-store' },
      body: JSON.stringify(body),
    });
    await page.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.origin !== ORIGIN) return route.abort();
      if (!u.pathname.startsWith('/api/')) return route.continue();
      count.set(u.pathname, (count.get(u.pathname) || 0) + 1);
      switch (u.pathname) {
        case '/api/auth/me':
          return fulfill(route, { success: true, user: {
            id: OWNER, role: 'AD', ruolo: 'AD', status: 'A', is_admin: true,
          }});
        case '/api/users/me':
          return fulfill(route, { success: true, user: {
            id: OWNER, ruolo: 'AD', status: 'A', data_nascita: '24/10/1990',
            cittadinanza: 'Italiana', paese_residenza: 'Italia',
            regione_residenza: 'Toscana', provincia_residenza: 'Pisa',
            comune_residenza: 'Comune Inventato',
          }});
        case '/api/user/political-opinions-consent':
          return fulfill(route, { success: true, consent: {
            granted: true, timestamp: '2026-10-29T10:00:00Z',
          }});
        case '/api/governo/ideale':
          return fulfill(route, { success: true, data: { Primo_Ministro: 'Ministra Inventata' } });
        case '/api/rappresentanti':
          return fulfill(route, { success: true, data: { rappresentanti: {} } });
        case '/api/candidati/selezioni':
          return fulfill(route, { success: true, data: { candidati: {} } });
        case '/api/opinioni/profile':
          return fulfill(route, { success: true, data: {
            questions: [{ id: 'qa-opinion', text: 'Domanda inventata?' }],
            userAnswers: { 'qa-opinion': 'f' },
          }});
        default:
          return fulfill(route, { success: true, data: {} });
      }
    });
    const endpoints = [
      '/api/users/me',
      '/api/user/political-opinions-consent',
      '/api/governo/ideale',
      '/api/rappresentanti',
      '/api/candidati/selezioni',
      '/api/opinioni/profile',
    ];
    const enter = async () => {
      await page.goto(ORIGIN + '/profilo', { waitUntil: 'domcontentloaded' });
      await page.getByText('Comune Inventato').first().waitFor({ timeout: 30000 });
      for (const title of [
        'Rappresentanti selezionati', 'Candidati selezionati',
        'Il tuo Governo ideale', 'Opinioni politiche',
      ]) {
        const d = page.locator('details').filter({ has: page.getByText(title, { exact: false }) }).first();
        await d.locator('summary').click();
      }
      await page.getByText('Ministra Inventata').first().waitFor({ timeout: 20000 });
      await page.waitForTimeout(500);
    };
    await enter();
    const first = endpoints.map(x => count.get(x) || 0);
    assert.ok(first.every(x => x > 0), 'First opening must load each requested section');
    await page.waitForTimeout(400);
    await enter(); // Real reload: destroys React Query RAM but retains IndexedDB.
    const after = endpoints.map(x => count.get(x) || 0);
    assert.deepEqual(after, first,
      'Reopening after page reload must not read any profile endpoint if unchanged');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log(JSON.stringify({ kind: 'persistent-local-profile', result: 'PASS', first, after,
      additionalProfileGets: after.reduce((sum, n, i) => sum + n - first[i], 0) }));
    await context.close();
  } finally {
    await browser.close();
  }
}
test().catch(err => { console.error(err); process.exitCode = 1; });
