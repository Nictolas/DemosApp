'use strict';

// Real Google Chrome DOM + production React components; all identity/API data
// are isolated synthetic fixtures intercepted on loopback. Never hit cloud.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const browserModule = process.env.DEMOS_PLAYWRIGHT_MODULE;
const root = path.resolve(__dirname, '../..');
const origin = 'http://localhost:3000';
const people = Object.freeze({
  tn: '00000000-0000-4000-8000-000000000901',
  bz: '00000000-0000-4000-8000-000000000902',
  candidateTN: '00000000-0000-4000-8000-000000000903',
  candidateBZ: '00000000-0000-4000-8000-000000000904',
});
const person = (id, country, province, consent = true) => ({
  id, nome: 'QA Resident', email: '', ruolo: 'E', status: 'a',
  paese_residenza: country, provincia_residenza: province,
  political_consent: { granted: consent, timestamp: consent ? '2026-11-07T00:00:00Z' : null },
});
const accounts = {
  tn: person(people.tn, 'IT', 'TN'),
  bz: person(people.bz, 'IT', 'BZ'),
  ordinary: person('00000000-0000-4000-8000-000000000905', 'IT', 'AR'),
  foreign: person('00000000-0000-4000-8000-000000000906', 'DE', 'TN'),
  revoked: person('00000000-0000-4000-8000-000000000907', 'IT', 'TN', false),
};
const candidate = (id, name, office) => ({
  id, nome: 'QA', cognome: name, ruolo: 'CP', status: 'a',
  grado_elezione: office, grado_candidatura: office, opinioni_comuni: 2,
  avatar_config: null,
});

async function ready(url) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return;
    } catch { /* Vite may still be booting. */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw Error('Chrome QA Vite did not become ready on localhost');
}

