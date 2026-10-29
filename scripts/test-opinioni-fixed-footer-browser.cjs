'use strict';

/**
 * Synthetic browser regression: no real DEMOS account, Supabase or public API.
 * Exercise the compiled app shell at four viewport sizes and all four opinion routes.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ORIGIN = 'http://localhost:4173';
const ID = '00000000-0000-4000-8000-000000009999';
const TOKEN = [
  'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({ userId: ID, role: 'E', exp: 4102444800 })).toString('base64url'),
  'synthetic-only',
].join('.');
const ROUTES = [
  ['/opinioni-europee', 'E', 'Opinioni Europee'],
  ['/opinioni-nazionali', 'N', 'Opinioni Nazionali'],
  ['/opinioni-regionali', 'R', 'Opinioni Regionali'],
  ['/opinioni-comunali', 'CO', 'Opinioni Comunali'],
];
const VIEWPORTS = [
  { width: 320, height: 568 },  // compact phone
  { width: 390, height: 844 },  // iPhone
  { width: 412, height: 915 },  // Android
  { width: 844, height: 390 },  // landscape
  { width: 1280, height: 800 }, // desktop
];
const Q = Array.from({ length: 24 }, (_, i) => ({
  id: 'synthetic-opinion-' + String(i + 1).padStart(2, '0'),
  text: 'Opinione sintetica numero ' + String(i + 1).padStart(2, '0'),
  grado: ['E', 'N', 'R', 'CO'],
  userAnswer: null,
}));

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let cases = 0;
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500,
        serviceWorkers: 'block', reducedMotion: 'reduce',
      });
      await context.addInitScript(token => localStorage.setItem('auth_token', token), TOKEN);
      const page = await context.newPage();
      const errors = [];
      const writes = [];
      const saved = new Map();
      page.on('pageerror', error => errors.push(error.message));
      const fulfill = (route, value) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(value),
        headers: { 'cache-control': 'private, no-store' },
      });

      await page.route('**/*', async route => {
        const u = new URL(route.request().url());
        if (u.origin !== ORIGIN) return route.abort();
        if (!u.pathname.startsWith('/api/')) return route.continue();

        if (u.pathname === '/api/auth/me') {
          return fulfill(route, { success: true, user: {
            id: ID, email: 'test.invalid@example.invalid', role: 'E',
            ruolo: 'E', status: 'A',
            political_consent: { granted: true, timestamp: '2026-10-01T00:00:00Z' },
          }});
        }
        if (u.pathname === '/api/user/political-opinions-consent') {
          return fulfill(route, { success: true, consent: { granted: true, timestamp: '2026-10-01T00:00:00Z' } });
        }
        if (u.pathname === '/api/opinioni-list') {
          const grade = u.searchParams.get('grado');
          const answers = saved.get(grade) || {};
          return fulfill(route, { success: true, total: Q.length, data: Q.map(q => ({
            ...q, userAnswer: answers[q.id] || null,
          })) });
        }
        if (u.pathname.startsWith('/api/opinioni/stats/')) {
          return fulfill(route, { success: true, data: { suppressed: true } });
        }
        if (u.pathname === '/api/opinioni/salva' && route.request().method() === 'POST') {
          const body = route.request().postDataJSON();
          const answers = body.opinioni;
          writes.push(answers);
          // Only used in the final save flow on the communal route.
          saved.set('CO', { ...(saved.get('CO') || {}), ...answers });
          return fulfill(route, { success: true, savedCount: Object.keys(answers).length, errorCount: 0 });
        }
        return fulfill(route, { success: true, data: [] });
      });

      for (const [path, , title] of ROUTES) {
        await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 30000 });
        await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
        const list = page.locator('.opinioni-editor-page__list');
        const header = page.getByRole('heading', { name: title, exact: true });
        const footer = page.locator('footer[aria-label="Azioni delle opinioni"]');
        const save = footer.getByRole('button', { name: 'Salva le mie opinioni' });
        const back = footer.getByRole('button', { name: 'Indietro' });
        const nav = page.locator('.app-navbar');
        assert.equal(await footer.count(), 1, 'Exactly one action bar for ' + path);
        assert.equal(await save.isEnabled(), true, 'Save enabled with questions in ' + path);
        assert.equal(await back.isEnabled(), true, 'Back enabled in ' + path);

        const initial = await page.evaluate(() => {
          const list = document.querySelector('.opinioni-editor-page__list');
          const heading = document.querySelector('.opinioni-editor-page h1, .opinioni-editor-page h2, .opinioni-editor-page [class*="CardTitle"]')
            || document.querySelector('.opinioni-editor-page [class*="text-3xl"]');
          const bar = document.querySelector('footer[aria-label="Azioni delle opinioni"]');
          const nav = document.querySelector('.app-navbar');
          const r = element => {
            const { top, bottom, height } = element.getBoundingClientRect();
            return { top, bottom, height };
          };
          return {
            list: r(list), bar: r(bar), nav: nav ? r(nav) : null,
            heading: heading ? r(heading) : null,
            clientHeight: list.clientHeight, scrollHeight: list.scrollHeight,
            viewHeight: window.innerHeight,
          };
        });

        assert.ok(initial.scrollHeight > initial.clientHeight + 100,
          path + ' must have a scrollable opinion list at ' + viewport.width + 'x' + viewport.height);
        assert.ok(initial.clientHeight > 90, 'The scroll area must remain usable');
        assert.ok(initial.bar.top + 1 >= initial.list.bottom,
          'Footer must be BELOW list, never over questions: ' + path);
        assert.ok(initial.bar.bottom <= initial.viewHeight + 1,
          'Footer must be inside viewport: ' + path);
        if (viewport.width < 500) {
          assert.ok(initial.nav, 'Mobile navbar missing: ' + path);
          assert.ok(initial.bar.bottom <= initial.nav.top + 1,
            'Footer must not cover mobile navigation: ' + path);
        }

        await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await page.waitForTimeout(100);
        const after = await page.evaluate(() => {
          const r = s => document.querySelector(s).getBoundingClientRect();
          const list = document.querySelector('.opinioni-editor-page__list');
          const lastQuestion = Array.from(document.querySelectorAll('.opinioni-editor-page h3'))
            .find(e => e.textContent === 'Opinione sintetica numero 24');
          return {
            scrollTop: list.scrollTop,
            listBottom: r('.opinioni-editor-page__list').bottom,
            barTop: r('footer[aria-label="Azioni delle opinioni"]').top,
            lastBottom: lastQuestion?.getBoundingClientRect().bottom,
          };
        });
        assert.ok(after.scrollTop > 0, 'List must scroll independently: ' + path);
        assert.ok(after.lastBottom <= after.listBottom + 1,
          'Last opinion must remain visible above footer: ' + path);
        assert.ok(Math.abs(after.barTop - initial.bar.top) < 2,
          'Footer moves with scrolling: ' + path);

        // The footer is actionable at every scroll position; no extra DB requests.
        assert.equal(await save.isVisible(), true);
        assert.equal(await back.isVisible(), true);
        cases += 1;
      }

      // Real save and unsaved navigation guard using only synthetic API responses.
      await page.goto(ORIGIN + '/opinioni-comunali', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      const firstQuestion = page.locator('.opinioni-editor-page__list').locator('div.border-blue-200').filter({
        has: page.getByRole('heading', { name: 'Opinione sintetica numero 01' }),
      }).first();
      await firstQuestion.getByRole('button', { name: 'Favorevole' }).click();
      await page.locator('footer[aria-label="Azioni delle opinioni"]').getByRole('button', { name: 'Indietro' }).click();
      await page.getByText('Opinioni non salvate').waitFor();
      await page.getByRole('button', { name: 'Annulla' }).click();
      assert.ok(page.url().endsWith('/opinioni-comunali'), 'Cancel must keep the current opinion page');
      await page.locator('footer[aria-label="Azioni delle opinioni"]').getByRole('button', { name: 'Salva le mie opinioni' }).click();
      await page.getByText('Le tue opinioni comunali sono state salvate.').waitFor({ timeout: 15000 });
      assert.ok(writes.length > 0, 'Save button must post the selected opinion');
      assert.equal(writes.at(-1)['synthetic-opinion-01'], 'f');
      assert.deepEqual(errors, [], 'No uncaught errors at ' + viewport.width + 'x' + viewport.height);
      await context.close();
    }
    console.log(JSON.stringify({ test: 'opinioni-fixed-footer-browser', result: 'PASS', cases }));
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
