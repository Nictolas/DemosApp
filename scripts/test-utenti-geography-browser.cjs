'use strict';

// Browser regression for the real compiled /utenti page, with entirely synthetic
// users and a synthetic token. No DEMOS credential or live API is ever used.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = 'http://localhost:4173';
const ADMIN = '00000000-0000-4000-8000-000000000001';
const token = [
  'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({ userId: ADMIN, role: 'AD', exp: 4102444800 })).toString('base64url'),
  'synthetic-signature',
].join('.');

// Only fictional fixtures. S and C are national-office profiles, CO is municipal.
const users = [
  { id: '00000000-0000-4000-8000-000000000011', nome: 'Finta', cognome: 'Residenza', ruolo: 'P', account_type: 'PERSON', grado_elezione: 'S', regione_residenza: 'Lombardia', comune_residenza: 'Milano', regione_elezione: 'Sicilia', comune_elezione: 'Palermo' },
  { id: '00000000-0000-4000-8000-000000000012', nome: 'Finto', cognome: 'Senatore', ruolo: 'P', account_type: 'PERSON', grado_elezione: 'S', regione_residenza: null, comune_residenza: null, regione_elezione: 'Toscana', comune_elezione: 'Firenze' },
  { id: '00000000-0000-4000-8000-000000000013', nome: 'Finto', cognome: 'Sindaco', ruolo: 'P', account_type: 'PERSON', grado_elezione: 'CO', regione_residenza: null, comune_residenza: null, regione_elezione: 'Piemonte', comune_elezione: 'Torino' },
  { id: '00000000-0000-4000-8000-000000000014', nome: 'Finta', cognome: 'Elettrice', ruolo: 'E', account_type: 'PERSON', regione_residenza: null, comune_residenza: null, regione_elezione: null, comune_elezione: null },
  { id: '00000000-0000-4000-8000-000000000015', nome: 'Finto', cognome: 'SecondaResidenza', ruolo: 'P', account_type: 'PERSON', grado_elezione: 'C', regione_residenza: 'Emilia-Romagna', comune_residenza: 'Bologna', regione_elezione: 'Toscana', comune_elezione: 'Firenze' },
  { id: '00000000-0000-4000-8000-000000000016', nome: 'Finta', cognome: 'Piemontese', ruolo: 'E', account_type: 'PERSON', regione_residenza: 'Piemonte', comune_residenza: null, regione_elezione: null, comune_elezione: null },
];

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1365, height: 1000 }, serviceWorkers: 'block' });
    await context.addInitScript(authToken => {
      window.localStorage.setItem('auth_token', authToken);
    }, token);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    let authHits = 0;
    let userHits = 0;
    const offsite = [];
    // Route every request through a local-only gate, preventing external I/O.
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'localhost' || url.port !== '4173') {
        offsite.push(url.origin);
        return route.abort();
      }
      if (url.pathname === '/api/auth/me') {
        authHits++;
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ success: true, user: { id: ADMIN, email: 'admin@synthetic.invalid', ruolo: 'AD', role: 'AD', is_admin: true, status: 'a' } }),
        });
      }
      if (url.pathname === '/api/users') {
        userHits++;
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ success: true, users, pagination: { page: 1, limit: users.length, total: users.length, pages: 1 } }),
        });
      }
      if (url.pathname.startsWith('/api/')) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.continue();
    });
    await page.goto(BASE + '/utenti', { waitUntil: 'domcontentloaded' });
    try {
      await page.getByRole('tab', { name: /Statistiche/i }).click({ timeout: 15000 });
    } catch (error) {
      console.error(JSON.stringify({
        failedStep: 'Open statistics tab',
        url: page.url(),
        bodyExcerpt: (await page.locator('body').innerText()).slice(0, 5000),
        htmlExcerpt: (await page.locator('body').innerHTML()).slice(0, 1500),
        authHits,
        userHits,
        offsite,
        pageErrors,
      }));
      await page.screenshot({ path: '/tmp/demos-utenti-geography-synthetic.png', fullPage: true });
      throw error;
    }
    await page.getByText('Distribuzione geografica indicativa per regione').waitFor({ timeout: 30000 });
    await page.getByText(/Residenza registrata:\s*3\.\s*Regione elettorale stimata:\s*2\./).waitFor({ timeout: 10000 });
    await page.getByText(/Residenza comunale disponibile per 2 di 6 utenti; riferimenti comunali stimati: 1\./).waitFor({ timeout: 10000 });

    // Le barre sono ordinate per utenti decrescenti e i dati mancanti non
    // vanno presentati come una regione. A parità, ordinamento alfabetico.
    const regionCard = page.locator('div.bg-white').filter({ has: page.getByText('Distribuzione geografica indicativa per regione') }).last();
    await regionCard.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value').first().waitFor({ timeout: 10000 });
    const regionLabels = await regionCard.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value').allTextContents();
    assert.deepEqual(regionLabels, ['Piemonte', 'Emilia-Romagna', 'Lombardia', 'Toscana'], 'Regional bars must be descending, with alphabetical ties');
    assert.ok(await regionCard.getByText('Regione non disponibile per 1 utente.').count(), 'Missing region must be shown separately');

    // Anche i ruoli sono barre verticali, ordinate per conteggio decrescente.
    const roleCard = page.locator('div.bg-white').filter({ has: page.getByText('Distribuzione per Ruolo') }).last();
    await roleCard.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value').first().waitFor({ timeout: 10000 });
    const roleLabels = await roleCard.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value').allTextContents();
    assert.deepEqual(roleLabels, ['P', 'E'], 'Role bars must be descending by number of users');

    // Su smartphone solo il grafico deve muoversi orizzontalmente, senza
    // frecce o navigazione indietro. Simula gli eventi touch reali (incluse
    // interazioni sull'SVG) per verificare preventDefault + scrollLeft.
    await page.setViewportSize({ width: 390, height: 844 });
    const chartScroll = regionCard.getByTestId('utenti-region-chart-scroll');
    const regionOverflow = await chartScroll.evaluate(el => el.scrollWidth > el.clientWidth);
    assert.equal(regionOverflow, true, 'Regional chart must scroll horizontally on mobile');
    assert.equal(await regionCard.getByRole('button', { name: /Mostra le regioni/i }).count(), 0, 'Arrow controls must not be displayed');
    const mobileTouchAction = await chartScroll.evaluate(el => getComputedStyle(el).touchAction);
    assert.equal(mobileTouchAction, 'pan-y', 'Only vertical panning must remain native');
    const touchBehavior = await chartScroll.evaluate(el => {
      const target = el.querySelector('svg') || el;
      const fire = (type, x, y) => {
        const touch = new Touch({ identifier: 1, target, clientX: x, clientY: y });
        const present = type === 'touchend' ? [] : [touch];
        const event = new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: present,
          targetTouches: present,
          changedTouches: [touch],
        });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      };
      fire('touchstart', 300, 200);
      const horizontalPrevented = fire('touchmove', 140, 205);
      const afterForward = el.scrollLeft;
      fire('touchend', 140, 205);
      fire('touchstart', 140, 205);
      const reversePrevented = fire('touchmove', 300, 210);
      const afterBack = el.scrollLeft;
      fire('touchend', 300, 210);
      fire('touchstart', 220, 220);
      const verticalPrevented = fire('touchmove', 218, 130);
      fire('touchend', 218, 130);
      return { horizontalPrevented, afterForward, reversePrevented, afterBack, verticalPrevented };
    });
    assert.equal(touchBehavior.horizontalPrevented, true, 'Horizontal swipe must cancel default browser gesture');
    assert.ok(touchBehavior.afterForward > 70, 'Swipe left must reveal later regions');
    assert.equal(touchBehavior.reversePrevented, true, 'Reverse swipe must cancel default browser gesture');
    assert.ok(touchBehavior.afterBack < 2, 'Swipe right must return to earlier regions');
    assert.equal(touchBehavior.verticalPrevented, false, 'Vertical page scrolling must remain available');
    assert.equal(new URL(page.url()).pathname, '/utenti', 'Chart swipes must not trigger global swipe-back navigation');
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(pageOverflow, false, 'Horizontal chart scrolling must not overflow the page');

    const roleScroll = roleCard.getByTestId('utenti-role-chart-scroll');
    assert.equal(await roleScroll.evaluate(el => el.scrollWidth > el.clientWidth), true, 'Role chart must fit in a horizontally scrollable area on iPhone');
    assert.equal(await roleScroll.evaluate(el => getComputedStyle(el).touchAction), 'pan-y', 'Role chart preserves native vertical pan');
    const roleTouch = await roleScroll.evaluate(el => {
      const target = el.querySelector('svg') || el;
      const fire = (type, x, y) => {
        const touch = new Touch({ identifier: 1, target, clientX: x, clientY: y });
        const current = type === 'touchend' ? [] : [touch];
        const event = new TouchEvent(type, {
          bubbles: true, cancelable: true,
          touches: current, targetTouches: current, changedTouches: [touch],
        });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      };
      fire('touchstart', 300, 200);
      const forwardPrevented = fire('touchmove', 140, 202);
      const forwarded = el.scrollLeft;
      fire('touchend', 140, 202);
      fire('touchstart', 140, 202);
      const backwardPrevented = fire('touchmove', 300, 205);
      const returned = el.scrollLeft;
      fire('touchend', 300, 205);
      fire('touchstart', 250, 260);
      const verticalPrevented = fire('touchmove', 248, 180);
      fire('touchend', 248, 180);
      return { forwardPrevented, forwarded, backwardPrevented, returned, verticalPrevented };
    });
    assert.equal(roleTouch.forwardPrevented, true, 'Role chart must consume horizontal swipe on its SVG');
    assert.ok(roleTouch.forwarded > 70, 'Swipe left on role bars must reveal more roles');
    assert.equal(roleTouch.backwardPrevented, true, 'Role chart must consume reverse horizontal swipe');
    assert.ok(roleTouch.returned < 2, 'Swipe right on role bars must return to initial roles');
    assert.equal(roleTouch.verticalPrevented, false, 'Vertical page scrolling remains available inside role chart');
    assert.equal(new URL(page.url()).pathname, '/utenti', 'Role chart swipes must not navigate away from users');
    assert.equal(await roleCard.getByRole('button', { name: /Mostra i ruoli/i }).count(), 0, 'Role chart must not show arrow controls');

    const municipalCard = page.locator('div.bg-white').filter({ has: page.getByText('I 10 comuni di residenza o riferimento comunale') }).last();
    const table = municipalCard.locator('table');
    await table.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 });
    const entries = await table.locator('tbody tr').allTextContents();
    for (const city of ['Milano', 'Torino', 'Bologna']) {
      assert.ok(entries.some(e => e.includes(city)), 'Missing expected city ' + city + ': ' + entries.join('; '));
    }
    for (const city of ['Firenze', 'Palermo', 'N/A']) {
      assert.ok(entries.every(e => !e.includes(city)), 'Electoral city or N/A incorrectly listed: ' + city);
    }

    assert.ok(authHits >= 1, 'Synthetic auth endpoint was not checked');
    assert.ok(userHits >= 1, 'Synthetic user endpoint was not read');
    await page.screenshot({ path: '/tmp/demos-utenti-geography-synthetic.png', fullPage: true });
    console.log(JSON.stringify({ test: 'real-built-UI', status: 'passed', users: users.length, authenticatedWithFixture: authHits, usersQuery: userHits, cities: entries, offsiteRequestsBlocked: offsite.length }));
    await context.close();
  } finally {
    await browser.close();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
