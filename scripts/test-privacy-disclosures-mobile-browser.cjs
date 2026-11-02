'use strict';

// Run against a LOCAL production Vite preview only. No real DEMOS account,
// data, or advertising SDK is needed. CI installs Playwright separately.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ORIGIN = process.env.DEMOS_PRIVACY_PREVIEW_URL || 'http://127.0.0.1:4173';
const PAGES = [
  { route: '/privacy-policy', marker: 'Informativa sulla Privacy' },
  { route: '/cookie-policy', marker: 'Informativa sui Cookie' },
];
const WIDTHS = [320, 390, 768];

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let checks = 0;
  try {
    for (const width of WIDTHS) {
      const mobile = width < 640;
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
        reducedMotion: 'reduce',
      });
      try {
        // No requests to production APIs or external Google providers.
        await context.route('**/*', route => {
          const requested = new URL(route.request().url());
          const expected = new URL(ORIGIN);
          if (requested.origin === expected.origin) return route.continue();
          return route.abort();
        });
        for (const { route, marker } of PAGES) {
          const page = await context.newPage();
          const pageErrors = [];
          page.on('pageerror', error => pageErrors.push(error.message));
          try {
            const response = await page.goto(ORIGIN + route, {
              waitUntil: 'domcontentloaded',
              timeout: 20000,
            });
            assert.equal(response?.status(), 200, route + ' should return HTTP 200');
            await page.waitForFunction(text => document.body?.innerText?.includes(text), marker, {
              timeout: 20000,
            });
            await page.evaluate(() => document.fonts.ready);
            const state = await page.evaluate(() => {
              const isVisible = element => {
                const style = getComputedStyle(element);
                return style.display !== 'none' && style.visibility !== 'hidden' &&
                  element.getClientRects().length > 0;
              };
              // Body overflow-x:hidden can mask clipped table cells: check
              // rendered geometry in addition to document.scrollWidth.
              const targets = document.querySelectorAll(
                '.container, section, table, thead, tbody, tr, th, td, dl, dt, dd',
              );
              const clipping = [...targets].filter(isVisible).flatMap(element => {
                const rect = element.getBoundingClientRect();
                return rect.right > innerWidth + 1 || rect.left < -1
                  ? [{ tag: element.tagName, right: Math.round(rect.right),
                       left: Math.round(rect.left) }]
                  : [];
              }).slice(0, 8);
              return {
                viewport: innerWidth,
                docWidth: document.documentElement.scrollWidth,
                bodyWidth: document.body.scrollWidth,
                clipping,
                privacyContents: document.body.innerText.includes(
                  'nome e cognome non sono richiesti agli utenti ordinari',
                ),
                cookieRevision: document.body.innerText.includes(
                  'Ultima modifica del testo: 02/11/2026',
                ),
                mobileCards: [...document.querySelectorAll('dl')]
                  .filter(isVisible).map(el => el.innerText),
                desktopTables: [...document.querySelectorAll('table')]
                  .filter(isVisible).map(el => el.innerText),
              };
            });
            assert.equal(state.viewport, width, route + ': viewport width');
            assert.ok(state.docWidth <= width + 1, route + ': horizontal document overflow');
            assert.ok(state.bodyWidth <= width + 1, route + ': horizontal body overflow');
            assert.deepEqual(state.clipping, [], route + ': clipped visible content');
            assert.deepEqual(pageErrors, [], route + ': JavaScript page errors');

            if (route === '/privacy-policy') {
              assert.ok(state.privacyContents, 'Privacy document must describe ordinary-account data accurately');
            } else {
              assert.ok(state.cookieRevision, 'Cookie text revision date must not follow the current day');
              if (mobile) {
                assert.equal(state.mobileCards.length, 2, 'Two mobile definition lists must be visible');
                assert.equal(state.desktopTables.length, 0, 'Desktop tables must be hidden on mobile');
                assert.ok(state.mobileCards.join(' ').includes('sidebar:state'));
                for (const token of ['auth_token', 'refresh_token', 'user_email']) {
                  assert.ok(state.mobileCards.join(' ').includes(token), 'Missing mobile storage item: ' + token);
                }
              } else {
                assert.equal(state.desktopTables.length, 2, 'Two desktop tables must be visible');
                assert.equal(state.mobileCards.length, 0, 'Mobile cards must be hidden on desktop');
              }
            }
            checks++;
            process.stdout.write('PASS ' + route + ' ' + width + 'px; no clipping or JS errors\n');
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  assert.equal(checks, 6, 'Both pages at all three viewport sizes must be tested');
  process.stdout.write('PASS privacy browser layout regression: 6/6 cases (local preview only)\n');
}

run().catch(error => {
  console.error('FAIL privacy browser layout regression:', error);
  process.exitCode = 1;
});
