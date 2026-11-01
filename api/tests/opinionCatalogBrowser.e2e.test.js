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
  // Full catalog grows by opt-in; 63 browser cases can exceed the previous 120s suite cap.
  timeout: 180000
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
      ['/opinioni-nazionali', 'Finanziamento scuole paritarie', '703,7 mln €'],
      ['/opinioni-regionali', 'Nuove aree naturali protette', '6,53 mln ha'],
      ['/opinioni-comunali', 'Imposta di soggiorno', '859 mln €'],
      ['/opinioni-nazionali', 'Ius Scholae', '931.323'],
      ['/opinioni-regionali', 'Nuove discariche', '4,43 mln t'],
      ['/opinioni-comunali', 'Nuovi asili nido comunali', '378.500'],
      ['/opinioni-nazionali', 'Ius Soli', '49.002'],
      ['/opinioni-regionali', 'Abbattimento dei cinghiali', '16.390'],
      ['/opinioni-comunali', 'Tariffazione puntuale dei rifiuti', '89,7%'],
      ['/opinioni-nazionali', 'Allevamenti Intensivi', '323,5 kt'],
      ['/opinioni-regionali', 'Treni regionali gratuiti', '119.214'],
      ['/opinioni-comunali', 'Nuova biblioteca comunale', '13.636'],
      ['/opinioni-nazionali', 'Multe in base al Reddito', '1/60'],
      ['/opinioni-regionali', 'Abolizione dei ticket regionali', '38 €'],
      ['/opinioni-comunali', 'Verde pubblico e giardini', '33,7 m²/ab.'],
      ['/opinioni-nazionali', 'Leva obbligatoria', '1/1/2005'],
      ['/opinioni-regionali', 'Gare per i treni regionali', '15 + 7,5'],
      ['/opinioni-comunali', "Riduzione dell'illuminazione notturna per risparmio energetico", '75,5%'],
      ['/opinioni-nazionali', 'Case chiuse', '30.636'],
      ['/opinioni-regionali', 'Incentivi regionali alle auto elettriche', '20,74 mln €'],
      ['/opinioni-comunali', 'Limitazioni affitti brevi', '21/6/2026'],
      ['/opinioni-nazionali', 'Spese NATO al 5%', '3,5%'],
      ['/opinioni-regionali', 'Aborto farmacologico nei consultori', '64,3%'],
      ['/opinioni-comunali', 'Pedaggio urbano', '7,50 €'],
      ['/opinioni-nazionali', 'NATO', '32'],
      ['/opinioni-regionali', 'Reddito minimo regionale', '6.500 €'],
      ['/opinioni-comunali', 'Estensione delle zone a traffico limitato', '72%'],
      ['/opinioni-nazionali', 'Carne coltivata', '16/12/2023'],
      ['/opinioni-regionali', 'Potenziamento trasporto pubblico', '101,6 mln km'],
      ['/opinioni-comunali', 'Nuove case popolari', '2.321'],
      ['/opinioni-nazionali', 'Antifascismo', '645/1952'],
      ['/opinioni-regionali', 'Chiusura ospedali di provincia', '3,7/1.000'],
      ['/opinioni-comunali', 'Videosorveglianza in spazi pubblici', '72 ore'],
      ['/opinioni-nazionali', 'Adozioni omogenitoriali', '79/2022'],
      ['/opinioni-regionali', 'Sanità privata convenzionata', '85,1%'],
      ['/opinioni-comunali', 'Sicurezza strade scolastiche', '20 km/h'],
      ['/opinioni-nazionali', 'MES', '433 mld €'],
      ['/opinioni-regionali', 'Finanziamento delle RSA private', '57.440'],
      ['/opinioni-comunali', 'Riduzione tasse rifiuti', '9.796 €'],
      ['/opinioni-europee', 'Sperimentazione animale', '7.974.226'],
      ['/opinioni-regionali', 'Sostegno commercio locale', '2,95 mln €'],
      ['/opinioni-comunali', 'Riduzione parcheggi a pagamento', '50 €/mese'],
      ['/opinioni-nazionali', 'Gare concessioni balneari', '30/9/2027'],
      ['/opinioni-regionali', 'Cassonetti intelligenti con tessera', '8.728'],
      ['/opinioni-comunali', 'Rilascio di Palloncini', '2019/904'],
      ['/opinioni-europee', 'Esercito Comune Europeo', '7,95 mld €'],
      ['/opinioni-comunali', 'Finanziamento eventi culturali gratuiti', '1.268 eventi'],
      ['/opinioni-comunali', 'Pedonalizzazione del centro storico', '886.032 m²'],
      ['/opinioni-nazionali', 'Premio di maggioranza', '42%'],
      ['/opinioni-comunali', 'Restrizioni alle sale gioco', '500 m'],
      ['/opinioni-comunali', 'Menù vegetali nelle mense scolastiche', '4 settimane'],
      ['/opinioni-nazionali', 'Gestazione per altri', '600.000–1.000.000 €'],
      ['/opinioni-europee', 'Corrida', '1.457'],
      ['/opinioni-comunali', 'Centri comunali di accoglienza migranti', '41.289'],
      ['/opinioni-nazionali', 'Autonomia Differenziata', '192/2024'],
      ['/opinioni-comunali', 'Polizia locale armata', '145/1987'],
      ['/opinioni-comunali', 'Sussidi comunali per famiglie numerose', '90.000 €'],
      ['/opinioni-comunali', 'Parcheggi gratuiti per residenti', 'Art. 7'],
      ['/opinioni-comunali', 'Limitazioni alla movida notturna', '12 zone'],
      ['/opinioni-comunali', 'Divieto di nuovi fast food nel centro storico', '71'],
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
      // The brief shell can mount before React finishes populating the modal.
      // Wait for both accessible headings, then verify uniqueness.
      await brief.getByRole('heading', { name: 'A favore', exact: true }).waitFor({ timeout: 15000 });
      await brief.getByRole('heading', { name: 'Contro', exact: true }).waitFor({ timeout: 15000 });
      assert.equal(await brief.getByRole('heading', { name: 'A favore', exact: true }).count(), 1, title + ': clear green pro label');
      assert.equal(await brief.getByRole('heading', { name: 'Contro', exact: true }).count(), 1, title + ': clear red con label');
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
      } else if (['Finanziamento scuole paritarie', 'Nuove aree naturali protette', 'Imposta di soggiorno'].includes(title)) {
        const evidence = brief.getByTestId('opinion-brief-measured-results');
        await evidence.waitFor({ timeout: 12000 });
        const data = await evidence.innerText();
        assert.equal(await evidence.getByTestId('opinion-brief-result').count(), 4,
          title + ': four sourced metrics with defined units and periods');
        assert.equal(await evidence.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': source linked under every metric');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': no false before-and-after arrow for a side-by-side policy comparison');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no invented jurisdictional legality badges');
        const panels = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(k => root.querySelector('[data-testid="' + k + '"]')?.getBoundingClientRect().top));
        assert.ok(panels.every(Number.isFinite) && panels[0] < panels[1] && panels[1] < panels[2],
          title + ': explanation first, comparison second, evidence third');
        if (title === 'Finanziamento scuole paritarie') {
          for (const value of ['11.765', '790.460', '703,7 mln €', '113,4 mln €'])
            assert.ok(data.includes(value), 'Ministry / Parliamentary school finance data: ' + value);
          assert.ok(data.includes('NON va sommato una seconda volta'),
            'Disability funding is already a component of the total');
          assert.ok(data.includes('non calcolare una spesa annua per studente'),
            'School-year pupil data and calendar-year spending differ');
        }
        if (title === 'Nuove aree naturali protette') {
          for (const value of ['21,7%', '6,53 mln ha', '30%', '≈2,5 mln ha'])
            assert.ok(data.includes(value), 'ISPRA protection data: ' + value);
          assert.ok(data.includes('non dimostrano da soli un miglioramento della biodiversità'),
            'Protected area size does not measure conservation results');
          assert.ok(data.includes('senza contare due volte'),
            'Natura 2000 / protected area overlap must be corrected');
        }
        if (title === 'Imposta di soggiorno') {
          for (const value of ['1.531', '859 mln €', '109,3 mln €', '82,9 mln €'])
            assert.ok(data.includes(value), '2025 municipal tourist tax receipts: ' + value);
          assert.ok(data.includes('Roma esclusa') && data.includes('Roma usa un capitolo distinto'),
            'Roma separate contribution must be excluded from comparable aggregate');
          assert.ok(data.includes('non dimostrano che i servizi turistici siano migliorati'),
            'Revenue does not measure public-service improvement');
        }
      } else if (['Ius Scholae', 'Nuove discariche', 'Nuovi asili nido comunali'].includes(title)) {
        const dataPanel = brief.getByTestId('opinion-brief-measured-results');
        await dataPanel.waitFor();
        const data = await dataPanel.innerText();
        assert.equal(await dataPanel.getByTestId('opinion-brief-result').count(), 4,
          title + ': four factual evidence cards');
        assert.equal(await dataPanel.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': clickable source for each number');
        const positions = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(k => root.querySelector('[data-testid="' + k + '"]')?.getBoundingClientRect().top));
        assert.ok(positions.every(Number.isFinite) && positions[0] < positions[1] && positions[1] < positions[2],
          title + ': explanation is first, comparison and data below');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': must not invent jurisdictional legal badges');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Nuove discariche' ? 0 : 1,
          title + ': arrow only for a current-state-to-proposal transition');
        if (title === 'Ius Scholae') {
          for (const value of ['931.323', '11,6%', '13,7%', '29,4%'])
            assert.ok(data.includes(value), 'School citizenship datum ' + value);
          assert.ok(data.includes('NON quanti soddisferebbero cinque anni'),
            'All pupils without citizenship are not eligible for Ius Scholae');
          assert.ok(data.includes('non una legge in vigore'),
            'Current and proposed laws must remain distinct');
        }
        if (title === 'Nuove discariche') {
          for (const value of ['102', '4,43 mln t', '14,8%', '−3,7%'])
            assert.ok(data.includes(value), 'ISPRA landfill fact ' + value);
          assert.ok(data.includes('10% dei rifiuti urbani in discarica entro il 2035'),
            'EU target must not be mistaken for current landfill percentage');
          assert.ok(data.includes('non stimano bisogno, emissioni o impatti'),
            'Existing plants cannot forecast benefits from new landfill');
        }
        if (title === 'Nuovi asili nido comunali') {
          for (const value of ['14.570', '378.500', '31,6', '59,5%'])
            assert.ok(data.includes(value), 'ISTAT nursery dataset ' + value);
          assert.ok(data.includes('0 a 6 anni') && data.includes('NON un numero di posti già completati'),
            'PNRR target includes preschools and is not reported as completed');
          assert.ok(data.includes('NON quota di bambini esclusi'),
            'Waiting-list rate is per service, not children');
        }
      } else if (['Ius Soli', 'Abbattimento dei cinghiali', 'Tariffazione puntuale dei rifiuti'].includes(title)) {
        const evidence = brief.getByTestId('opinion-brief-measured-results');
        await evidence.waitFor();
        const data = await evidence.innerText();
        const expectedCards = title === 'Ius Soli' ? 4 : 3;
        assert.equal(await evidence.getByTestId('opinion-brief-result').count(), expectedCards,
          title + ': quantified evidence with territory and period');
        assert.equal(await evidence.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), expectedCards,
          title + ': one visible official/source link per measured result');
        const panels = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(key => root.querySelector('[data-testid="' + key + '"]')?.getBoundingClientRect().top));
        assert.ok(panels.every(Number.isFinite) && panels[0] < panels[1] && panels[1] < panels[2],
          title + ': explanation above comparison, evidence below, no conflation');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Abbattimento dei cinghiali' ? 0 : 1,
          title + ': only actual policy transitions get an arrow');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no misleading international legality categorization');
        if (title === 'Ius Soli') {
          for (const n of ['49.002', '13,8%', '31.440', '80.442'])
            assert.ok(data.includes(n), 'ISTAT 2025 births by parent nationality ' + n);
          assert.ok(data.includes('NON è una stima di destinatari') &&
            data.includes('Non identificano da sole il luogo effettivo di nascita'),
            'Birth parent nationality does not determine Ius Soli eligibility');
          assert.ok((await brief.innerText()).includes('Ius Scholae = percorso scolastico'),
            'Ius Soli and Ius Scholae remain distinct');
        }
        if (title === 'Abbattimento dei cinghiali') {
          for (const n of ['4.890', '16.390', 'oltre 20.000'])
            assert.ok(data.includes(n), 'Piedmont controlled vs hunting removals ' + n);
          assert.ok(data.includes('Più abbattimenti NON dimostrano automaticamente meno cinghiali'),
            'Removals must not be represented as reduced damage or boar population');
          assert.ok((await brief.innerText()).includes('non coincide con la caccia ricreativa'),
            'Faunal management is separate from recreational hunting');
        }
        if (title === 'Tariffazione puntuale dei rifiuti') {
          for (const n of ['89,7%', '42 kg/ab', '67,69%'])
            assert.ok(data.includes(n), 'Contarina and ISPRA waste evidence ' + n);
          assert.ok(data.includes('NON tutti i rifiuti prodotti') &&
            data.includes('NON dimostra il solo effetto della tariffazione puntuale'),
            'Residual waste not total waste and cross-year geographic comparisons are not causal');
          assert.ok((await brief.innerText()).includes('raccolta porta a porta sono strumenti diversi'),
            'Pay-as-you-throw is not the same as door-to-door collection');
        }
      } else if (['Allevamenti Intensivi', 'Treni regionali gratuiti', 'Nuova biblioteca comunale'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        const metrics = results.getByTestId('opinion-brief-result');
        assert.equal(await metrics.count(), 4, title + ': four independently sourced metrics');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': every figure links to a source');
        const blocks = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(blocks.every(Number.isFinite) && blocks[0] < blocks[1] && blocks[1] < blocks[2],
          title + ': opening definition, policy alternatives and evidence must remain separate');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': do not invent a legal-vs-illegal jurisdiction comparison');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Treni regionali gratuiti' ? 1 : 0,
          title + ': arrow only for transition from current rules to proposed universal trains');
        if (title === 'Allevamenti Intensivi') {
          for (const value of ['323,5 kt', '90,8%', '54,1%', '−24%'])
            assert.ok(data.includes(value), 'ISPRA ammonia measurement ' + value);
          assert.ok(data.includes('NON emissioni dei soli allevamenti intensivi') &&
            data.includes('non identifica gli intensivi'),
            'Agriculture and livestock national ammonia data must not be falsely isolated to intensive farms');
          assert.ok((await brief.innerText()).includes('essere favorevoli a questa Opinione significa sostenere il mantenimento'),
            'Support vote semantics must not be inverted');
        }
        if (title === 'Treni regionali gratuiti') {
          for (const value of ['oltre 220 mila', '300–600 €', '119.214', '28,7 mln €'])
            assert.ok(data.includes(value), 'Emilia-Romagna student transport figures ' + value);
          assert.ok(data.includes('NON solo passeggeri ferroviari') &&
            data.includes('NON il totale dei beneficiari'),
            'Bus-train student schemes cannot be generalized to all regional passengers');
          assert.ok(data.includes('NON costo stimato della gratuità ferroviaria per tutti'),
            'Student 2026-28 funding is not a universal rail cost');
        }
        if (title === 'Nuova biblioteca comunale') {
          for (const value of ['13.636', '15,1%', '30,9%', '17,7%'])
            assert.ok(data.includes(value), 'ISTAT library usage and census figure ' + value);
          assert.ok(data.includes('non soltanto comunali') &&
            data.includes('forme di accesso differenti'),
            'Do not equate all libraries with municipal services or physical with hybrid use');
          assert.ok(data.includes('né dimostrano che costruirne una nuova aumenti lettura'),
            'National usage does not forecast benefits of building an individual library');
        }
      } else if (['Multe in base al Reddito', 'Abolizione dei ticket regionali', 'Verde pubblico e giardini'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four fully qualified official facts');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': a clickable source for every number');
        const positions = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(positions.every(Number.isFinite) && positions[0] < positions[1] && positions[1] < positions[2],
          title + ': explanatory text comes before policy choices and metrics');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Verde pubblico e giardini' ? 0 : 1,
          title + ': arrow only for actual rule-to-proposal comparison');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0);
        if (title === 'Multe in base al Reddito') {
          for (const n of ['1/60', '255 €', '6 €', '1/3–3×'])
            assert.ok(data.includes(n), 'Finnish/Italian fine parameter ' + n);
          assert.ok(data.includes('NON si applica a tutte le infrazioni stradali') &&
            data.includes('NON è una formula automatica'),
            'Criminal fine units are not all road-traffic penalties');
          assert.ok((await brief.innerText()).includes("art. 133-bis del codice penale"),
            'Italy already considers economic means for some criminal fines');
        }
        if (title === 'Abolizione dei ticket regionali') {
          for (const n of ['1/9/2020', '38 €', '31/12/2026', '36.151,98 €'])
            assert.ok(data.includes(n), 'Tuscany health copayment rule ' + n);
          assert.ok(data.includes('NON sono stati aboliti tutti i ticket sanitari') &&
            data.includes('NON esenzione automatica'),
            'Removing a supplemental copayment is not abolishing all healthcare tickets');
          assert.ok((await brief.innerText()).includes('Una Regione non può eliminare unilateralmente'));
        }
        if (title === 'Verde pubblico e giardini') {
          for (const n of ['oltre 590 km²', '33,7 m²/ab.', '68', '+6,2%'])
            assert.ok(data.includes(n), 'ISTAT greenery statistic ' + n);
          assert.ok(data.includes('NON sono solo giardini') &&
            data.includes('NON 68 nuovi parchi'),
            'Urban greenery and forestation numbers do not equal accessible new parks');
          assert.ok((await brief.innerText()).includes('Verde complessivo, verde protetto, spazi fruibili'));
        }
      } else if (['Leva obbligatoria', 'Gare per i treni regionali', "Riduzione dell'illuminazione notturna per risparmio energetico"].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four facts with place, date and definition');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': official source linked per fact');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': legal traffic light would misdescribe competing policy proposals');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Gare per i treni regionali' ? 0 : 1,
          title + ': arrow only on a policy change, not competition between existing award methods');
        const positions = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(positions.every(Number.isFinite) && positions[0] < positions[1] && positions[1] < positions[2],
          title + ': explanation, alternatives, and sourced evidence in reading order');
        if (title === 'Leva obbligatoria') {
          for (const n of ['1/1/2005', 'Art. 1929', '2022', '3 anni'])
            assert.ok(data.includes(n), 'Leva statutory or volunteering parameter ' + n);
          assert.ok(data.includes('SOSPESE') &&
            data.includes('NON è una chiamata ordinaria automatica') &&
            data.includes('NON ha riattivato la leva obbligatoria'),
            'Suspended conscription is different from a new general call and voluntary service');
          assert.ok((await brief.innerText()).includes('Leva obbligatoria sospesa, servizio volontario e servizio civile'));
        }
        if (title === 'Gare per i treni regionali') {
          for (const n of ['2016', '1/6/2019', '15 + 7,5', '25/12/2023'])
            assert.ok(data.includes(n), 'Regional tender and EU award-law evidence ' + n);
          assert.ok(data.includes('NON un nuovo bando del 2026') &&
            data.includes('NON data dell') &&
            data.includes('Non è il divieto di OGNI affidamento diretto'),
            'Competition, existing contract dates and EU exceptions are not interchangeable');
          assert.ok((await brief.innerText()).includes('Gestore del servizio ferroviario e proprietario/gestore dei binari'));
        }
        if (title === "Riduzione dell'illuminazione notturna per risparmio energetico") {
          for (const n of ['oltre 2,4 mln', '75,5%', '+8,5%', '+0,6%'])
            assert.ok(data.includes(n), 'ISTAT public-lighting measurement ' + n);
          assert.ok(data.includes('non kWh consumati') &&
            data.includes('non riduzione ottenuta con lo spegnimento') &&
            data.includes('non calo della bolletta'),
            'Lighting network size and LED adoption do not measure overnight dimming savings');
          assert.ok((await brief.innerText()).includes('Efficienza dei LED, dimmerazione e spegnimento'));
        }
      } else if (['Case chiuse', 'Incentivi regionali alle auto elettriche', 'Limitazioni affitti brevi'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        const metrics = results.getByTestId('opinion-brief-result');
        assert.equal(await metrics.count(), 4, title + ': four sourced and contextualized figures');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': each figure needs an independent source link');
        const positions = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(positions.every(Number.isFinite) && positions[0] < positions[1] && positions[1] < positions[2],
          title + ': introductory explanation, choices and evidence in reading order');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(),
          title === 'Case chiuse' ? 1 : 0,
          title + ': a transition arrow only for Italian law versus a proposed new regime');
        if (title === 'Case chiuse') {
          for (const n of ['1958', '1/7/2017', '30.636', '2.312'])
            assert.ok(data.includes(n), 'Italy/Germany rules and administrative registration ' + n);
          const countries = brief.getByTestId('opinion-brief-country');
          assert.equal(await countries.count(), 3, 'green and red legal rules shown distinctly');
          assert.equal(await brief.locator('[data-testid="opinion-brief-country"][data-legal-status="regulated"]').count(), 2,
            'Germany and Netherlands must have regulated-status coloration');
          assert.equal(await brief.locator('[data-testid="opinion-brief-country"][data-legal-status="prohibited"]').count(), 1,
            'Only Italian brothel operation should be marked prohibited');
          assert.ok(data.includes('NON numero totale stimato') &&
            data.includes('non corrispondono necessariamente a singoli bordelli'),
            'Administrative registration and permits do not equal total sex-worker population');
          assert.ok((await brief.innerText()).includes('NON criminalizzata automaticamente la prostituzione individuale'),
            'Prohibiting brothels is not prohibiting voluntary adult sex work');
        } else {
          assert.equal(await brief.getByTestId('opinion-brief-country').count(), 0,
            title + ': no invented permitted/prohibited cross-country status map');
        }
        if (title === 'Incentivi regionali alle auto elettriche') {
          for (const n of ['20,74 mln €', '31/10/2025', '3,94 mln €', '1/7/2026'])
            assert.ok(data.includes(n), 'Lombardy incentives program parameter ' + n);
          assert.ok(data.includes('NON fondi riservati solo ad auto elettriche') &&
            data.includes('bando DIFFERENTE') &&
            data.includes('non un incentivo universale ai privati'),
            'Do not conflate citizen and enterprise funds or EV-only and low-emission programs');
          assert.ok((await brief.innerText()).includes('NON sono confrontabili come crescita o riduzione'),
            'Different applicant groups and vehicle categories cannot be compared as a trend');
        }
        if (title === 'Limitazioni affitti brevi') {
          for (const n of ['31/5/2025', '21/6/2026', '5 anni', '28 m²'])
            assert.ok(data.includes(n), 'Firenze short-term rental rule ' + n);
          assert.ok(data.includes('NON significa divieto generalizzato') &&
            data.includes('non misura case sottratte alla residenza'),
            'Local zoning ban and housing-area requirement must not be misread as measured impact');
          assert.ok((await brief.innerText()).includes('non tutte le attività preesistenti devono chiudere'),
            'Existing 2024 registered rentals have transitional rules');
        }
      } else if (['Spese NATO al 5%', 'Aborto farmacologico nei consultori', 'Pedaggio urbano'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four official facts and interpretive cautions');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': each fact retains its own official source link');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no unsupported country-level law classification');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': comparison of policy frameworks is not a before-and-after transition');
        const pos = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(pos.every(Number.isFinite) && pos[0] < pos[1] && pos[1] < pos[2],
          title + ': explanation, alternatives and evidence remain in reading order');
        if (title === 'Spese NATO al 5%') {
          for (const n of ['5% del PIL', '3,5%', 'fino a 1,5%', '2029'])
            assert.ok(data.includes(n), 'NATO official defence investment objective ' + n);
          assert.ok(data.includes('non la quota di PIL già spesa') &&
            data.includes('non è automaticamente spesa militare') &&
            data.includes('NON è la scadenza finale'),
            '2035 commitment, core defence and wider security cannot be conflated');
          assert.ok((await brief.innerText()).includes('OBIETTIVI da raggiungere entro il 2035'),
            'Target is not a measured 2026 expenditure');
        }
        if (title === 'Aborto farmacologico nei consultori') {
          for (const n of ['63 giorni', '29/6/2020', '39,4%', '64,3%'])
            assert.ok(data.includes(n), 'Tuscany 2019/2024 or Health Ministry fact ' + n);
          assert.ok(data.includes('NON un tempo medio di attesa') &&
            data.includes('non apertura automatica di tutti i consultori') &&
            data.includes('NON percentuale eseguita nei consultori'),
            'National allowance, local organization and regional pharmacological share differ');
          assert.ok((await brief.innerText()).includes('NON dimostra da solo che il protocollo 2020 ne sia stato la causa'),
            'Do not attribute causal change without comparative evidence');
        }
        if (title === 'Pedaggio urbano') {
          for (const n of ['7,50 €', '7:30–19:30', '50/anno', '3,00 €'])
            assert.ok(data.includes(n), 'Milan Area C tariff, hours and resident rules ' + n);
          assert.ok(data.includes('NON un costo per ogni passaggio') &&
            data.includes('NON per ogni cittadino di Milano') &&
            data.includes('NON sostituisce il ticket ordinario'),
            'Daily ticket, resident entitlement and price are not interchangeable');
          assert.ok((await brief.innerText()).includes('NON provano da soli l\'efficacia del pedaggio'),
            'Rules and fares are not causal traffic outcomes');
        }
      } else if (['NATO', 'Reddito minimo regionale', 'Estensione delle zone a traffico limitato'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four verifiable official facts');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': official source linked for each fact');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': policy alternatives are not a claimed transition');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no fabricated country-wide green/red map');
        const panels = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(panels.every(Number.isFinite) && panels[0] < panels[1] && panels[1] < panels[2],
          title + ': introduction, alternatives and sources in reading order');
        if (title === 'NATO') {
          for (const n of ['12', '32', '4/4/2023', '7/3/2024'])
            assert.ok(data.includes(n), 'NATO founding/member accession ' + n);
          assert.ok(data.includes('NON di forze armate unificate') &&
            data.includes('non prova automaticamente maggiore sicurezza'),
            'NATO member counts and accession dates are not causal security outcomes');
          assert.ok((await brief.innerText()).includes("l'impiego della forza non è automatico"),
            'Article 5 does not automatically mandate sending troops');
        }
        if (title === 'Reddito minimo regionale') {
          for (const n of ['6.500 €', '70%', '30%', '12 mesi'])
            assert.ok(data.includes(n), 'Sardinian REIS 2026 rule ' + n);
          assert.ok(data.includes("NON dell'ISEE totale") &&
            data.includes('NON importo monetario pagato direttamente') &&
            data.includes('non un diritto automatico al pagamento'),
            'ISRE is not ISEE; services are not cash and eligibility is not paid benefit');
          assert.ok((await brief.innerText()).includes("Il REIS non è un reddito di base universale"),
            'Means-tested and conditioned regional income differs from universal basic income');
        }
        if (title === 'Estensione delle zone a traffico limitato') {
          for (const n of ['72%', '188', '7:30–19:30', '5'])
            assert.ok(data.includes(n), 'Milan Area B coverage, gates, hours or exemption ' + n);
          assert.ok(data.includes('NON diminuzione del traffico') &&
            data.includes('NON transiti, sanzioni') &&
            data.includes('NON un divieto generalizzato'),
            'Area coverage, gates and operating hours are not traffic improvements');
          assert.ok((await brief.innerText()).includes('Area B è una zona a limitazione ambientale, diversa da Area C'),
            'Free low-emissions access and paid urban toll must remain distinct');
        }
      } else if (['Carne coltivata', 'Potenziamento trasporto pubblico', 'Nuove case popolari'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four sourced facts with scope and period');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': each fact independently links to an official source');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': comparisons are not measured before/after transitions');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': do not invent cross-country permission/prohibition maps');
        const panels = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(panels.every(Number.isFinite) && panels[0] < panels[1] && panels[1] < panels[2],
          title + ': readable explanation then policy alternatives then evidence');
        if (title === 'Carne coltivata') {
          for (const n of ['1/1/2018', '16/12/2023', '9/2024', '0'])
            assert.ok(data.includes(n), 'EU/Italian cultivated meat regulation fact ' + n);
          assert.ok(data.includes('NON la data di autorizzazione') &&
            data.includes('NON autorizzazione') &&
            data.includes('DI ORIGINE ANIMALE'),
            'Novel food framework and scientific application are not marketing approvals');
          assert.ok((await brief.innerText()).includes('zero EFSA riguarda gli alimenti cell-based di origine ANIMALE'),
            'No authorizations for animal cells must not be confused with plant-cell products');
        }
        if (title === 'Potenziamento trasporto pubblico') {
          for (const n of ['1/11/2021', '1/11/2023', '101,6 mln km', '+4 mln km'])
            assert.ok(data.includes(n), 'Tuscany regional TPL contract fact ' + n);
          assert.ok(data.includes('NON chilometri certificati effettivamente percorsi') &&
            data.includes('NON riduzione stimata delle emissioni'),
            'Contractual planned bus kilometers are not realized kilometers or emission outcomes');
          assert.ok((await brief.innerText()).includes('NON un aumento del 4% del totale'),
            'Added weak-lot kilometers must not be misreported as percent change of total');
        }
        if (title === 'Nuove case popolari') {
          for (const n of ['2.321', '2.047', '274', '40%'])
            assert.ok(data.includes(n), 'Milan 2026 housing plan category fact ' + n);
          assert.ok(data.includes('NON 2.321 case nuove costruite') &&
            data.includes('sono una PARTE dei 2.321') &&
            data.includes('compresi nel totale 2.321'),
            'Assignable stock must not be misclassified as new construction or double counted');
          assert.ok((await brief.innerText()).includes('non di nuove abitazioni costruite'),
            'Proposed assignable dwellings are not units actually built or delivered');
        }
      } else if (['Antifascismo', 'Chiusura ospedali di provincia', 'Videosorveglianza in spazi pubblici'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four contextualized and source-linked legal or service criteria');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': every result independently cites an official institution');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': policy comparison is not presented as a before-after measurement');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': avoid inventing international permitted/prohibited status maps');
        const pos = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(pos.every(Number.isFinite) && pos[0] < pos[1] && pos[1] < pos[2],
          title + ': introduction, choices, then sourced evidence in reading order');
        if (title === 'Antifascismo') {
          for (const n of ['1/1/1948', 'XII', '645/1952', '205/1993'])
            assert.ok(data.includes(n), 'Italian constitutional and legal background ' + n);
          assert.ok(data.includes('NON qualsiasi opinione personale') &&
            data.includes('NON definisce illecita ogni semplice espressione politica') &&
            data.includes('ambito distinto'),
            'Party reorganization crime must not become blanket prohibition of political views');
          assert.ok((await brief.innerText()).includes('NON statistiche sulla diffusione del fascismo'),
            'Legal provisions are not measured policy effects');
        }
        if (title === 'Chiusura ospedali di provincia') {
          for (const n of ['3,7/1.000', '0,7/1.000', '80–150 mila', '150–300 mila'])
            assert.ok(data.includes(n), 'DM 70/2015 planning threshold ' + n);
          assert.ok(data.includes('NON quota di ospedali da chiudere') &&
            data.includes('NON 0,7 posti aggiuntivi') &&
            data.includes('NON soglia automatica'),
            'Hospital planning standards must not be misread as automatic closure rules');
          assert.ok((await brief.innerText()).includes('GIÀ COMPRESA in 3,7'),
            'Post-acute bed ratio is included, not additive');
        }
        if (title === 'Videosorveglianza in spazi pubblici') {
          for (const n of ['7 giorni', '72 ore', '2 livelli', 'Art. 35'])
            assert.ok(data.includes(n), 'Italian/GDPR CCTV guarantee ' + n);
          assert.ok(data.includes('NON limite generale'),
            'Jurisdiction-specific retention limit must not be applied to every camera');
          assert.ok(data.includes('72 ore NON sono una licenza automatica'),
            '72 hours are not an automatic authorization to retain footage');
          assert.ok((await brief.innerText()).includes('Nessuno di questi riferimenti misura riduzioni dei reati'),
            'Legal retention and notices are not public-safety impact estimates');
        }
      } else if (['Adozioni omogenitoriali', 'Sanità privata convenzionata', 'Sicurezza strade scolastiche'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four contextualized official facts and dates');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': each figure links to its source');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': comparisons must not fake measured change');
        const panels = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(panels.every(Number.isFinite) && panels[0] < panels[1] && panels[1] < panels[2],
          title + ': concise definition, alternatives and documented figures in reading order');
        if (title === 'Adozioni omogenitoriali') {
          for (const n of ['2001', '3 anni', '79/2022', '68/2025'])
            assert.ok(data.includes(n), 'NL/Italian adoption or recognition legal datum ' + n);
          assert.ok(data.includes('NON è requisito italiano') &&
            data.includes('NON ha aperto automaticamente') &&
            data.includes("NON è una sentenza sull'adozione congiunta"),
            'Dutch adoption, special adoption and birth recognition must remain distinct');
          const countries = brief.getByTestId('opinion-brief-country');
          assert.equal(await countries.count(), 2, 'NL and Italy statuses must be shown separately');
          assert.equal(await brief.locator('[data-testid="opinion-brief-country"][data-legal-status="regulated"]').count(), 1,
            'Netherlands national joint adoption is regulated');
          assert.equal(await brief.locator('[data-testid="opinion-brief-country"][data-legal-status="limited"]').count(), 1,
            'Italy is limited, not falsely marked as a universal adoption ban');
          const [countryPos, resultsPos] = await brief.evaluate(root => [
            root.querySelector('[data-testid="opinion-brief-legal-status"]')?.getBoundingClientRect().top,
            root.querySelector('[data-testid="opinion-brief-measured-results"]')?.getBoundingClientRect().top,
          ]);
          assert.ok(Number.isFinite(countryPos) && countryPos < resultsPos,
            'country rule map must precede underlying law/evidence');
        } else {
          assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
            title + ': do not invent geographic permission maps for health or street projects');
        }
        if (title === 'Sanità privata convenzionata') {
          for (const n of ['996', '51,3%', '85,1%', '78,4%'])
            assert.ok(data.includes(n), 'Ministry of Health SSN 2023 category figure ' + n);
          assert.ok(data.includes('NON posti letto') &&
            data.includes('Quota di STRUTTURE') &&
            data.includes('non quota di spesa regionale'),
            'Facility counts, beds, patients, expenditure and care quality cannot be conflated');
          assert.ok((await brief.innerText()).includes('non sono sommabili né confrontabili come quota di spesa'),
            'Different care settings have different denominators');
        }
        if (title === 'Sicurezza strade scolastiche') {
          for (const n of ['circa 26%', '20 km/h', '15', '6'])
            assert.ok(data.includes(n), 'Milan/Bologna/Rome school safety observation or plan ' + n);
          assert.ok(data.includes('NON quota di strade chiuse') &&
            data.includes('NON velocità media registrata') &&
            data.includes('NON già conclusi'),
            'Traffic-calming coverage, speed rules and planned construction cannot equal impact');
          assert.ok((await brief.innerText()).includes('non un confronto causale'),
            'Road works and school streets do not prove fewer accidents by themselves');
        }
      } else if (['MES', 'Finanziamento delle RSA private', 'Riduzione tasse rifiuti'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': exactly four grounded figures');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': a direct source link for each number');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': examples are not fictitious before/after effect comparisons');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no country-law color mapping for financial mechanisms');
        const panels = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(panels.every(Number.isFinite) && panels[0] < panels[1] && panels[1] < panels[2],
          title + ': definition, policy alternatives and evidence follow reading order');
        if (title === 'MES') {
          for (const n of ['21', '500 mld €', '433 mld €', '81,1 mld €'])
            assert.ok(data.includes(n), 'ESM 2026 membership or lending figure ' + n);
          assert.ok(data.includes('NON indica quanti Stati abbiano chiesto') &&
            data.includes('NON fondi immediatamente erogati') &&
            data.includes('NON liquidità depositata'),
            'ESM membership and capacity must not be mistaken for loans paid');
          assert.ok((await brief.innerText()).includes('NON sommarli'),
            '500bn lending capacity and 433bn remaining capacity overlap');
        }
        if (title === 'Finanziamento delle RSA private') {
          for (const n of ['738', '68.187', '64.015', '57.440'])
            assert.ok(data.includes(n), '2025 FNP CISL Lombardy RSA volume or bed category ' + n);
          assert.ok(data.includes('NON solo strutture private') &&
            data.includes('NON posti tutti pagati') &&
            data.includes('NON numero di contratti finanziati'),
            'Licensed, accredited and contracted beds should not be conflated');
          assert.ok((await brief.innerText()).includes('non tre insiemi da sommare'),
            'Authorized, accredited and contracted beds are nested groups');
        }
        if (title === 'Riduzione tasse rifiuti') {
          for (const n of ['25%', '9.796 €', '20.000 €', '6 €/anno'])
            assert.ok(data.includes(n), 'ARERA national waste bonus figure ' + n);
          assert.ok(data.includes('NON taglio generale') &&
            data.includes('NON rimborso monetario') &&
            data.includes('NON ammontare dello sconto'),
            'National subsidy, ISEE eligibility and UR3 levy are different');
          assert.ok((await brief.innerText()).includes("nell'ANNO SUCCESSIVO"),
            'TARI bonus normally follows ISEE eligibility in the following year');
        }
      } else if (['Sperimentazione animale', 'Sostegno commercio locale', 'Riduzione parcheggi a pagamento'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four figures contextualized by time, measure and source');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': every numeric fact is linked to its primary source');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': no false causal before/after comparison');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no fake legal-country heatmap for policy tradeoffs');
        const order = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(order.every(Number.isFinite) && order[0] < order[1] && order[1] < order[2],
          title + ': definition, policy options, then evidence in reading order');
        if (title === 'Sperimentazione animale') {
          for (const n of ['7.974.226', '8.385.397', '−4,9%', 'meno del 9%'])
            assert.ok(data.includes(n), 'European Commission EU+Norway animal use fact ' + n);
          assert.ok(data.includes('NON totale degli animali allevati') &&
            data.includes('NON numero delle singole procedure') &&
            data.includes('NON prova da sola'),
            'First-time animal numbers and measured change are not total animal uses or causation');
          assert.ok((await brief.innerText()).includes('denominatore è diverso'),
            'Severe use share has a different denominator from first-time animals');
        }
        if (title === 'Sostegno commercio locale') {
          for (const n of ['2,95 mln €', '80%', '40.000 €', '20.000 €'])
            assert.ok(data.includes(n), 'Lombardy 2026 locality commerce grant condition ' + n);
          assert.ok(data.includes('NON denaro interamente già erogato') &&
            data.includes('non 80% del fatturato') &&
            data.includes('NON cifra da sommare'),
            'Budget, reimbursement rate and mutually exclusive caps cannot be conflated');
          assert.ok((await brief.innerText()).includes('CASI DISTINTI'),
            '40k and 20k maximum grants must not be added');
        }
        if (title === 'Riduzione parcheggi a pagamento') {
          for (const n of ['0 €', '250 €', '50 €/mese', '40 €/mese'])
            assert.ok(data.includes(n), 'Milan permits and paid parking subscription costs ' + n);
          assert.ok(data.includes('NON tutta la sosta blu') &&
            data.includes('NON tariffa oraria') &&
            data.includes('NON sconto automatico'),
            'Free resident permit must not imply citywide free parking or discounted subscription');
          assert.ok((await brief.innerText()).includes('tariffe ALTERNATIVE'),
            'Monthly subscriptions must not be falsely added together');
        }
      } else if (['Gare concessioni balneari', 'Cassonetti intelligenti con tessera', 'Rilascio di Palloncini'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four independently sourced and qualified figures');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': source link present for every figure');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': regulatory and infrastructure facts are not false before/after impact data');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no invented international prohibition heatmap');
        const order = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(order.every(Number.isFinite) && order[0] < order[1] && order[1] < order[2],
          title + ': definition, comparison, evidence appear in legible order');
        if (title === 'Gare concessioni balneari') {
          for (const n of ['30/6/2027', '30/9/2027', '31/3/2028', '5–20 anni'])
            assert.ok(data.includes(n), 'Italian concession rule/transition date ' + n);
          assert.ok(data.includes('NON data da attendere necessariamente') &&
            data.includes('NON proroga obbligatoria') &&
            data.includes('NON proroga generale automatica'),
            'Transitional deadlines cannot be misread as universal delay of auctions');
          assert.ok((await brief.innerText()).includes('non indicano tre proroghe generali'),
            'Different tender dates must remain legally separate');
        }
        if (title === 'Cassonetti intelligenti con tessera') {
          for (const n of ['8.728', 'oltre 11.000', 'oltre 390', 'oltre 8.300'])
            assert.ok(data.includes(n), 'Firenze 2025 smart waste-bin/network fact ' + n);
          assert.ok(data.includes('NON numero delle utenze') &&
            data.includes('NON 11.000 ulteriori unità') &&
            data.includes('NON ulteriori 390 cassonetti'),
            'Digital bins, total bins and local-stage bins must not be double counted');
          assert.ok((await brief.innerText()).includes('non dimostrano da sole riduzione di emissioni'),
            'Sensor rollout is not automatically measured waste or emissions reduction');
        }
        if (title === 'Rilascio di Palloncini') {
          for (const n of ['2019/904', '7/2021', '31/12/2024', '8/9/2026'])
            assert.ok(data.includes(n), 'European SUP directive, product scope or guidance date ' + n);
          assert.ok(data.includes('NON una legge che vieta sempre') &&
            data.includes('NON divieto generale di vendita') &&
            data.includes('NON un nuovo divieto comunale'),
            'EU bans balloon sticks, not automatically all balloons or releases');
          assert.ok((await brief.innerText()).includes('NON introducono un divieto generalizzato di rilascio'),
            '2026 guidance is not a blanket municipal ban');
        }
      } else if (['Esercito Comune Europeo', 'Finanziamento eventi culturali gratuiti', 'Pedonalizzazione del centro storico'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        const all = await brief.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four facts with explicit meanings');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': every fact has a source link');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': funding and area totals do not prove causality');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no invented geographic status for a policy scenario');
        const positions = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(positions.every(Number.isFinite) && positions[0] < positions[1] && positions[1] < positions[2],
          title + ': summary, alternatives, then sourced data');
        if (title === 'Esercito Comune Europeo') {
          for (const fact of ['26 Stati', '75 progetti', '7,95 mld €', '150 mld €'])
            assert.ok(data.includes(fact), 'EU defence instrument fact ' + fact);
          assert.ok(data.includes('NON eserciti fusi') &&
            data.includes('NON 75 brigate europee') &&
            data.includes('Massimale di PRESTITI'),
            'PESCO, EDF and SAFE must not be presented as one European army');
          assert.ok(all.includes('Non sommare i due strumenti'),
            'SAFE loans cannot simply be added to EDF research grants as new-army funding');
        }
        if (title === 'Finanziamento eventi culturali gratuiti') {
          for (const fact of ['quasi 1,9 mln €', '800.000 €', '1.268 eventi', '162 soggetti'])
            assert.ok(data.includes(fact), 'Florence 2026 programme announcement ' + fact);
          assert.ok(data.includes('NON spesa consuntiva') &&
            data.includes('NON ulteriore importo') &&
            data.includes('NON 1.268 eventi certamente gratuiti'),
            'Programme figures cannot imply realized expenditure or universally free entry');
          assert.ok(all.includes('INCLUSI nel finanziamento complessivo'),
            'PN Metro funding is included in overall budget, not additional');
        }
        if (title === 'Pedonalizzazione del centro storico') {
          for (const fact of ['oltre 20.000 m²', '886.032 m²', '+11,2%', '7 piazze'])
            assert.ok(data.includes(fact), 'Milan citywide pedestrian-area observation ' + fact);
          assert.ok(data.includes('NON solo nel centro storico') &&
            data.includes('NON 886.032 metri quadrati di interventi aggiuntivi') &&
            data.includes('NON riduzione rilevata degli incidenti'),
            'Citywide totals and before/after area figures must be correctly scoped');
          assert.ok(all.includes("all'INTERA CITTÀ") &&
            all.includes('già contenuti negli 886.032 m²'),
            'Historic-centre proposal must not be supported by mislabelled citywide totals');
        }
      } else if (['Premio di maggioranza', 'Restrizioni alle sale gioco', 'Menù vegetali nelle mense scolastiche'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        const all = await brief.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four figures with precise scope and source');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': link every fact to official data');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': law and menu are not before/after impact measurements');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': do not invent country-law heatmaps');
        const positions = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(positions.every(Number.isFinite) && positions[0] < positions[1] && positions[1] < positions[2],
          title + ': definition, alternatives, then sourced figures');
        if (title === 'Premio di maggioranza') {
          for (const fact of ['24/10/2026', '42%', '70 seggi', '220 seggi'])
            assert.ok(data.includes(fact), 'Current Italian law 180/2026 electoral figure ' + fact);
          assert.ok(data.includes('NON data in cui si siano già tenute elezioni') &&
            data.includes('NON percentuale di seggi assicurata') &&
            data.includes('non un bonus aggiuntivo di 220 seggi'),
            'Effective date, vote threshold and winner seat cap must not be conflated');
          assert.ok(all.includes('ENTRAMBE le Camere') && all.includes('NON risultati elettorali realizzati'),
            'Electoral reward requires votes in both chambers and is not a realized outcome');
        }
        if (title === 'Restrizioni alle sale gioco') {
          for (const fact of ['500 m', '28/1/2014', '02–10', '23–09:30 + 12:30–14:30'])
            assert.ok(data.includes(fact), 'Lombardy/Piedmont gambling restriction ' + fact);
          assert.ok(data.includes('NON chiusura automatica') &&
            data.includes('NON data di una generale chiusura') &&
            data.includes('NON obbligo identico'),
            'New-slot installation limits and region-specific hours do not close every hall');
          assert.ok(all.includes('MODIFICATO nel 2023') && all.includes('testo consolidato del luglio 2026'),
            '2026 consolidated Piemonte law prevails over stale FAQ opening hours');
        }
        if (title === 'Menù vegetali nelle mense scolastiche') {
          for (const fact of ['4 settimane', '1ª e 3ª', '2ª', '4ª'])
            assert.ok(data.includes(fact), 'Milan school menu winter 2025/26 item ' + fact);
          assert.ok(data.includes('NON quattro giorni interamente vegani') &&
            data.includes('NON prova che l\'intero pasto sia vegano') &&
            data.includes('NON misura del consumo reale'),
            'Legume dish, vegan menu and actual consumption are different');
          assert.ok(all.includes('non si possono assumere pasti identici') &&
            all.includes('non significa necessariamente piatto VEGANO'),
            '2025/26 historic menu is not a claim about future menu or vegan certification');
        }
      } else if (['Gestazione per altri', 'Corrida', 'Centri comunali di accoglienza migranti'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        const fullText = await brief.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four sourced and contextualized facts');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': every figure must open an official source');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': laws and different yearly totals must not imply a measured causal transition');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no fabricated legal heatmap for these policy comparisons');
        const ordering = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(x => root.querySelector('[data-testid="' + x + '"]')?.getBoundingClientRect().top));
        assert.ok(ordering.every(Number.isFinite) && ordering[0] < ordering[1] && ordering[1] < ordering[2],
          title + ': summary, alternatives and evidence are in reading order');
        if (title === 'Gestazione per altri') {
          for (const fact of ['3/12/2024', '3 mesi–2 anni', '600.000–1.000.000 €', '0,4%'])
            assert.ok(data.includes(fact), 'Italian criminal statute / British IVF statistic ' + fact);
          assert.ok(data.includes('NON numero di processi') &&
            data.includes('NON durata di pena effettivamente inflitta') &&
            data.includes('NON compenso pagato alla gestante') &&
            data.includes('NON quota di bambini nati'),
            'Law, penalty, compensation and UK IVF cycle ratio must not be conflated');
          assert.ok(fullText.includes("QUESTA OPINIONE riguarda solo l'eventuale autorizzazione della GPA altruistica") &&
            fullText.includes('NON risultati elettorali realizzati') === false,
            'Canonical opinion covers altruistic surrogacy only, not commercialization');
          assert.ok(fullText.includes("nel Regno Unito") || fullText.includes("Nel Regno Unito"),
            'UK parental orders are not a universal legal parentage regime');
        }
        if (title === 'Corrida') {
          for (const fact of ['1.457', '376', '283', '177/2016'])
            assert.ok(data.includes(fact), 'Spanish national/regional events or constitutional ruling ' + fact);
          assert.ok(data.includes('NON 1.457 corride tradizionali') &&
            data.includes('già INCLUSO') &&
            data.includes('NON dato nazionale') &&
            data.includes('NON ha stabilito che ogni limitazione'),
            'Bullfights must not equal all taurine events or falsely generalize Madrid');
          assert.ok(fullText.includes('SOTTOINSIEME') &&
            fullText.includes('una SOLA comunità autonoma'),
            '2024 national and 2025 Madrid are separate denominators and periods');
        }
        if (title === 'Centri comunali di accoglienza migranti') {
          for (const fact of ['867', '41.289', '55.779', '3.202'])
            assert.ok(data.includes(fact), 'Italian SAI project capacity or 2026 call ' + fact);
          assert.ok(data.includes('non numero di Comuni') &&
            data.includes('NON tutte le persone accolte') &&
            data.includes("NON numero di posti occupati contemporaneamente") &&
            data.includes('NON posti già finanziati'),
            'Projects, spots, unique people and future call positions must be distinct');
          assert.ok(fullText.includes('1.991 Comuni') &&
            fullText.includes('NON posti già aperti'),
            'Local-authority participation and planned positions are not immediate openings');
        }
      } else if (['Parcheggi gratuiti per residenti', 'Limitazioni alla movida notturna', 'Divieto di nuovi fast food nel centro storico'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four legally contextualized evidence rows');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': every factual row cites a source');
        const all = await brief.innerText();
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': municipal rules do not prove a measured outcome');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': local ordinances are not a country-wide legal map');
        if (title === 'Parcheggi gratuiti per residenti') {
          assert.ok(all.includes('NON diritto a qualsiasi posto auto') &&
            all.includes('NON una misura della riduzione del traffico'),
            'Resident permit does not guarantee a spot or traffic reduction');
        } else if (title === 'Limitazioni alla movida notturna') {
          assert.ok(all.includes('2 novembre 2026') &&
            all.includes('NON chiusura di tutti i locali') &&
            all.includes('non è un coprifuoco cittadino'),
            'Temporary zone-specific restrictions are not blanket curfew');
        } else {
          assert.ok(all.includes('NON numero di fast food chiusi') &&
            all.includes('divieto nazionale') &&
            all.includes('NON tutti i ristoranti'),
            'Florence zoning does not imply nationwide fast-food closure');
        }
      } else if (['Autonomia Differenziata', 'Polizia locale armata', 'Sussidi comunali per famiglie numerose'].includes(title)) {
        const results = brief.getByTestId('opinion-brief-measured-results');
        await results.waitFor();
        const data = await results.innerText();
        const fullText = await brief.innerText();
        assert.equal(await results.getByTestId('opinion-brief-result').count(), 4,
          title + ': four fact rows with explanatory scope');
        assert.equal(await results.locator('[data-testid="opinion-brief-result"] a[href^="https://"]').count(), 4,
          title + ': four facts each linking to official source');
        assert.equal(await brief.getByTestId('opinion-brief-transition-arrow').count(), 0,
          title + ': dates and budgets do not prove policy impact');
        assert.equal(await brief.getByTestId('opinion-brief-legal-status').count(), 0,
          title + ': no invented country legal-permission map');
        const positions = await brief.evaluate(root =>
          ['opinion-brief-intro', 'opinion-brief-comparison', 'opinion-brief-measured-results']
            .map(id => root.querySelector('[data-testid="' + id + '"]')?.getBoundingClientRect().top));
        assert.ok(positions.every(Number.isFinite) && positions[0] < positions[1] && positions[1] < positions[2],
          title + ': summary precedes alternatives and independent facts');
        if (title === 'Autonomia Differenziata') {
          for (const fact of ['Art. 116, c. 3', '13/07/2024', '192/2024', '10/2025'])
            assert.ok(data.includes(fact), 'Italian constitutional/autonomy reference ' + fact);
          assert.ok(data.includes('NON attribuzione automatica') &&
            data.includes('non è una data di trasferimento') &&
            data.includes("NON abrogato l'intero articolo") &&
            data.includes('NON referendum svoltosi'),
            'Constitution, court rulings and rejected referendum are distinct from transfers');
          assert.ok(fullText.includes('NON ha cancellato l\'intera autonomia differenziata') &&
            fullText.includes('gli elettori non hanno votato quel referendum'),
            'Court did not abolish autonomy and referendum was never held');
        }
        if (title === 'Polizia locale armata') {
          for (const fact of ['Art. 5', '145/1987', '5%', '1 ogni anno'])
            assert.ok(data.includes(fact), 'Italian municipal police armament rule ' + fact);
          assert.ok(data.includes('NON significa che ogni agente') &&
            data.includes('NON conteggio di Comuni armati') &&
            data.includes('NON 5% di agenti armati') &&
            data.includes("NON un unico corso sufficiente"),
            'Police qualification, legal model, backup arms and training are not safety outcomes');
          assert.ok(fullText.includes('ALMENO UNO OGNI ANNO') &&
            fullText.includes('NON percentuale di operatori'),
            'Mandatory annual firearms training and reserve stock denominator');
        }
        if (title === 'Sussidi comunali per famiglie numerose') {
          for (const fact of ['250 €', '90.000 €', '25.000 €', '4 figli'])
            assert.ok(data.includes(fact), 'Ancona/Rimini 2026 family grant datum ' + fact);
          assert.ok(data.includes('NON pagamento automatico') &&
            data.includes('NON 90.000 euro già liquidati') &&
            data.includes('NON importo individuale') &&
            data.includes('NON tre figli come ad Ancona'),
            'Grant amount, budget, eligibility and payment must not be conflated');
          assert.ok(fullText.includes('TRE LINEE') &&
            fullText.includes('SCADUTE alla data 01/11/2026'),
            'Ancona fund budget covers three groups and 2026 application windows have closed');
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
    const legacy = page.locator('button[title="Approfondimento: Armi all\'Ucraina"]');
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
