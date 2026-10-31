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
    const rgb = value => (value.match(/[0-9]+/g) || []).slice(0, 3).map(Number);
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
      ['/opinioni-nazionali', 'Abolizione Contante', 'Solo digitale'],
      ['/opinioni-nazionali', 'Legalizzazione canapa', '58,2% → 6,7%'],
      ['/opinioni-nazionali', 'Salario minimo', '2.771 €'],
      ['/opinioni-comunali', 'Città 30', '−43,6%'],
      ['/opinioni-europee', 'Auto a emissioni zero dal 2035', '−28%'],
      ['/opinioni-nazionali', 'Settimana lavorativa di 32 ore', '92%'],
      ['/opinioni-nazionali', 'Matrimonio gay', '2.936'],
      ['/opinioni-comunali', 'Trasporto pubblico gratuito', '+88%'],
      ['/opinioni-nazionali', 'Reddito di Cittadinanza', '1,37 mln'],
      ['/opinioni-regionali', 'Nuovi parchi eolici', '21.360 GWh'],
      ['/opinioni-comunali', 'Raccolta rifiuti porta a porta', '71,34% → 80,93%'],
      ['/opinioni-nazionali', 'Potenziare Rinnovabili', '44,3 TWh'],
      ['/opinioni-regionali', 'Nuovi inceneritori', '5,5 mln t'],
      ['/opinioni-comunali', 'Asili nido gratuiti', '527,27 €/mese'],
      ['/opinioni-nazionali', 'Patrimoniale', '36 mld NOK'],
      ['/opinioni-regionali', 'Nuove centrali geotermiche', '5.644,3 GWh'],
      ['/opinioni-comunali', 'Nuove piste ciclabili', '+28,8%'],
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
      if (title === 'Abolizione Contante') {
        assert.equal(await brief.locator('[aria-label="Dati chiave"]').count(), 0,
          'No context-free 21/2021 fact cards for cash abolition');
        assert.equal(await brief.getByText('Oggi → proposta', { exact: true }).count(), 1);
        const comparison = brief.getByTestId('opinion-brief-comparison');
        const arrow = brief.getByTestId('opinion-brief-transition-arrow');
        await arrow.waitFor();
        const positions = await comparison.evaluate(node =>
          Array.from(node.children).map(child => {
            const box = child.getBoundingClientRect();
            return box.left + box.width / 2;
          })
        );
        assert.equal(positions.length, 3, 'Current, arrow and proposal in three columns');
        assert.ok(positions[0] < positions[1] && positions[1] < positions[2],
          'Transition arrow must be between the current and proposed states');
        const intro = brief.getByText(/Eliminare banconote e monete dai pagamenti/);
        const fontSize = await intro.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize));
        assert.ok(fontSize >= 16, 'In breve must be readable on mobile without zooming');
        assert.doesNotMatch(await brief.innerText(), /21 Paesi|Sentenza UE sul corso legale/);
      } else if (title === 'Legalizzazione canapa') {
        const legal = brief.getByTestId('opinion-brief-legal-status');
        const outcomes = brief.getByTestId('opinion-brief-measured-results');
        await legal.waitFor();
        await outcomes.waitFor();
        assert.equal(await legal.getByTestId('opinion-brief-country').count(), 4,
          'Canada, Uruguay, Germany and Italy require separate legal statuses');
        const colors = await legal.getByTestId('opinion-brief-country').evaluateAll(cards =>
          cards.map(card => ({
            country: card.querySelector('p')?.textContent?.trim(),
            status: card.getAttribute('data-legal-status'),
            bg: getComputedStyle(card).backgroundColor,
          }))
        );
        const channels = color => (color.match(/[0-9]+/g) || []).slice(0, 3).map(Number);
        const expected = [
          ['Canada', 'regulated'], ['Uruguay', 'regulated'],
          ['Germania', 'limited'], ['Italia', 'prohibited'],
        ];
        for (const [name, status] of expected) {
          const card = colors.find(x => x.country?.includes(name));
          assert.equal(card?.status, status, name + ': status classification');
          const [red, green, blue] = channels(card.bg);
          assert.ok([red, green, blue].every(Number.isFinite), name + ': visible color available');
          if (status === 'regulated') assert.ok(green > red && green > blue, name + ': green background');
          if (status === 'limited') assert.ok(red > blue && green > blue, name + ': amber background');
          if (status === 'prohibited') assert.ok(red > green && red > blue, name + ': red background');
        }
        assert.equal(await outcomes.getByTestId('opinion-brief-result').count(), 4,
          'Only four key results initially visible');
        const labels = await legal.innerText();
        for (const name of ['Canada', 'Uruguay', 'Germania', 'Italia']) {
          assert.ok(labels.includes(name), 'Missing legal jurisdiction ' + name);
        }
        const measured = await outcomes.innerText();
        assert.ok(measured.includes('2,5 mld CAD'), 'Public revenue is quantified');
        assert.ok(measured.includes('37% → 72%'), 'Legal source trend is quantified');
        assert.ok(measured.includes('16% → 3%'), 'Illegal source trend is quantified');
        assert.ok(measured.includes('58,2% → 6,7%'), 'Uruguay traditional trade trend is quantified');
        assert.ok(measured.includes('non dimostrano un calo della criminalità generale'),
          'No causal crime reduction claim');
        const caveat = outcomes.locator('details');
        assert.equal(await caveat.evaluate(el => el.open), false, 'Supplementary data start collapsed');
        await caveat.locator('summary').click();
        assert.ok((await caveat.innerText()).includes('14% → 17%'), 'Health data appears on expansion');
        const position = await brief.evaluate(root => {
          const selectors = [
            '[data-testid="opinion-brief-intro"]',
            '[data-testid="opinion-brief-comparison"]',
            '[data-testid="opinion-brief-legal-status"]',
            '[data-testid="opinion-brief-measured-results"]',
          ];
          return selectors.map(q => root.querySelector(q)?.getBoundingClientRect().top);
        });
        assert.ok(position.every(Number.isFinite), 'All four modules must exist');
        assert.ok(position.every((v, i) => i === 0 || position[i-1] < v),
          'Intro, reform, legal status and observed outcomes must be distinct ordered sections');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 1,
          'Arrow applies only to the Italian before/after, not to country comparisons');
      } else if (['Salario minimo', 'Città 30', 'Auto a emissioni zero dal 2035'].includes(title)) {
        const outcomes = brief.getByTestId('opinion-brief-measured-results');
        await outcomes.waitFor();
        const data = await outcomes.innerText();
        assert.ok(await outcomes.getByTestId('opinion-brief-result').count() >= 2,
          title + ': at least two visible source-linked results');
        assert.ok(await outcomes.locator('a[href^="https://"]').count() >= 2,
          title + ': every metric has a source link');
        const panelPositions = await brief.evaluate(root => {
          const nodes = [
            root.querySelector('[data-testid="opinion-brief-intro"]'),
            root.querySelector('[data-testid="opinion-brief-comparison"]'),
            root.querySelector('[data-testid="opinion-brief-measured-results"]'),
          ];
          return nodes.map(el => el?.getBoundingClientRect().top);
        });
        assert.ok(panelPositions.every(Number.isFinite), title + ': all sections exist');
        assert.ok(panelPositions[0] < panelPositions[1] && panelPositions[1] < panelPositions[2],
          title + ': definition first, comparison second, data third');
        if (title === 'Salario minimo') {
          assert.ok(data.includes('22 su 27') && data.includes('620 €') && data.includes('2.771 €'),
            'Eurostat July 2026 cross-country data visible');
          assert.ok(data.includes('1 luglio 2026'), 'Observed wage dates are explicit');
          assert.ok(data.includes('non prove degli effetti su occupazione o povertà'),
            'No unsupported wage causality claim');
        }
        if (title === 'Città 30') {
          assert.ok(data.includes('−12,5%') && data.includes('−7,2%') && data.includes('−43,6%'),
            'Bologna 2022/23 vs 2024/25 data visible');
          assert.ok(data.includes('non isolano l\'effetto del limite'), 'Causality caveat visible');
        }
        if (title === 'Auto a emissioni zero dal 2035') {
          assert.ok(data.includes('−28%') && data.includes('14,5%'),
            'EU 2019/24 emissions and 2024 new registrations visible');
          assert.ok(data.includes('proposta, non la regola vigente'),
            'Proposed 90 percent policy not confused with in-force 100 percent rule');
        }
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Città 30' ? 0 : 1,
          title + ': arrow only when a before-to-proposal transition exists');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': country status maps must not be invented for unrelated topics');
      } else if (['Settimana lavorativa di 32 ore', 'Matrimonio gay', 'Trasporto pubblico gratuito'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.ok(await results.getByTestId('opinion-brief-result').count() >= 2,
          title + ': at least two metrics with source links');
        assert.ok(await results.locator('a[href^="https://"]').count() >= 2,
          title + ': two official evidence links');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 1,
          title + ': arrow only shows current-to-proposal reform');
        const panels = await brief.evaluate(root => [
          root.querySelector('[data-testid="opinion-brief-intro"]'),
          root.querySelector('[data-testid="opinion-brief-comparison"]'),
          root.querySelector('[data-testid="opinion-brief-measured-results"]'),
        ].map(el => el?.getBoundingClientRect().top));
        assert.ok(panels.every(Number.isFinite) && panels[0] < panels[1] && panels[1] < panels[2],
          title + ': explanation, reform and evidence in distinct ordered blocks');
        if (title === 'Settimana lavorativa di 32 ore') {
          assert.ok(data.includes('92%') && data.includes('71%') && data.includes('39%'),
            'UK company adoption and workers self-reports appear with correct populations');
          assert.ok(data.includes('56 aziende su 61'), 'Denominator for UK company percent shown');
          assert.ok(data.includes('non tutte le aziende hanno adottato esattamente 32 ore'),
            'The pilot does not uniformly equal a 32-hour week');
        }
        if (title === 'Matrimonio gay') {
          const laws = brief.getByTestId('opinion-brief-legal-status');
          assert.equal(await laws.getByTestId('opinion-brief-country').count(), 4,
            'Netherlands, Spain, Germany and Italy law cards');
          const italy = laws.locator('[data-legal-status="limited"]');
          assert.equal(await italy.count(), 1, 'Italy civil unions classified as limited, not criminalized');
          const regulated = laws.locator('[data-legal-status="regulated"]');
          assert.equal(await regulated.count(), 3, 'Three countries with civil marriage');
          assert.ok(data.includes('2.936') && data.includes('72%'),
            'ISTAT unions 2024 and EU survey 2023 are distinct figures');
          assert.ok(data.includes('è un sondaggio, non una conseguenza della legge'),
            'Public opinion survey is not conflated with law effects');
        } else {
          assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
            title + ': legal status map only when legally relevant');
        }
        if (title === 'Trasporto pubblico gratuito') {
          assert.ok(data.includes('+88%') && data.includes('25 → 31,3 mln') && data.includes('6,2 → 31,7 mln'),
            'Dunkerque and Luxembourg use exact periods and results');
          assert.ok(data.includes('non attribuisce alla sola gratuità'),
            'Service expansion and pandemic caveat must be visible');
        }
      } else if (['Reddito di Cittadinanza', 'Nuovi parchi eolici', 'Raccolta rifiuti porta a porta'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const stats = await results.innerText();
        const cards = results.getByTestId('opinion-brief-result');
        assert.ok(await cards.count() >= 3, title + ': measurable sourced data cards');
        assert.ok(await results.locator('a[href^="https://"]').count() >= 3,
          title + ': metric links should be inspectable');
        const blocks = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(k => root.querySelector('[data-testid="' + k + '"]')?.getBoundingClientRect().top));
        assert.ok(blocks.every(Number.isFinite) && blocks[0] < blocks[1] && blocks[1] < blocks[2],
          title + ': intro first, comparison second, data third');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': do not invent legally classified countries');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Reddito di Cittadinanza' ? 1 : 0,
          title + ': only actual current-to-proposed policy has an arrow');
        if (title === 'Reddito di Cittadinanza') {
          assert.ok(stats.includes('1,37 mln') && stats.includes('562,75 €')
            && stats.includes('690 mila') && stats.includes('672 €'),
            'INPS data must keep distinct programmes and dates');
          assert.ok(stats.includes('l\'intero 2023') && stats.includes('solo giugno 2026'),
            'Do not treat annual and monthly beneficiaries as directly comparable');
        }
        if (title === 'Nuovi parchi eolici') {
          assert.ok(stats.includes('13,5 GW') && stats.includes('21.360 GWh')
            && stats.includes('3.674 MW') && stats.includes('2.512 MW'),
            'Installed capacity, electricity generation and regional capacity distinct');
          assert.ok(stats.includes('non prevedono produzione o impatti'),
            'Observed generation cannot forecast a specific new site');
        }
        if (title === 'Raccolta rifiuti porta a porta') {
          assert.ok(stats.includes('71,34% → 80,93%') && stats.includes('67,69%')
            && stats.includes('52,55% → 67,69%'),
            'Parma and Italy collection shares with date ranges');
          assert.ok(stats.includes('NON equivale alla quota di rifiuti effettivamente riciclati'),
            'Source separation versus actual recycling must be distinguished');
        }
      } else if (['Potenziare Rinnovabili', 'Nuovi inceneritori', 'Asili nido gratuiti'].includes(title)) {
        const evidence = brief.getByTestId('opinion-brief-measured-results');
        await evidence.waitFor({ timeout: 12000 });
        const stats = await evidence.innerText();
        const cards = evidence.getByTestId('opinion-brief-result');
        assert.ok(await cards.count() >= 3, title + ': at least 3 source-linked metrics visible');
        assert.ok(await evidence.locator('a[href^="https://"]').count() >= 3,
          title + ': each metric links to the underlying source');
        const blocks = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(k => root.querySelector('[data-testid="' + k + '"]')?.getBoundingClientRect().top));
        assert.ok(blocks.every(Number.isFinite) && blocks[0] < blocks[1] && blocks[1] < blocks[2],
          title + ': clear explanation, comparison and evidence separation');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': do not invent an irrelevant cross-country legality section');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Nuovi inceneritori' ? 0 : 1,
          title + ': directional arrow only for change in policy, not parallel types of treatment');

        if (title === 'Potenziare Rinnovabili') {
          assert.ok(stats.includes('41%') && stats.includes('44,3 TWh') &&
            stats.includes('57,1 GW'), 'Renewables share, electricity generated and installed power');
          assert.ok(stats.includes('42% nel 2024') && stats.includes('25,1% rispetto al 2024'),
            'Observed dates and comparison periods displayed');
          assert.ok(stats.includes('Potenza in GW e produzione in TWh non sono confrontabili direttamente'),
            'Power and energy are distinguished, with source context');
        }
        if (title === 'Nuovi inceneritori') {
          assert.ok(stats.includes('35') && stats.includes('5,5 mln t') &&
            stats.includes('74,8%') && stats.includes('25 / 4 / 6'),
            'ISPRA national waste incineration totals and geographic distribution');
          assert.ok(stats.includes('non dimostrano che costruirne altri ridurrebbe emissioni'),
            'Existing incinerator activity is not evidence of new plant benefits');
        }
        if (title === 'Asili nido gratuiti') {
          assert.ok(stats.includes('40.000 €') && stats.includes('527,27 €/mese') &&
            stats.includes('31,6') && stats.includes('59,5%'),
            'Tuscany financial limits and ISTAT daycare capacity and waiting lists');
          assert.ok(stats.includes('Percentuale di strutture con almeno una lista d\'attesa'),
            'Waitlists are measured as facilities, not children');
          assert.ok(stats.includes('non è gratuità universale'),
            'Regional measure not conflated with universal free municipal nurseries');
        }
      } else if (['Patrimoniale', 'Nuove centrali geotermiche', 'Nuove piste ciclabili'].includes(title)) {
        const evidence = brief.getByTestId('opinion-brief-measured-results');
        await evidence.waitFor({ timeout: 12000 });
        const data = await evidence.innerText();
        const resultCards = evidence.getByTestId('opinion-brief-result');
        assert.equal(await resultCards.count(), 4,
          title + ': four quantified, dated, attributable measurements');
        assert.equal(await evidence.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': one traceable source per metric');
        const blocks = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(k => root.querySelector('[data-testid="' + k + '"]')?.getBoundingClientRect().top));
        assert.ok(blocks.every(Number.isFinite) && blocks[0] < blocks[1] && blocks[1] < blocks[2],
          title + ': intro first, comparison second, measurements third');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Patrimoniale' ? 1 : 0,
          title + ': directional arrow only for an actual policy change');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': do not create a false legal/illegal comparison');
        if (title === 'Patrimoniale') {
          for (const value of ['1,0%', '1,9 mln NOK', '36 mld NOK', '15,2%'])
            assert.ok(data.includes(value), 'Norwegian wealth tax measurement ' + value);
          assert.ok(data.includes('una previsione per il 2026'), 'Forecast is not labeled as collected revenue');
          assert.ok(data.includes('non degli abitanti'), 'Taxpayer denominator is explicit');
        }
        if (title === 'Nuove centrali geotermiche') {
          for (const value of ['5.644,3 GWh', '9.008,3 GWh', '33', '15 su 15'])
            assert.ok(data.includes(value), 'Regional geothermal data ' + value);
          assert.ok(data.includes('13 stabilimenti nel 2025, non tutte le 33 centrali'),
            'Controlled sample not conflated with all plants');
        }
        if (title === 'Nuove piste ciclabili') {
          for (const value of ['oltre 6.000 km', '+5,6%', '+28,8%', '3 su 4'])
            assert.ok(data.includes(value), 'ISTAT bicycle network metric ' + value);
          assert.ok(data.includes('non automaticamente sicurezza stradale'),
            'Installed kilometers not misrepresented as safety impact');
        }
      } else {
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': only state-to-proposal comparisons have an arrow');
      }
      assert.equal(await brief.locator('details').count(), title === 'Legalizzazione canapa' ? 2 : 1,
        'Only cannabis adds a second, optional evidence disclosure');
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
