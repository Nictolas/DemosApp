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
    let granted = true;
    let version = "2026-10-29T10:00:00Z";
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
            political_consent: { granted, timestamp: granted ? version : null },
          }});
        case '/api/users/me':
          return fulfill(route, { success: true, user: {
            id: OWNER, ruolo: 'AD', status: 'A', data_nascita: '24/10/1990',
            cittadinanza: 'Italiana', paese_residenza: 'Italia',
            regione_residenza: 'Toscana', provincia_residenza: 'Pisa',
            comune_residenza: 'Comune Inventato',
          }});
        case '/api/user/profile-selections':
          return fulfill(route, { success:true, data: {
            capoStato: ['Presidente Inventato'], grazia: [],
            amnistia: ['Reato Inventato'], iniziativaPopolare: ['Iniziativa Inventata'],
            attivista: { id:'synthetic-activist',nome:'Attivista Inventato' },
            organizzazione: { id:'synthetic-org',nome:'Associazione Inventata' },
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
      '/api/governo/ideale',
      '/api/user/profile-selections',
      '/api/rappresentanti',
      '/api/candidati/selezioni',
      '/api/opinioni/profile',
    ];
    const enter = async (political = true) => {
      await page.goto(ORIGIN + '/profilo', { waitUntil: 'domcontentloaded' });
      await page.getByText('Comune Inventato').first().waitFor({ timeout: 30000 });
      if (political) {
        await page.getByText('Attivista Inventato').first().waitFor({timeout:15000});
        assert.equal(await page.getByText('Grazia', { exact:true }).count(), 0,
          'Empty categories must remain hidden in the profile');
      }
      for (const title of [
        'Rappresentanti selezionati', 'Candidati selezionati',
        'Il tuo Governo ideale', 'Opinioni politiche',
      ]) {
        const d = page.locator('details').filter({ has: page.getByText(title, { exact: false }) }).first();
        await d.locator('summary').click();
      }
      if (political) await page.getByText('Ministra Inventata').first().waitFor({ timeout: 20000 });
      else {
        await page.waitForTimeout(700);
        assert.equal(await page.getByText('Attivista Inventato').count(), 0,
          'Revocation must hide cached favourite activist');
      }
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

    // Another device revoked consent while this one was suspended.
    // Only the existing /auth/me handshake communicates the new state.
    granted = false;
    await enter(false);
    assert.equal(await page.getByText('Ministra Inventata').count(), 0,
      'Old political selections must be hidden after cross-device revocation');
    assert.deepEqual(endpoints.map(x => count.get(x) || 0), first,
      'Remote revocation check cannot add profile endpoint GETs');
    const authCallsAfterRevocation = count.get('/api/auth/me') || 0;
    assert.ok(authCallsAfterRevocation >= 3,
      'Every cold session must validate the current consent in auth/me');

    // New authorization is a new epoch: no old answers can be restored.
    granted = true;
    version = '2026-10-29T11:00:00Z';
    await enter();
    assert.ok((count.get('/api/governo/ideale') || 0) > first[1],
      'Regranted session must fetch a fresh political snapshot, not old cached data');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log(JSON.stringify({ kind: 'persistent-local-profile', result: 'PASS', first, after,
      additionalProfileGets: after.reduce((sum, n, i) => sum + n - first[i], 0) }));
    await context.close();
  } finally {
    await browser.close();
  }
}
test().catch(err => { console.error(err); process.exitCode = 1; });
