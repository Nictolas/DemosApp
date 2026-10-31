'use strict';

/**
 * Authenticated DEMOS page-shell browser regression with SYNTHETIC data only.
 * There are no calls to production services, no real personal records and no writes.
 * Uses the compiled app, real React routes and real CSS (not an HTML fixture).
 * Chromium mobile viewports approximate layout; physical touch validation is separate.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ORIGIN = 'http://localhost:4173';
const USER_ID = '00000000-0000-4000-8000-000000007777';
const TOKEN = [
  'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({ userId: USER_ID, role: 'E', exp: 4102444800 })).toString('base64url'),
  'synthetic-civic-scroll-only',
].join('.');

const VIEWPORTS = [
  { width: 320, height: 568, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 412, height: 915, mobile: true },
  { width: 844, height: 390, mobile: false },
  { width: 1280, height: 800, mobile: false },
];
const GRAZIA = Array.from({ length: 28 }, (_, index) => ({
  nome: 'Persona sintetica ' + String(index + 1).padStart(2, '0'),
  richieste: 28 - index,
}));
const PRESIDENTS = Array.from({ length: 28 }, (_, index) => ({
  nome: 'Candidato sintetico ' + String(index + 1).padStart(2, '0'),
  voti: 28 - index,
}));
const INITIATIVES = Array.from({ length: 28 }, (_, index) => ({
  id: 'iniziativa-sintetica-' + String(index + 1).padStart(2, '0'),
  nome: 'Iniziativa sintetica ' + String(index + 1).padStart(2, '0'),
  descrizione: 'Descrizione di prova non reale per il controllo scorrimento.',
  quorum: '100000',
  firme: 100000 + index,
  esito: 'In Attesa',
}));
const ROUTES = [
  { path: '/grazia', region: 'Classifica Grazia', last: 'Persona sintetica 28' },
  { path: '/capo-stato', region: 'Lista candidati Capo di Stato', last: 'Candidato sintetico 28' },
  { path: '/capo-di-stato', region: 'Lista candidati Capo di Stato', last: 'Candidato sintetico 28' },
  { path: '/vota-iniziativa-popolare', region: 'Iniziative popolari', last: 'Iniziativa sintetica 28' },
  { path: '/avvistamenti', region: 'Categorie degli avvistamenti', last: null },
];

function respond(route, data) {
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(data), headers: { 'cache-control': 'private, no-store' },
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let passed = 0;
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.mobile, hasTouch: viewport.mobile,
        serviceWorkers: 'block', reducedMotion: 'reduce',
      });
      await context.addInitScript(token => {
        localStorage.setItem('auth_token', token);
      }, TOKEN);
      const page = await context.newPage();
      let writes = 0;
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== ORIGIN) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();

        // Explicitly fail all API mutations: UI scrolling must never save votes.
        if (!['GET', 'HEAD'].includes(route.request().method())) {
          writes++;
          return route.fulfill({ status: 403, contentType: 'application/json',
            body: '{"success":false,"error":"SYNTHETIC_TEST_FORBIDS_WRITES"}' });
        }

        if (url.pathname === '/api/auth/me') {
          return respond(route, { success: true, user: {
            id: USER_ID, email: 'civic-scroll@example.invalid', role: 'E',
            ruolo: 'E', status: 'A', account_type: 'E',
          }});
        }
        if (url.pathname === '/api/capo-stato') {
          return respond(route, {
            success: true, classifica: PRESIDENTS, mieiVoti: [],
            blocco: { isBlocked: false },
          });
        }
        if (url.pathname === '/api/capo-stato/consenso') {
          return respond(route, {
            success: true,
            data: { mioConsenso: null,
              statistiche: { 'Sì': 0, 'Non so': 0, 'No': 0, totale: 0 },
              blocco: { isBlocked: false, unlockDate: null },
            },
          });
        }
        if (url.pathname === '/api/grazia') {
          return respond(route, {
            success: true, classifica: GRAZIA, mieiVoti: [],
            blocco: { isBlocked: false },
          });
        }
        if (url.pathname === '/api/iniziative-popolari') {
          return respond(route, {
            success: true, iniziative: INITIATIVES, mieiVoti: [],
            classifica: INITIATIVES.map((item, i) => ({
              nome: item.nome, voti: INITIATIVES.length - i,
            })),
            blocco: { isBlocked: false },
          });
        }
        return respond(route, { success: true, data: [] });
      });

      for (const item of ROUTES) {
        await page.goto(ORIGIN + item.path, { waitUntil: 'domcontentloaded' });
        const region = page.getByRole('region', { name: item.region });
        await region.waitFor({ timeout: 30000 });

        let last;
        if (item.path === '/grazia') {
          // Grazia deliberately renders separate mobile <p> and desktop <h4>
          // versions of every ranking row. Ignore display:none duplicates.
          last = region.locator('p:visible, h4:visible').filter({ hasText: item.last }).last();
        } else if (item.last) {
          last = region.getByText(item.last, { exact: true }).last();
        } else {
          last = region.getByRole('button').last();
        }
        // Last item starts below the clipping boundary; attached is expected, visible is not.
        await last.waitFor({ state: 'attached', timeout: 30000 });

        const first = await page.evaluate(() => {
          const scroller = document.querySelector('.app-main--scroll-content .app-page-scroll');
          const nav = document.querySelector('.app-navbar');
          const heading = document.querySelector('.app-main--scroll-content h1');
          const r = node => node ? (() => {
            const b = node.getBoundingClientRect();
            return { top: b.top, bottom: b.bottom, height: b.height };
          })() : null;
          return {
            scroll: r(scroller), nav: r(nav), heading: r(heading),
            fixedHeader: r(document.querySelector('.grazia-page__fixed-header')),
            fixedControls: r(document.querySelector('.grazia-page__fixed-controls')),
            capoHeader: r(document.querySelector('.capo-stato__fixed-header')),
            capoControls: r(document.querySelector('.capo-stato__fixed-controls')),
            capoRankTitle: r(document.querySelector('.capo-di-stato-page .app-page-scroll')?.previousElementSibling),
            capoBackLinkCount: document.querySelectorAll('.capo-stato__fixed-header a[href="/vota"]').length,
            graziaBackLinkCount: document.querySelectorAll('.grazia-page__fixed-header a[href="/vota"]').length,
            scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight,
            pageScrollTop: document.scrollingElement.scrollTop,
          };
        });

        if (item.path === '/capo-stato' || item.path === '/capo-di-stato') {
          console.log('CAPO PRECHECK ' + JSON.stringify({ viewport, first }));
        }
        assert.ok(first.scroll, 'Missing scroll region: ' + item.path);
        assert.ok(first.scrollHeight > first.clientHeight + 50,
          'Expected overflowing content: ' + item.path + ' ' + viewport.width + 'x' + viewport.height);
        assert.ok(first.clientHeight > 75,
          'Scroll region unusably small: ' + item.path + ' ' + viewport.width + 'x' + viewport.height);

        if (viewport.mobile) {
          assert.ok(first.nav, 'Mobile navbar absent: ' + item.path);
          assert.ok(first.scroll.bottom <= first.nav.top + 2,
            'Content region overlaps mobile navbar: ' + item.path);
        }

        if (viewport.mobile) {
          // A real compositor touch gesture is stronger evidence than assigning
          // scrollTop: it catches CSS touch-action and parent interception bugs.
          const box = await region.boundingBox();
          assert.ok(box && box.height > 100, 'No touch target: ' + item.path);
          const x = Math.round(box.x + box.width * 0.5);
          const fromY = Math.round(box.y + box.height * 0.78);
          const toY = Math.round(box.y + box.height * 0.28);
          const cdp = await context.newCDPSession(page);
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart', touchPoints: [{ x, y: fromY }],
          });
          for (let step = 1; step <= 10; step++) {
            const y = Math.round(fromY + (toY - fromY) * step / 10);
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchMove', touchPoints: [{ x, y }],
            });
            await page.waitForTimeout(16);
          }
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchEnd', touchPoints: [],
          });
          await cdp.detach();
          await page.waitForTimeout(180);
          const touchScrollTop = await region.evaluate(element => element.scrollTop);
          assert.ok(touchScrollTop > 10,
            'Finger swipe did not scroll: ' + item.path + ' ' +
            viewport.width + 'x' + viewport.height + ' scrollTop=' + touchScrollTop);
          console.log('TOUCH PASS ' + item.path + ' ' + viewport.width +
            'x' + viewport.height + ' scrollTop=' + touchScrollTop);
        }

        await region.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await page.waitForTimeout(70);
        const lastRect = await last.evaluate(element => {
          const r = element.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom };
        });
        const after = await page.evaluate(() => {
          const scroll = document.querySelector('.app-main--scroll-content .app-page-scroll');
          const nav = document.querySelector('.app-navbar');
          const heading = document.querySelector('.app-main--scroll-content h1');
          const r = node => node ? (() => {
            const b = node.getBoundingClientRect();
            return { top: b.top, bottom: b.bottom };
          })() : null;
          return { scrollTop: scroll.scrollTop, scroll: r(scroll),
            nav: r(nav), heading: r(heading),
            fixedHeader: r(document.querySelector('.grazia-page__fixed-header')),
            fixedControls: r(document.querySelector('.grazia-page__fixed-controls')),
            capoHeader: r(document.querySelector('.capo-stato__fixed-header')),
            capoControls: r(document.querySelector('.capo-stato__fixed-controls')),
            capoRankTitle: r(document.querySelector('.capo-di-stato-page .app-page-scroll')?.previousElementSibling),
            documentScrollTop: document.scrollingElement.scrollTop };
        });

        console.log('MEASURE ' + JSON.stringify({ route: item.path, viewport, before: first, after, lastRect }));
        assert.ok(after.scrollTop > 50, 'Scroll did not move in ' + item.path);
        assert.ok(lastRect.bottom <= after.scroll.bottom + 2,
          'Last entry clipped below scrollport: ' + item.path);
        assert.ok(lastRect.top >= after.scroll.top - 2,
          'Last entry clipped above scrollport: ' + item.path);
        assert.equal(after.documentScrollTop, first.pageScrollTop,
          'The whole fixed app viewport moved: ' + item.path);
        if (first.nav) {
          assert.ok(Math.abs(first.nav.top - after.nav.top) <= 2,
            'Bottom navigation moved with scroll: ' + item.path);
          assert.ok(lastRect.bottom <= after.nav.top + 2,
            'Last entry obscured by navbar: ' + item.path);
        }
        if (item.path === '/grazia') {
          assert.ok(first.fixedHeader && first.fixedControls,
            'Grazia must expose fixed title and vote controls');
          assert.equal(first.graziaBackLinkCount, 0,
            'Grazia must not link back to Vota in the header');
          assert.ok(Math.abs(first.fixedHeader.top - after.fixedHeader.top) <= 2,
            'Grazia title moved while ranking scrolled');
          assert.ok(Math.abs(first.fixedControls.top - after.fixedControls.top) <= 2,
            'Grazia voting controls moved while ranking scrolled');
          assert.ok(Math.abs(first.fixedControls.bottom - after.fixedControls.bottom) <= 2,
            'Grazia voting controls shifted while ranking scrolled');
          if (viewport.width < 768) {
            assert.ok(first.scroll.top >= first.fixedControls.bottom - 2,
              'Ranking must start below fixed voting controls on a phone');
          }
        }
        if (item.path === '/capo-stato' || item.path === '/capo-di-stato') {
          assert.ok(first.capoHeader && first.capoControls && first.capoRankTitle,
            'Missing fixed title, vote controls or list heading for Capo di Stato');
          assert.equal(first.capoBackLinkCount, 0,
            'Capo di Stato must not show a back-to-Vota link');
          for (const key of ['capoHeader', 'capoControls', 'capoRankTitle']) {
            assert.ok(Math.abs(first[key].top - after[key].top) <= 2 &&
              Math.abs(first[key].bottom - after[key].bottom) <= 2,
              key + ' moved while scrolling the ranking: ' + item.path);
          }
          if (viewport.width < 768) {
            assert.ok(first.scroll.top >= first.capoControls.bottom - 2,
              'Capo di Stato list must start below the stationary voting panel');
          }
        }
        if (item.path === '/avvistamenti' && first.heading && after.heading) {
          assert.ok(Math.abs(first.heading.top - after.heading.top) <= 2,
            'Avvistamenti header moved with scroll');
        }
        assert.equal(writes, 0, 'A synthetic scroll test attempted an API write');

        console.log('PASS ' + item.path + ' ' + viewport.width + 'x' + viewport.height +
          ' scrollTop=' + after.scrollTop + ' lastBottom=' + lastRect.bottom.toFixed(1));
        passed++;
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  assert.equal(passed, ROUTES.length * VIEWPORTS.length);
  console.log('PASS ' + passed + ' real-route browser scroll cases (synthetic data only)');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
