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

    // Su smartphone tutte le etichette rimangono leggibili tramite scroll.
    await page.setViewportSize({ width: 390, height: 844 });
    const regionOverflow = await regionCard.locator('.overflow-x-auto').evaluate(el => el.scrollWidth > el.clientWidth);
    assert.equal(regionOverflow, true, 'Regional chart must scroll horizontally on mobile');

    const municipalCard = page.locator('div.bg-white').filter({ has: page.getByText('I 10 comuni di residenza o riferimento comunale') }).last();
    const table = municipalCard.locator('table');
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
