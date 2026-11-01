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
    let initiativeTitle = 'Iniziativa Inventata';
    let allSelectionsEmpty = false;
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
          return fulfill(route, { success:true, data: allSelectionsEmpty ? {
            capoStato: [], grazia: [], amnistia: [], iniziativaPopolare: [],
            attivista: null, organizzazione: null,
          } : {
            capoStato: ['Presidente Inventato'], grazia: [],
            amnistia: ['Reato Inventato'], iniziativaPopolare: [initiativeTitle],
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
        assert.equal(await page.getByText('Grazia', { exact:true }).count(), 1,
          'Grazia must remain visible when no vote has been selected');
        assert.equal(await page.getByText('Nessun voto selezionato', { exact: true }).count(), 1,
          'An empty Grazia vote must offer the user a choice action');
        assert.equal(await page.getByRole('link').filter({ has: page.getByText('Grazia', { exact: true }) }).count(), 1,
          'The empty Grazia row must be navigable');
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
      'Reopening after page reload must not read any profile endpoint if unchanged: ' +
      JSON.stringify(endpoints.map((endpoint, i) => ({
        endpoint, first: first[i], after: after[i],
      }))));

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
    // Migrate a one-time legacy UUID written by an older app build:
    // only this defective cached section is fetched again and corrected.
    initiativeTitle = '09f7c726-b705-46cb-aaf7-9b4b328b1e77';
    version = '2026-10-29T12:00:00Z';
    await enter();
    const beforeLegacyRepair = count.get('/api/user/profile-selections') || 0;
    initiativeTitle = 'BASTA QUORUM PER I REFERENDUM! CHI VOTA DECIDE.';
    await enter();
    await page.getByText(initiativeTitle).first().waitFor({ timeout: 15000 });
    assert.equal(count.get('/api/user/profile-selections'), beforeLegacyRepair + 1,
      'Legacy initiative UUID should trigger exactly one corrective GET');
    await enter();
    await page.getByText(initiativeTitle).first().waitFor({ timeout: 15000 });
    assert.equal(count.get('/api/user/profile-selections'), beforeLegacyRepair + 1,
      'Once the title is repaired, subsequent reloads must use only the encrypted cache');

    // All six civic categories must be present even when every selection is empty.
    // A new consent epoch invalidates the previous votes before displaying blanks.
    allSelectionsEmpty = true;
    version = '2026-10-29T13:00:00Z';
    await page.goto(ORIGIN + '/profilo', { waitUntil: 'domcontentloaded' });
    await page.getByText('Comune Inventato').first().waitFor({ timeout: 30000 });
    const choicesSection = page.locator('section[aria-label="Le mie altre scelte"]');
    await choicesSection.getByText('Nessun voto selezionato', { exact: true }).first().waitFor({ timeout: 15000 });
    assert.equal(await choicesSection.getByText('Nessun voto selezionato', { exact: true }).count(), 6,
      'Each of the six empty categories must offer a selection');
    assert.equal(await choicesSection.getByText('Scegli ora', { exact: true }).count(), 6,
      'All six empty choices must be actionable');
    const emptyFirst = count.get('/api/user/profile-selections') || 0;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await choicesSection.getByText('Nessun voto selezionato', { exact: true }).first().waitFor({ timeout: 15000 });
    assert.equal(await choicesSection.getByText('Nessun voto selezionato', { exact: true }).count(), 6);
    assert.equal(count.get('/api/user/profile-selections') || 0, emptyFirst,
      'Showing empty preference categories must not trigger any extra database reads');

    // The compass is a separate, private page opened from the last
    // section of the owner profile. Test a genuine mobile tap and navigation.
    const compassLink = page.getByTestId('profilo-compasso-politico-link');
    await compassLink.scrollIntoViewIfNeeded();
    await compassLink.click();
    await page.waitForURL(ORIGIN + '/compasso-politico', { timeout: 15000 });
    await page.getByRole('heading', { name: 'Compasso politico' }).waitFor({ timeout: 15000 });
    // This fixture contains only one answered question: the axis must not
    // fabricate an ideological position from insufficient data.
    await page.getByText('Dati insufficienti', { exact: true }).first().waitFor({ timeout: 15000 });

    // Expand the full methodology on a mobile viewport: every one of the
    // 28 mapped questions must remain reachable above the bottom navigation.
    const compassMain = page.locator('main[aria-label="Compasso politico personale"]');
    await compassMain.getByText('Quali Opinioni vengono usate e come?').click();
    assert.equal(await compassMain.locator('li').count(), 28,
      'The dedicated compass must disclose all 28 contributing questions');
    const scrollMetrics = await compassMain.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    assert.ok(scrollMetrics.scrollHeight > scrollMetrics.clientHeight,
      'Expanded questionnaire must be scrollable in the mobile viewport');
    assert.ok(scrollMetrics.scrollWidth <= scrollMetrics.clientWidth + 1,
      'Compass must not create horizontal scroll on a mobile viewport');
    await compassMain.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const bottomLink = compassMain.getByRole('link', { name: 'Esprimi o modifica le tue Opinioni' });
    await bottomLink.waitFor({ timeout: 10000 });
    const bottomLinkVisible = await bottomLink.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const parent = element.closest('main').getBoundingClientRect();
      return rect.bottom <= parent.bottom + 1 && rect.top >= parent.top - 1;
    });
    assert.ok(bottomLinkVisible, 'The last action must be visible at the end of the scroll');

    // Returning to the profile and reopening the compass must reuse the
    // verified opinion data from the current consent epoch.
    const answersGetAfterFirstOpen = count.get('/api/opinioni/profile') || 0;
    await page.getByRole('link', { name: 'Torna al Profilo cittadino' }).click();
    await page.waitForURL(ORIGIN + '/profilo', { timeout: 15000 });
    await page.getByTestId('profilo-compasso-politico-link').click();
    await page.waitForURL(ORIGIN + '/compasso-politico', { timeout: 15000 });
    await page.getByText('Dati insufficienti', { exact: true }).first().waitFor({ timeout: 15000 });
    assert.equal(count.get('/api/opinioni/profile') || 0, answersGetAfterFirstOpen,
      'Reopening the compass under unchanged consent must not fetch opinions again');

    // Revoking consent on another device must hide the graph even when
    // the dedicated page is reloaded from a direct URL.
    granted = false;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Per visualizzare il compasso è necessario il consenso',
      { exact: false }).waitFor({ timeout: 15000 });
    assert.equal(await page.getByText('Dati insufficienti', { exact: true }).count(), 0,
      'Political compass must disappear after consent revocation');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log(JSON.stringify({ kind: 'persistent-local-profile', result: 'PASS', first, after,
      additionalProfileGets: after.reduce((sum, n, i) => sum + n - first[i], 0) }));
    await context.close();
  } finally {
    await browser.close();
  }
}
test().catch(err => { console.error(err); process.exitCode = 1; });
