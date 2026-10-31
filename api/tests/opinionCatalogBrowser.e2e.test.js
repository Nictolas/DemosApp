'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { getOpinionsForGrade } = require('../services/opinionCatalog');

const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '..');
const browserModule = process.env.DEMOS_PLAYWRIGHT_MODULE;
const HEADLESS_ORIGIN = 'http://localhost:3000';
const QA_USER_ID = 'qa-synthetic-opinions-user';

async function waitForLocal(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  throw Error('Local QA dev server did not become ready: ' + new URL(url).pathname);
}

test('real Chromium DOM: four official Opinions pages + verified save through candidate HTTP routes', {
  skip: !browserModule,
  timeout: 120000
}, async () => {
  // An isolated process and loopback Vite proxy are mandatory: no real DB URL,
  // real credentials, Render services or production traffic are involved.
  for (const key of ['DATABASE_URL','POSTGRES_URL','SUPABASE_DB_URL','SUPABASE_URL','PGHOST','PGDATABASE']) {
    assert.equal(process.env[key], undefined, 'Blocked database env in browser QA: ' + key);
  }
  const jwtPayload = Buffer.from(JSON.stringify({
    userId: QA_USER_ID, role: 'E', status: 'a',
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64');
  const token = 'eyJhbGciOiJIUzI1NiJ9.' + jwtPayload + '.qa-synthetic-not-a-real-jwt';
  assert.ok(token.length >= 48);
  const before = {
    mode: process.env.DEMOS_OPINIONS_QA_ONLY,
    token: process.env.DEMOS_OPINIONS_QA_TOKEN
  };
  process.env.DEMOS_OPINIONS_QA_ONLY = 'isolated-synthetic';
  process.env.DEMOS_OPINIONS_QA_TOKEN = token;

  let server, vite, browser, context;
  try {
    const { createQaApp } = require('../qa/opinionCatalogQaServer');
    const { chromium } = require(browserModule);
    server = http.createServer(createQaApp());
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      // The Vite proxy resolves localhost on both IPv4 and IPv6.
      server.listen(10000, resolve);
    });
    assert.equal(server.address().port, 10000);
    const viteBin = path.join(repoRoot, 'client/node_modules/vite/bin/vite.js');
    vite = spawn(process.execPath, [viteBin, '--config', 'vite.config.js', '--host', 'localhost', '--port', '3000', '--strictPort'], {
      cwd: path.join(repoRoot, 'client'),
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let viteErrors = '';
    vite.stderr.on('data', chunk => { viteErrors += String(chunk).slice(0, 4000); });
    await waitForLocal(HEADLESS_ORIGIN + '/');
    await waitForLocal('http://localhost:10000/healthz');
    // Validate reverse proxy separately, before booting the browser.
    const viaProxy = await fetch(HEADLESS_ORIGIN + '/api/opinioni-list?grado=N', {
      headers: { authorization: 'Bearer ' + token }
    });
    const viaProxyText = await viaProxy.text();
    assert.equal(viaProxy.status, 200, 'Vite proxy must route local synthetic API');
    assert.match(viaProxy.headers.get('content-type') || '', /application\/json/,
      'Unexpected Vite proxy response type: ' + viaProxyText.slice(0, 180));
    const viaProxyData = JSON.parse(viaProxyText);
    assert.equal(viaProxyData.data?.length, getOpinionsForGrade('N').length,
      'Vite proxy must return candidate published questions, not an HTML fallback');
    browser = await chromium.launch({
      channel: 'chrome', headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: 'block',
      permissions: []
    });
    await context.addInitScript(qaToken => {
      localStorage.setItem('auth_token', qaToken);
    }, token);
    const page = await context.newPage();
    // Fail closed: no test browser request may touch production, CDN,
    // authentication providers, real people or remote telemetry.
    const outside = [];
    await page.route('**/*', route => {
      const target = new URL(route.request().url());
      if (target.hostname === 'localhost' && target.port === '3000' && target.protocol === 'http:') {
        return route.continue();
      }
      outside.push(target.origin);
      return route.abort('blockedbyclient');
    });
    const grades = [
      ['N', '/opinioni-nazionali', 'Opinioni Nazionali', 'Favorevole', 'f'],
      ['R', '/opinioni-regionali', 'Opinioni Regionali', 'Contrario', 'c'],
      ['CO', '/opinioni-comunali', 'Opinioni Comunali', 'Indeciso', 'i'],
      ['E', '/opinioni-europee', 'Opinioni Europee', 'Favorevole', 'f']
    ];
    const savedByGrade = new Map();
    for (const [grade, route, heading, answerLabel, answerCode] of grades) {
      await page.goto(HEADLESS_ORIGIN + route, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.getByText(heading, { exact: true }).first().waitFor({ timeout: 25000 });
      try {
        await page.getByText(/Opinion da Inserire/).first().waitFor({ timeout: 25000 });
      } catch (error) {
        // The browser uses ONLY synthetic tokens, IDs and local hosts.
        // Never print authorization headers, cookies or answer payloads.
        const screen = (await page.locator('body').innerText()).slice(0, 1100);
        const direct = await page.evaluate(async ({ grade, token }) => {
          try {
            const res = await fetch('/api/opinioni-list?grado=' + grade, {
              headers: { authorization: 'Bearer ' + token }
            });
            const data = await res.json().catch(() => ({}));
            return { status: res.status, contentType: res.headers.get('content-type'),
              count: data?.data?.length || 0,
              grado: data?.grado || null, message: data?.message || null,
              error: data?.error || null };
          } catch (cause) {
            return { failure: String(cause?.message || cause) };
          }
        }, {grade, token});
        throw new Error('Browser page missing Opinions list; grade=' + grade +
          ', screen=' + JSON.stringify(screen) + ', synthetic_API=' + JSON.stringify(direct) +
          ', original=' + error.message);
      }
      const expectedCount = getOpinionsForGrade(grade).length;
      assert.ok(expectedCount > 0, grade + ': published questions needed for UI');
      // Some questions belong to multiple grades and may already have answers.
      const unanswered = page.locator('div.bg-blue-50').filter({
        has: page.getByRole('button', { name: 'Favorevole', exact: true })
      });
      const answered = page.locator('div.bg-green-50').filter({
        has: page.getByRole('button', { name: 'Favorevole', exact: true })
      });
      assert.equal(await unanswered.count() + await answered.count(), expectedCount,
        grade + ': all official question cards must be rendered');
      assert.ok(await unanswered.count() > 0, grade + ': requires an unanswered synthetic question');
      const first = unanswered.first();
      const questionText = await first.locator('h3').first().innerText();
      const candidate = getOpinionsForGrade(grade).find(x => x.text === questionText);
      assert.ok(candidate, grade + ': rendered question must match the official catalog');
      const selectedId = candidate.id;
      await first.getByRole('button', { name: answerLabel, exact: true }).click();
      const savedResponse = page.waitForResponse(response =>
        response.url().includes('/api/opinioni/salva') &&
        response.request().method() === 'POST',
        { timeout: 25000 }
      );
      await page.getByRole('button', { name: 'Salva le mie opinioni' }).click();
      const saved = await savedResponse;
      assert.equal(saved.status(), 200, grade + ': real UI must POST successfully');
      const posted = saved.request().postDataJSON();
      assert.equal(posted.opinioni[selectedId], answerCode,
        grade + ': UI must serialize the selected answer');
      assert.equal((await saved.json()).savedCount, 1,
        grade + ': exactly one synthetic answer must be saved');
      const readback = await page.evaluate(async ({ accessToken, grade }) => {
        const result = await fetch('/api/opinioni-list?grado=' + grade, {
          headers: { Authorization: 'Bearer ' + accessToken }
        });
        if (!result.ok) throw Error('Synthetic browser GET readback failed');
        return result.json();
      }, { accessToken: token, grade });
      assert.equal(readback.data.find(x => x.id === selectedId)?.userAnswer, answerCode,
        grade + ': browser must read back the saved answer');
      savedByGrade.set(grade, { id: selectedId, answer: answerCode });
    }
    assert.equal(savedByGrade.size, 4, 'Four real UI save/readback cycles must succeed');
    // Also exercise the real, shared opinion-detail dialog on a mobile viewport.
    // All requests still go to the loopback-only synthetic catalog API.
    await page.goto(HEADLESS_ORIGIN + '/opinioni-comunali', { waitUntil: 'domcontentloaded' });
    const fireworksButton = page.locator('button[title="Approfondimento: Fuochi d\'Artificio"]');
    await fireworksButton.waitFor({ timeout: 25000 });
    await fireworksButton.click();
    const details = page.getByRole('dialog');
    await details.waitFor({ timeout: 10000 });
    await details.getByText('Approfondimento: Fuochi d\'Artificio').waitFor();
    const readOnlyDetails = details.getByTestId('opinion-brief');
    await readOnlyDetails.getByText(/Irlanda/).first().waitFor({ timeout: 10000 });
    // Readable semantic headings supplement the color contrast for accessibility.
    await readOnlyDetails.getByRole('heading', { name: 'A favore' }).waitFor();
    await readOnlyDetails.getByRole('heading', { name: 'Contro' }).waitFor();
    const proConColors = await readOnlyDetails.evaluate(root => {
      const color = selector => getComputedStyle(root.querySelector(selector)).backgroundColor;
      return { pro: color('[data-testid="opinion-brief-pro"]'), con: color('[data-testid="opinion-brief-con"]') };
    });
    const rgb = value => (value.match(/\\d+/g) || []).slice(0, 3).map(Number);
    const [proR, proG] = rgb(proConColors.pro);
    const [conR, conG] = rgb(proConColors.con);
    assert.ok(proG > proR, 'Pro card must visibly have a green background');
    assert.ok(conR > conG, 'Con card must visibly have a red background');
    const richText = await readOnlyDetails.innerText();
    assert.match(richText, /🇮🇹 Italia/, 'Italy flag renders only in the detail view');
    assert.match(richText, /🇮🇪 Irlanda/, 'Ireland flag renders only in the detail view');
    assert.ok(richText.includes('2232/2025'), 'Verified legal fact remains readable');
    assert.doesNotMatch(richText, /📝/, 'Document emoji must not consume detail width');
    assert.equal(await details.getByRole('button', { name: 'Modifica approfondimento' }).count(), 0);
    const sourceDisclosure = readOnlyDetails.locator('details');
    assert.equal(await sourceDisclosure.evaluate(n => n.open), false, 'Sources start collapsed');
    await sourceDisclosure.locator('summary').click();
    assert.equal(await sourceDisclosure.evaluate(n => n.open), true, 'Sources expand on demand');
    assert.ok(await sourceDisclosure.locator('a[href^="https://"]').count() >= 2);
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
      await page.setViewportSize(viewport);
      // Playwright applies viewport resizing before Chrome necessarily repaints the dialog.
      // Wait for the real responsive layout rather than measuring a stale previous frame.
      await page.waitForFunction(size => {
        const element = document.querySelector('[role="dialog"]');
        if (!element) return false;
        const box = element.getBoundingClientRect();
        return Math.abs(box.width - size.width) <= 2 && Math.abs(box.height - size.height) <= 2;
      }, viewport, { timeout: 7000 });
      const layout = await details.evaluate(element => {
        const root = element.getBoundingClientRect();
        const header = element.querySelector('h1, h2, h3')?.getBoundingClientRect();
        const footer = Array.from(element.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Chiudi')?.getBoundingClientRect();
        const scrolling = Array.from(element.querySelectorAll('*')).find(n => {
          const style = getComputedStyle(n);
          return style.overflowY === 'auto' && n.scrollHeight > n.clientHeight;
        });
        if (!scrolling) return { root: { x: root.x, y: root.y, width: root.width, height: root.height }, header, footer, scrollable: false };
        scrolling.scrollTop = scrolling.scrollHeight;
        return {
          root: { x: root.x, y: root.y, width: root.width, height: root.height },
          header: header ? { top: header.top, bottom: header.bottom } : null,
          footer: footer ? { top: footer.top, bottom: footer.bottom } : null,
          scrollable: true,
          scrollBottomReached: scrolling.scrollTop > 0,
        };
      });
      assert.ok(Math.abs(layout.root.x) <= 1 && Math.abs(layout.root.y) <= 1, 'Dialog starts at viewport origin');
      assert.ok(Math.abs(layout.root.width - viewport.width) <= 2,
        'Dialog fills viewport width: ' + JSON.stringify({ viewport, layout }));
      assert.ok(Math.abs(layout.root.height - viewport.height) <= 2, 'Dialog fills viewport height');
      assert.ok(layout.header && layout.header.top >= 0, 'Header remains visible');
      assert.ok(layout.footer && layout.footer.bottom <= viewport.height + 1, 'Close button remains visible');
      assert.equal(layout.scrollable, true, 'Content scroll container must exist');
      assert.equal(layout.scrollBottomReached, true, 'Long details can scroll to the end');
    }
    await details.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await details.waitFor({ state: 'hidden' });

    // The other four pilot topics share exactly the same visual renderer;
    // legacy catalogue entries must continue to use their Markdown renderer.
    const pilotCases = [
      ['/opinioni-nazionali', 'Abolizione Contante', '2021'],
      ['/opinioni-nazionali', 'Eutanasia', '242/2019'],
      ['/opinioni-nazionali', 'Energia nucleare', '≈9.000 $/kW'],
      ['/opinioni-regionali', 'Caccia', '157/1992'],
    ];
    for (const [path, title, fact] of pilotCases) {
      await page.goto(HEADLESS_ORIGIN + path, { waitUntil: 'domcontentloaded' });
      const trigger = page.locator('button[title="Approfondimento: ' + title + '"]');
      await trigger.waitFor({ timeout: 25000 });
      await trigger.click();
      const dialog = page.getByRole('dialog');
      const brief = dialog.getByTestId('opinion-brief');
      await brief.waitFor({ timeout: 12000 });
      assert.equal(await brief.getByRole('heading', { name: 'A favore' }).count(), 1, title + ': clear green pro label');
      assert.equal(await brief.getByRole('heading', { name: 'Contro' }).count(), 1, title + ': clear red con label');
      assert.equal(await brief.getByTestId('opinion-brief-pro').count(), 1);
      assert.equal(await brief.getByTestId('opinion-brief-con').count(), 1);
      assert.ok((await brief.innerText()).includes(fact), title + ': expected fact visible');
      assert.equal(await brief.locator('details').count(), 1, title + ': one source disclosure');
      assert.equal(await brief.locator('section').count() >= 2, true, title + ': pro and con shown');
      await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
    await page.goto(HEADLESS_ORIGIN + '/opinioni-nazionali', { waitUntil: 'domcontentloaded' });
    const legacy = page.locator('button[title="Approfondimento: Ius Soli"]');
    await legacy.waitFor({ timeout: 25000 });
    await legacy.click();
    const legacyDialog = page.getByRole('dialog');
    await legacyDialog.locator('.prose').first().waitFor({ timeout: 10000 });
    assert.equal(await legacyDialog.getByTestId('opinion-brief').count(), 0, 'Unconverted opinion keeps Markdown layout');
    await legacyDialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await legacyDialog.waitFor({ state: 'hidden' });

    assert.equal(outside.filter(x => x !== 'http://localhost:3000').length, outside.length);
    assert.ok(outside.every(x => !/demos\.community|onrender\.com/.test(x)),
      'No request may escape to DEMOS production');
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    if (vite) {
      vite.kill('SIGTERM');
      await new Promise(resolve => {
        if (vite.exitCode !== null) return resolve();
        vite.once('exit', resolve);
        setTimeout(resolve, 3000).unref();
      });
    }
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [key, value] of [
      ['DEMOS_OPINIONS_QA_ONLY', before.mode],
      ['DEMOS_OPINIONS_QA_TOKEN', before.token]
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
