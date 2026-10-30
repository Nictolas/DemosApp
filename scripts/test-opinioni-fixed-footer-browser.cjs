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
  id: 'synthetic_opinion_' + String(i + 1).padStart(2, '0'),
  text: 'Opinione sintetica numero ' + String(i + 1).padStart(2, '0'),
  grado: ['E', 'N', 'R', 'CO'],
  userAnswer: null,
}));

// Inspect only the existence of a synthetic owner's encrypted IndexedDB
// record. Never decrypt or log political answers from a real account.
async function encryptedOwnerRecordExists(page, owner) {
  return page.evaluate(async id => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('demos-profile-vault-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('entries', 'readonly');
        const request = tx.objectStore('entries')
          .get('owner:' + encodeURIComponent(id));
        request.onsuccess = () => resolve(request.result !== undefined);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, owner);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let cases = 0;
  let warmRevisits = 0;
  let requiredColdReads = 0;
  let statsWarmRevisits = 0;
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
      const answerReads = [];
      let sessionOwner = ID;
      let sessionRole = 'E';
      let politicalGrant = true;
      let politicalEpoch = '2026-10-01T00:00:00Z';
      let catalogRevision = 'a'.repeat(64);
      let catalogEndpointAvailable = true;
      let denyPersonalAnswers = false;
      let holdNextSave = false;
      let releaseHeldSave = null;
      let notifyHeldSave = null;
      const catalogChecks = [];
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
            id: sessionOwner, email: 'test.invalid@example.invalid', role: sessionRole,
            ruolo: sessionRole, status: 'A',
            political_consent: { granted: politicalGrant, timestamp: politicalEpoch },
          }});
        }
        if (u.pathname === '/api/user/political-opinions-consent') {
          return fulfill(route, { success: true, consent: { granted: politicalGrant, timestamp: politicalEpoch } });
        }
        if (u.pathname === '/api/opinioni-catalog-revision') {
          catalogChecks.push(catalogRevision);
          if (!catalogEndpointAvailable) {
            return route.fulfill({ status: 404, contentType: 'application/json',
              body: JSON.stringify({ success: false, error: 'NOT_FOUND' }) });
          }
          return fulfill(route, { success: true, revision: catalogRevision });
        }
        if (u.pathname === '/api/opinioni-list') {
          const grade = u.searchParams.get('grado');
          answerReads.push(grade);
          if (denyPersonalAnswers) {
            return route.fulfill({ status: 503, contentType: 'application/json',
              body: JSON.stringify({ success: false, error: 'SYNTHETIC_PERSONAL_GET_OFFLINE' }) });
          }
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
          if (holdNextSave) {
            // Model a COMMIT ACK arriving after another account takes over.
            holdNextSave = false;
            await new Promise(resolve => {
              releaseHeldSave = resolve;
              notifyHeldSave?.();
            });
          }
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

        console.log('MEASURE ' + JSON.stringify({ viewport, path, initial }));
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

      // Four first visits require one private GET per grade. Reopening all
      // categories multiple times must not multiply SQL-dependent traffic.
      assert.equal(answerReads.length, ROUTES.length,
        'Cold first load must read each grade once, with no duplicate GETs');
      requiredColdReads += answerReads.length;
      for (let round = 0; round < 2; round += 1) {
        for (const [path] of ROUTES) {
          const beforeWarm = answerReads.length;
          await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded' });
          await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
          assert.equal(answerReads.length, beforeWarm,
            'Repeated warm visit must not issue a private GET: ' + path);
          warmRevisits += 1;
        }
      }

      // All four category snapshots have been encrypted in IndexedDB.
      // A full page navigation must not repeat a personal-answer GET.
      const readsBeforeWarmReturn = answerReads.length;
      await page.goto(ORIGIN + '/opinioni-europee', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      assert.equal(answerReads.length, readsBeforeWarmReturn,
        'Encrypted warm cache must survive browser navigation without a GET');

      // Only the personal answer endpoint is offline. Verified session and
      // public catalog metadata still work; a warm cache must make NO
      // private GET (even an attempted request would fail this assertion).
      denyPersonalAnswers = true;
      const readsBeforeOffline = answerReads.length;
      await page.goto(ORIGIN + '/opinioni-europee', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      assert.equal(answerReads.length, readsBeforeOffline,
        'Warm encrypted answers must display while the private API is offline');
      denyPersonalAnswers = false;

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
      const beforeSaveReads = answerReads.length;
      await page.locator('footer[aria-label="Azioni delle opinioni"]').getByRole('button', { name: 'Salva le mie opinioni' }).click();
      await page.getByText('Le tue opinioni comunali sono state salvate.', { exact: true }).waitFor({ timeout: 15000 });
      assert.equal(answerReads.length, beforeSaveReads,
        'Saving a delta must not refetch the full personal answer list');
      assert.ok(writes.length > 0, 'Save button must post the selected opinion');
      assert.equal(writes.at(-1)['synthetic_opinion_01'], 'f');
      assert.deepEqual(Object.keys(writes.at(-1)), ['synthetic_opinion_01'],
        'An unchanged answer must never be included in the delta payload');
      await page.goto(ORIGIN + '/opinioni-comunali', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      assert.equal(answerReads.length, beforeSaveReads,
        'Warm cache after ACK must not repeat an answer GET');

      // Published opinions may appear in multiple grades. The acknowledged
      // answer must update those grade caches without an additional GET.
      const readsBeforeSharedGrade = answerReads.length;
      await page.goto(ORIGIN + '/opinioni-europee', { waitUntil: 'domcontentloaded' });
      const sharedOpinion = page.locator('.opinioni-editor-page__list')
        .locator('div.border-green-200').filter({
          has: page.getByRole('heading', { name: 'Opinione sintetica numero 01' }),
        }).first();
      await sharedOpinion.waitFor();
      const sharedButton = sharedOpinion.getByRole('button', { name: 'Favorevole' });
      assert.match(await sharedButton.getAttribute('class'), /scale-95/,
        'The saved response must be selected in another grade using the same ID');
      assert.equal(answerReads.length, readsBeforeSharedGrade,
        'Cross-grade cache synchronisation must not fetch personal answers again');

      // New official question release changes public metadata, not the auth
      // epoch: the encrypted answer snapshot must be rejected on next visit.
      catalogRevision = 'b'.repeat(64);
      const readsBeforeCatalogChange = answerReads.length;
      await page.goto(ORIGIN + '/opinioni-comunali', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      assert.equal(answerReads.length, readsBeforeCatalogChange + 1,
        'Catalog revision change must refresh this category exactly once');
      assert.ok(catalogChecks.length > 0, 'Metadata-only catalog revision endpoint must be consulted');
      // Older backend versions do not yet expose a catalog checksum.
      // Such responses must not trust a persistent snapshot of unknown age.
      catalogEndpointAvailable = false;
      const readsBeforeLegacyBackend = answerReads.length;
      await page.goto(ORIGIN + '/opinioni-comunali', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      assert.equal(answerReads.length, readsBeforeLegacyBackend + 1,
        'Legacy backend without revision must fall back to a fresh authenticated GET');
      catalogEndpointAvailable = true;
      // Consent revoked in a verified session: cached personal answers stay hidden.
      // A mere UI hide is insufficient: the encrypted owner record must be
      // physically removed from IndexedDB when the revocation is verified.
      assert.equal(await encryptedOwnerRecordExists(page, ID), true,
        'Precondition: the original synthetic account has encrypted cached answers');
      politicalGrant = false;
      const beforeRevokedVisitReads = answerReads.length;
      await page.goto(ORIGIN + '/opinioni-europee', { waitUntil: 'domcontentloaded' });
      // A user without consent now sees the voluntary consent entrypoint,
      // not an ambiguous "no questions available" empty state.
      await page.getByRole('button', { name: 'Leggi e scegli se dare il consenso' }).waitFor();
      assert.equal(await page.getByText('Opinione sintetica numero 24', { exact: true }).count(), 0);
      assert.equal(answerReads.length, beforeRevokedVisitReads,
        'Revoked political consent must not trigger a private answer GET');
      for (let attempt = 0; attempt < 30 && await encryptedOwnerRecordExists(page, ID); attempt++) {
        await page.waitForTimeout(100);
      }
      assert.equal(await encryptedOwnerRecordExists(page, ID), false,
        'Verified political-consent revocation must delete the encrypted owner record');
      // A positive grant flag without its server-verified epoch is not enough.
      // The UI should offer the consent form but MUST NOT make a private GET.
      politicalGrant = true;
      politicalEpoch = '';
      const beforeMissingEpochReads = answerReads.length;
      await page.goto(ORIGIN + '/opinioni-europee', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Leggi e scegli se dare il consenso' }).waitFor();
      assert.equal(answerReads.length, beforeMissingEpochReads,
        'Missing consent epoch must never trigger a personal opinion GET');
      assert.equal(await page.getByText('Opinione sintetica numero 24', { exact: true }).count(), 0);
      cases += 1;
      // Regrant with a new authorization epoch cannot reuse old cached answers.
      politicalEpoch = '2026-10-02T00:00:00Z';
      const beforeRegrantReads = answerReads.length;
      await page.goto(ORIGIN + '/opinioni-europee', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      assert.equal(answerReads.length, beforeRegrantReads + 1,
        'New consent epoch must require a fresh personal snapshot');
      // A different verified account must never read the previous account's vault.
      sessionOwner = '00000000-0000-4000-8000-000000008888';
      const beforeAccountChangeReads = answerReads.length;
      await page.goto(ORIGIN + '/opinioni-europee', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      assert.equal(answerReads.length, beforeAccountChangeReads + 1,
        'Different account must fetch its own answer snapshot');

      // The advanced statistics selector reuses the same encrypted N snapshot
      // that the second verified account obtained from its opinion editor.
      // The original stats route without an ID must show its selector, not
      // mistake the route slug for a published question ID.
      await page.goto(ORIGIN + '/opinioni-nazionali', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      const beforeStatsWarm = answerReads.length;
      sessionRole = 'AD'; // same synthetic owner, advanced statistics permission
      await page.goto(ORIGIN + '/statistiche-opinione', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', {
        name: "Seleziona un'Opinione per Visualizzare le Statistiche",
      }).waitFor({ timeout: 30000 });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      assert.equal(answerReads.length, beforeStatsWarm,
        'Stats selector must reuse encrypted national snapshot without GET');
      statsWarmRevisits += 1;
      // A reload cannot accidentally lose the account/consent-scoped cache.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      assert.equal(answerReads.length, beforeStatsWarm,
        'Stats selector reload must still make no personal-answer GET');
      statsWarmRevisits += 1;

      // A valid server ACK must not update local state after auth changes
      // during the network request. Use synthetic tokens and a held response.
      sessionRole = 'E';
      await page.goto(ORIGIN + '/opinioni-comunali', { waitUntil: 'domcontentloaded' });
      await page.getByText('Opinione sintetica numero 24', { exact: true }).waitFor();
      const secondOpinion = page.locator('.opinioni-editor-page__list')
        .locator('div.border-blue-200').filter({
          has: page.getByRole('heading', { name: 'Opinione sintetica numero 02' }),
        }).first();
      await secondOpinion.getByRole('button', { name: 'Contrario' }).click();
      const enteredHeldSave = new Promise(resolve => { notifyHeldSave = resolve; });
      holdNextSave = true;
      const beforeSwitchedSaveWrites = writes.length;
      await page.locator('footer[aria-label="Azioni delle opinioni"]')
        .getByRole('button', { name: 'Salva le mie opinioni' }).click();
      await enteredHeldSave;
      assert.equal(writes.length, beforeSwitchedSaveWrites + 1,
        'One and only one delta POST is sent before the account switch');
      await page.evaluate(() => localStorage.setItem('auth_token', 'synthetic-switched-token'));
      releaseHeldSave();
      releaseHeldSave = null;
      notifyHeldSave = null;
      await page.waitForTimeout(300);
      assert.ok(page.url().endsWith('/opinioni-comunali'),
        'An ACK for a former login must not navigate the current page');
      assert.equal(await page.getByText('Le tue opinioni comunali sono state salvate.', { exact: true }).count(), 0,
        'An ACK after token switch must not show a success toast for the old account');
      cases += 1;

      assert.deepEqual(errors, [], 'No uncaught errors at ' + viewport.width + 'x' + viewport.height);
      await context.close();
    }
    console.log(JSON.stringify({
      test: 'opinioni-fixed-footer-browser',
      result: 'PASS', cases, warmRevisits, requiredColdReads,
      statsWarmRevisits,
      avoidedPrivateReadsOnWarmRevisits: warmRevisits + statsWarmRevisits,
    }));
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
