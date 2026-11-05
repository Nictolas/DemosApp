'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

// Derive synthetic answers from the actual versioned model. Every one of
// the 28 mapped questions receives a definite response that scores +100.
const modelSource = fs.readFileSync(path.join(__dirname, '../client/src/lib/politicalCompassModel.ts'), 'utf8');
const fullCompassAnswers = Object.fromEntries(
  Array.from(modelSource.matchAll(/\{\s*id:\s*"([^"]+)",\s*label:\s*"[^"]+",\s*axis:\s*"(economia|liberta)",\s*direction:\s*(-?1)\s*\}/g),
    ([, id, , sign]) => [id, sign === '1' ? 'f' : 'c']),
);
assert.equal(Object.keys(fullCompassAnswers).length, 28);

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
    let stagedCompassAnswers = fullCompassAnswers;
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
            questions: Object.keys(stagedCompassAnswers).map(id => ({id,text:'Domanda sintetica '+id})),
            ...(u.searchParams.get('includeAnswers') === '1'
              ? {userAnswers:stagedCompassAnswers} : {}),
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
    // A full set of already SAVED synthetic opinions must produce the dot.
    // The old catalog-only response silently created a 0/16 + 0/12 screen.
    await page.getByRole('img', { name: /Posizione stimata su due assi/ }).waitFor({ timeout: 15000 });
    const compassFigure = page.getByRole('img', { name: /Posizione stimata su due assi/ });
    assert.equal(await compassFigure.locator('circle[r="9"]').count(), 1,
      'The classic compass position must still render from saved answers');

    // The public methodology disclosure was deliberately removed.
    // On mobile, five thematic indicators must instead appear below the
    // traditional compass without requesting additional private data.
    const compassMain = page.locator('main[aria-label="Compasso politico personale"]');
    const experimentalNotice = compassMain.locator('[role="note"][aria-label="Sezione sperimentale"]');
    await experimentalNotice.waitFor({ timeout: 15000 });
    assert.equal(await experimentalNotice.getByText('Sezione sperimentale', { exact: true }).count(), 1,
      'Only one global experimental notice should be visible');
    assert.equal(await compassMain.getByText('Sperimentale', { exact: true }).count(), 0,
      'Experimental badges must not repeat under each thematic axis');
    assert.equal(await compassMain.getByRole('heading', { name: 'Libertà individuali' }).count(), 0,
      'The redundant individual-freedoms score card must be removed');
    assert.equal(await compassMain.getByRole('heading', { name: 'Economia', exact: true }).count(), 1,
      'Only the thematic economy axis should have this heading');
    const orientationSection = compassMain.locator('section[aria-label="I tuoi orientamenti politici"]');
    await orientationSection.waitFor({ timeout: 15000 });
    for (const name of ['Economia', 'Stato', 'Costumi', 'Ambiente', 'Immigrazione']) {
      await orientationSection.getByRole('heading', { name, exact: true }).waitFor();
    }
    assert.equal(await orientationSection.getByRole('heading').count(), 6,
      'Five thematic axes plus their section heading must be rendered');
    assert.ok(await orientationSection.locator('[role="meter"]').count() >= 2,
      'Known synthetic answers should yield at least the economy and state indicators');
    assert.ok(await orientationSection.getByText('Dati insufficienti', { exact: false }).count() >= 1,
      'Unanswered thematic axes must not fabricate a score');
    assert.equal(await compassMain.getByText('Quali Opinioni vengono usate e come?').count(), 0,
      'The obsolete methodology disclosure must stay absent from the UI');
    const scrollMetrics = await compassMain.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    assert.ok(scrollMetrics.scrollHeight > scrollMetrics.clientHeight,
      'Compass and thematic axes must be scrollable in the mobile viewport');
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
    await page.getByRole('img', { name: /Posizione stimata su due assi/ }).waitFor({ timeout: 15000 });
    assert.equal(count.get('/api/opinioni/profile') || 0, answersGetAfterFirstOpen,
      'Reopening the compass under unchanged consent must not fetch opinions again');

    // Revoking consent on another device must hide the graph even when
    // the dedicated page is reloaded from a direct URL.
    granted = false;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Per visualizzare il compasso è necessario il consenso',
      { exact: false }).waitFor({ timeout: 15000 });
    assert.equal(await page.getByRole('img', { name: /Posizione stimata su due assi/ }).count(), 0,
      'Political compass must disappear after consent revocation');
    // Fresh, separately authorized synthetic answers. A single definite
    // Opinion must provide a visible DRAFT without inventing the other axis.
    granted = true;
    version = '2026-10-29T15:00:00Z';
    stagedCompassAnswers = { patrimoniale: 'f' };
    await page.goto(ORIGIN + '/compasso-politico', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('compass-draft-economy-line').waitFor({ timeout: 15000 });
    assert.equal(await page.getByTestId('compass-draft-freedom-line').count(), 0);
    assert.equal(await page.getByTestId('compass-draft-point').count(), 0);
    assert.ok(await page.locator('section[aria-label="I tuoi orientamenti politici"]')
      .getByText('Bozza provvisoria', { exact: false }).count() > 0,
      'A single relevant thematic Opinion must display a provisional bar');
    const afterSingleOpinion = count.get('/api/opinioni/profile') || 0;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('compass-draft-economy-line').waitFor({ timeout: 15000 });
    assert.equal(count.get('/api/opinioni/profile') || 0, afterSingleOpinion,
      'Reopening a single-answer draft must not fetch the Opinions again');

    // A one-answer liberty score projects to a HORIZONTAL guide.
    version = '2026-10-29T16:00:00Z';
    stagedCompassAnswers = { eutanasia: 'f' };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('compass-draft-freedom-line').waitFor({ timeout: 15000 });
    assert.equal(await page.getByTestId('compass-draft-economy-line').count(), 0);

    // After one mapped response on each dimension, a hollow point can be
    // drawn, still explicitly provisional until the original thresholds pass.
    version = '2026-10-29T17:00:00Z';
    stagedCompassAnswers = { patrimoniale: 'f', eutanasia: 'f' };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('compass-draft-point').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('circle[r="9"]').count(), 0,
      'The qualified dark dot must not appear for a two-response draft');

    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log(JSON.stringify({ kind: 'persistent-local-profile', result: 'PASS', first, after,
      additionalProfileGets: after.reduce((sum, n, i) => sum + n - first[i], 0) }));
    await context.close();
  } finally {
    await browser.close();
  }
}
test().catch(err => { console.error(err); process.exitCode = 1; });