test('real Chrome: provincial Trento/Bolzano controls, consent/residence isolation, select and undo', {
  skip: !browserModule,
  timeout: 140000
}, async () => {
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'SUPABASE_DB_URL', 'PGHOST', 'PGDATABASE']) {
    assert.equal(process.env[key], undefined, 'No external DB credentials in Chrome QA: ' + key);
  }
  const { chromium } = require(browserModule);
  let vite, browser;
  try {
    vite = spawn(process.execPath, [path.join(root, 'client/node_modules/vite/bin/vite.js'),
      '--config', 'vite.config.js', '--host', 'localhost', '--port', '3000', '--strictPort'], {
      cwd: path.join(root, 'client'),
      env: {
        ...process.env, NODE_ENV: 'development',
        VITE_DEMOS_PROVINCIAL_SELECTIONS_GO: 'true',
        VITE_API_BASE_URL: '',
        VITE_API_URL: ''
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    vite.stderr.on('data', part => { stderr += String(part).slice(0, 2500); });
    await ready(origin + '/');
    browser = await chromium.launch({
      channel: 'chrome', headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const outside = [];
    const selection = new Map();
    const mutationAudit = [];
    const key = (owner, kind, office) => owner + ':' + kind + ':' + office;

    async function pageFor(account) {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        serviceWorkers: 'block', permissions: [],
      });
      const payload = Buffer.from(JSON.stringify({
        userId: account.id, role: 'E', status: 'a', exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64');
      const token = 'eyJhbGciOiJIUzI1NiJ9.' + payload + '.qa-local-only-unsigned';
      await ctx.addInitScript(t => localStorage.setItem('auth_token', t), token);
      const page = await ctx.newPage();
      await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) {
          outside.push(url.origin);
          return route.abort('blockedbyclient');
        }
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const json = (body, status = 200) => route.fulfill({
          status, contentType: 'application/json; charset=utf-8',
          headers: { 'cache-control': 'no-store' },
          body: JSON.stringify(body)
        });
        if (request.headers()['authorization'] !== 'Bearer ' + token) {
          return json({ success: false, error: 'QA_AUTH_REQUIRED' }, 401);
        }
        const pathname = url.pathname;
        if (pathname === '/api/auth/me' || pathname === '/api/users/me')
          return json({ success: true, user: account });
        if (pathname === '/api/user/political-opinions-consent')
          return json({ success: true, consent: account.political_consent });
        if (pathname === '/api/rappresentanti')
          return json({ success: true, data: { rappresentanti: {}, idMap: {} } });
        if (pathname === '/api/candidati')
          return json({ success: true, data: { candidati: {}, idMap: {} } });
        if (pathname.startsWith('/api/opinioni/check-missing/'))
          return json({ success: true, data: { isComplete: true, missing: [] } });
        if (pathname === '/api/rappresentanti/disponibili' ||
            pathname === '/api/candidati/disponibili') {
          const office = url.searchParams.get('grado_elezione') ||
                         url.searchParams.get('grado_candidatura');
          const allowed = account.political_consent.granted &&
            account.paese_residenza === 'IT' &&
            ((account.provincia_residenza === 'TN' && office === 'it.provincial.trento') ||
             (account.provincia_residenza === 'BZ' && office === 'it.provincial.bolzano'));
          const rows = allowed ? [candidate(
            office.endsWith('trento') ? people.candidateTN : people.candidateBZ,
            office.endsWith('trento') ? 'Politico Trento' : 'Politico Bolzano',
            office
          )] : [];
          return json({ success: true,
            data: pathname.includes('/candidati/')
              ? rows : { candidati: rows, utente: {} } });
        }
        const match = pathname.match(/^\/api\/users\/([^/]+)\/(provincial-selection|political-selection)$/);
        if (match) {
          if (match[1] !== account.id) return json({ success: false, error: 'QA_WRONG_ACCOUNT' }, 403);
          if (request.method() === 'GET' && match[2] === 'provincial-selection') {
            const k = key(account.id, url.searchParams.get('kind'), url.searchParams.get('officeId'));
            return json({ success: true,
              selection: selection.has(k) ? { selectedUserId: selection.get(k) } : null });
          }
          if (request.method() === 'PUT' && match[2] === 'political-selection') {
            const body = request.postDataJSON();
            const expectedOffice = account.provincia_residenza === 'TN'
              ? 'it.provincial.trento' : 'it.provincial.bolzano';
            const valid = account.paese_residenza === 'IT' &&
              account.political_consent.granted &&
              body.officeId === expectedOffice &&
              ['representative', 'candidate'].includes(body.kind);
            mutationAudit.push({ owner: account.id, kind: body.kind,
              office: body.officeId, clear: body.selectedUserId === null, valid });
            if (!valid) return json({ success: false, error: 'OFFICE_OUTSIDE_USER_TERRITORY' }, 403);
            const expectedPerson = expectedOffice.endsWith('trento')
              ? people.candidateTN : people.candidateBZ;
            if (body.selectedUserId !== null && body.selectedUserId !== expectedPerson)
              return json({ success: false, error: 'INELIGIBLE_PERSON' }, 403);
            const k = key(account.id, body.kind, body.officeId);
            if (body.selectedUserId === null) selection.delete(k);
            else selection.set(k, body.selectedUserId);
            return json({ success: true });
          }
        }
        return json({ success: false, error: 'UNSUPPORTED_SYNTHETIC_API' }, 404);
      });
      return { page, ctx };
    }

    const tn = await pageFor(accounts.tn);
    try {
      await tn.page.goto(origin + '/rappresentanti', { waitUntil: 'domcontentloaded' });
      await tn.page.getByRole('button', {
        name: 'Scegli rappresentante per il Consiglio provinciale di Trento',
      }).waitFor({ timeout: 25000 });
      assert.equal(await tn.page.getByText('Consiglio provinciale di Bolzano').count(), 0);
      await tn.page.goto(origin + '/scegli-rappresentante/provinciale-trento',
        { waitUntil: 'domcontentloaded' });
      await tn.page.getByText('QA Politico Trento').first().waitFor({ timeout: 25000 });
      await tn.page.getByRole('button', { name: 'Scegli', exact: true }).click();
      assert.equal(selection.get(key(people.tn, 'representative', 'it.provincial.trento')),
        people.candidateTN, 'Real React chooser must send canonical PUT');
      await tn.page.goto(origin + '/scegli-rappresentante/provinciale-trento',
        { waitUntil: 'domcontentloaded' });
      const clear = tn.page.getByRole('button', { name: 'Annulla scelta provinciale' });
      await clear.waitFor({ timeout: 25000 });
      await clear.click();
      assert.equal(selection.has(key(people.tn, 'representative', 'it.provincial.trento')),
        false, 'Clear must call canonical PUT with selectedUserId null');
    } finally { await tn.ctx.close(); }

    const bz = await pageFor(accounts.bz);
    try {
      await bz.page.goto(origin + '/rappresentanti', { waitUntil: 'domcontentloaded' });
      await bz.page.getByRole('button', {
        name: 'Scegli rappresentante per il Consiglio provinciale di Bolzano',
      }).waitFor({ timeout: 25000 });
      assert.equal(await bz.page.getByText('Consiglio provinciale di Trento').count(), 0);
      await bz.page.goto(origin + '/scegli-rappresentante/provinciale-bolzano',
        { waitUntil: 'domcontentloaded' });
      await bz.page.getByText('QA Politico Bolzano').first().waitFor({ timeout: 25000 });
    } finally { await bz.ctx.close(); }

    for (const user of [accounts.ordinary, accounts.foreign, accounts.revoked]) {
      const { page, ctx } = await pageFor(user);
      try {
        await page.goto(origin + '/rappresentanti', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /Scegli rappresentante per il Consiglio provinciale/ })
          .first().waitFor({ state: 'hidden', timeout: 25000 });
        assert.equal(await page.locator('.provincial-office-choice').count(), 0,
          'No provincial chooser for ordinary/foreign/no-consent account');
      } finally { await ctx.close(); }
    }
    assert.ok(mutationAudit.some(x => x.owner === people.tn && !x.clear && x.valid));
    assert.ok(mutationAudit.some(x => x.owner === people.tn && x.clear && x.valid));
    assert.equal(outside.filter(x => /demos\.community|onrender\.com/i.test(x)).length, 0,
      'No browser request may reach DEMOS production or hosted staging');
  } finally {
    if (browser) await browser.close();
    if (vite) {
      vite.kill('SIGTERM');
      await new Promise(resolve => {
        if (vite.exitCode !== null) return resolve();
        vite.once('exit', resolve);
        setTimeout(resolve, 3000).unref();
      });
    }
  }
});
