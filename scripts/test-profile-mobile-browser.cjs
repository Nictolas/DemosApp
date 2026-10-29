'use strict';

// Browser test of the built DEMOS profile with fictional identities only.
// All network requests outside localhost:4173 are blocked before dispatch.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = 'http://localhost:4173';
const OWNER = '00000000-0000-4000-8000-000000000101';
const OTHER = '00000000-0000-4000-8000-000000000102';
const authToken = [ 'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({ userId: OWNER, role: 'AD', exp: 4102444800 })).toString('base64url'),
  'synthetic-signature' ].join('.');

const ownerProfile = {
  id: OWNER, ruolo: 'AD', status: 'A', nome: 'Finto', cognome: 'Utente',
  data_nascita: '1990-04-01', cittadinanza: 'Italiana',
  paese_residenza: 'Italia', regione_residenza: 'Toscana',
  provincia_residenza: 'Pisa', comune_residenza: 'Comune Inventato',
  telefono: '000 000 0000',
};
const publicProfile = {
  id: OTHER, ruolo: 'P', nome: 'Politica', cognome: 'Inventata',
  nome_completo: 'Politica Inventata',
};

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    await context.addInitScript(token => {
      localStorage.setItem('auth_token', token);
    }, authToken);

    const page = await context.newPage();
    const errors = [];
    const calls = new Map();
    const blockedOffsite = new Set();
    page.on('pageerror', error => errors.push(error.message));

    const reply = (route, value, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(value),
      });

    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'localhost' || url.port !== '4173') {
        blockedOffsite.add(url.origin);
        return route.abort();
      }
      const p = url.pathname;
      if (!p.startsWith('/api/')) return route.continue();
      calls.set(p, (calls.get(p) || 0) + 1);
      if (p === '/api/auth/me') {
        return reply(route, { success: true, user: { id: OWNER, role: 'AD', ruolo: 'AD', status: 'A', is_admin: true } });
      }
      if (p === '/api/users/me') return reply(route, { success: true, user: ownerProfile });
      if (p === '/api/opinioni/profile') return reply(route, {
        success: true, data: {
          questions: [{ id: 'synthetic_opinion', text: 'Domanda inventata?' }],
          userAnswers: { synthetic_opinion: 'f' },
        },
      });
      if (p === '/api/governo/ideale') return reply(route, { success: true, data: { Primo_Ministro: 'Ministra Fittizia' } });
      if (p === '/api/rappresentanti') return reply(route, { success: true, data: { rappresentanti: {} } });
      if (p === '/api/candidati/selezioni') return reply(route, { success: true, data: { candidati: {} } });
      if (p === `/api/users/${OTHER}/public-profile`) return reply(route, {
        success: true, user: publicProfile,
        public: { governoIdeale: {}, rappresentanti: {}, candidati: {} },
      });
      if (p === `/api/users/${OTHER}/opinioni`) return reply(route, { success: true, data: { opinioni: [] } });
      return reply(route, { success: true, data: {} });
    });

    await page.goto(BASE + '/profilo', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Profilo Utente' }).waitFor({ timeout: 25000 });
    await page.getByText('Comune Inventato', { exact: false }).first().waitFor({ timeout: 30000 });
    assert.equal(await page.getByText('Dati personali completi').count(), 1);
    const personal = page.locator('details').filter({ has: page.getByText('Dati personali completi') });
    assert.equal(await personal.evaluate(el => el.open), false, 'Personal fields closed by default');
    await personal.locator('summary').click();
    await personal.getByText('Telefono', { exact: true }).waitFor();
    await personal.locator('summary').click();
    assert.equal(await personal.evaluate(el => el.open), false);

    const sections = [
      'Rappresentanti selezionati', 'Candidati selezionati',
      'Il tuo Governo ideale', 'Opinioni politiche',
    ];
    for (const label of sections) {
      const disclosure = page.locator('details').filter({ has: page.getByText(label, { exact: false }) }).first();
      assert.equal(await disclosure.count(), 1, 'Missing disclosure: ' + label);
      assert.equal(await disclosure.evaluate(el => el.open), false, label + ' should be initially collapsed');
      await disclosure.locator('summary').click();
      assert.equal(await disclosure.evaluate(el => el.open), true);
      await disclosure.locator('summary').click();
    }
    assert.ok(await page.getByRole('link', { name: 'Impostazioni' }).count(), 'Settings must remain accessible from profile');
    assert.ok(await page.locator('nav.app-bottom-nav a[href="/profilo"]').count(), 'Profile is a bottom-nav destination');
    assert.equal(await page.locator('nav.app-bottom-nav a[href="/impostazioni"]').count(), 0, 'No eighth Settings tab');
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(horizontalOverflow, false, 'Profile must not overflow 390px viewport');

    const summaryHeight = await page.getByText('Dati personali completi').evaluate(el => {
      const card = el.closest('.rounded-2xl');
      return card?.getBoundingClientRect().height || 0;
    });
    assert.ok(summaryHeight > 0 && summaryHeight < 350, 'Compact profile summary too tall: ' + summaryHeight);

    const ownEndpoints = [
      '/api/users/me', '/api/opinioni/profile', '/api/governo/ideale',
      '/api/rappresentanti', '/api/candidati/selezioni',
    ];
    for (const p of ownEndpoints) {
      assert.ok((calls.get(p) || 0) >= 1, 'First opening missing ' + p);
    }
    // Other app bootstrap components may also read /api/users/me; count the
    // delta caused by *reopening* the profile, not all application activity.
    const originalCounts = ownEndpoints.map(p => calls.get(p) || 0);

    // Client-side navigation must reuse the same React Query cache.
    await page.locator('nav.app-bottom-nav a[href="/preferiti"]').click();
    await page.waitForURL('**/preferiti');
    await page.waitForTimeout(700);
    const countsBeforeReturn = ownEndpoints.map(p => calls.get(p) || 0);
    await page.locator('nav.app-bottom-nav a[href="/profilo"]').click();
    await page.waitForURL('**/profilo');
    await page.getByText('Comune Inventato', { exact: false }).first().waitFor();
    assert.deepEqual(ownEndpoints.map(p => calls.get(p) || 0), countsBeforeReturn,
      'Reopening the profile must not refetch its five endpoints while cache is fresh');

    await page.screenshot({ path: '/tmp/demos-profile-own-synthetic-mobile.png', fullPage: true });

    // Public view must use the public projection only, not visitor's selections.
    const ownCountsBeforePublic = ownEndpoints.map(p => calls.get(p));
    await page.goto(BASE + '/profilo/' + OTHER, { waitUntil: 'domcontentloaded' });
    await page.getByText('Politica Inventata', { exact: false }).first().waitFor({ timeout: 30000 });
    await page.getByText('Profilo pubblico', { exact: true }).first().waitFor();
    assert.equal(await page.getByText('Dati personali completi').count(), 0);
    assert.equal(await page.getByText('Comune Inventato').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Modifica profilo' }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Impostazioni' }).count(), 0);
    const ownPoliticalPaths = ownEndpoints.filter(p => p !== '/api/users/me');
    assert.deepEqual(
      ownPoliticalPaths.map(p => calls.get(p) || 0),
      ownPoliticalPaths.map(p => ownCountsBeforePublic[ownEndpoints.indexOf(p)]),
      'Public view must not fetch private political choices of the signed-in visitor',
    );
    // Global app bootstrap can independently request /api/users/me on a full
    // reload. This is not an owner-selection leak and is recorded separately.
    const unrelatedOwnUserReadsOnReload = (calls.get('/api/users/me') || 0) - ownCountsBeforePublic[0];
    assert.equal(calls.get(`/api/users/${OTHER}/public-profile`), 1);
    assert.equal(calls.get(`/api/users/${OTHER}/opinioni`), 1);
    await page.screenshot({ path: '/tmp/demos-profile-public-synthetic-mobile.png', fullPage: true });

    assert.deepEqual(errors, [], 'Uncaught browser errors');
    console.log(JSON.stringify({
      kind: 'compiled-profile-browser-synthetic',
      status: 'pass', viewport: '390x844', summaryHeight,
      firstOpeningObservedApiReads: originalCounts.reduce((a, b) => a + b, 0),
      secondOpeningAdditionalProfileReads: 0,
      unrelatedOwnUserReadsOnReload,
      externalRequestsAllowed: 0,
      externalOriginsBlocked: blockedOffsite.size,
    }));
    await context.close();
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
