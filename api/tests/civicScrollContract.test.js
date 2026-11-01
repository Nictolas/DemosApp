'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('only the intended civic routes use the bounded scroll shell', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const css = read('client/src/robust-layout.css');

  assert.ok(layout.includes("location === '/avvistamenti' || location === '/vota-iniziativa-popolare' || location === '/grazia' || location === '/amnistia' || location === '/capo-stato' || location === '/capo-di-stato'"));
  assert.ok(layout.includes("${isScrollableContentPage ? ' app-main--scroll-content' : ''}"));
  assert.ok(css.includes('.app-main.app-main--scroll-content {\n  overflow-y: hidden !important;'));
  assert.ok(css.includes('.app-main.app-main--scroll-content .fade-up-transition {'));
  assert.ok(css.includes('  height: 100%;\n  min-height: 0;\n  overflow: hidden;'));
});

test('signature collections can scroll all results above the mobile navbar', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  for (const [route, path, label, list] of [
    ['/iniziative-popolari', 'client/src/pages/IniziativePopolari/index.tsx', 'Elenco iniziative popolari', '<IniziativeTable'],
    ['/eci', 'client/src/pages/ECI/index.tsx', 'Elenco ECI', 'displayList.map'],
    ['/referendum-abrogativi', 'client/src/pages/ReferendumAbrogativi/index.tsx', 'Elenco referendum abrogativi', '<ReferendumTable'],
  ]) {
    assert.ok(layout.includes(`location === '${route}'`), `${route} must use the bounded scroll shell`);
    const page = read(path);
    assert.match(page, /<PageContainer className="overflow-hidden">/);
    assert.match(page, /className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain\b/);
    assert.ok(page.includes(`aria-label="${label}"`));
    assert.match(page, /tabIndex=\{0\}/);
    assert.ok(page.indexOf('app-page-scroll min-h-0') < page.indexOf(list), `${route} listing must be inside the scroll area`);
    assert.doesNotMatch(page, /page-with-navbar/);
  }
});

test('notification preferences scroll independently of fixed save action and navbar', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const page = read('client/src/pages/NotifichePreferenze.tsx');
  const app = read('client/src/App.tsx');

  assert.ok(layout.includes("location === '/notifiche/preferenze'"));
  assert.ok(app.includes('<Route path="/notifiche/preferenze">'));
  assert.match(page, /<PageContainer className="overflow-hidden/);
  assert.match(page, /app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(page, /aria-label="Impostazioni preferenze notifiche"/);
  assert.match(page, /tabIndex=\{0\}/);
  assert.ok(page.indexOf('app-page-scroll min-h-0') < page.indexOf('sezioni.map('));
  assert.ok(page.indexOf('sezioni.map(') < page.indexOf('shrink-0 border-t border-gray-200'));
  assert.ok(page.indexOf('shrink-0 border-t border-gray-200') < page.indexOf('onClick={handleSave}'));
  assert.doesNotMatch(page, /sticky bottom-4/);
  assert.ok(page.includes('onCheckedChange={(checked) => handleSwitch(item.key, checked)}'));
  assert.ok(page.includes('disabled={isSaving}'));
});

test('popular initiative voting can scroll all cards above the app navbar', () => {
  const page = read('client/src/pages/VotaIniziativaPopolare/index.tsx');
  assert.match(page, /<PageContainer className="overflow-hidden/);
  assert.match(page, /className="app-page-scroll min-h-0 flex-1 overflow-y-auto/);
  assert.match(page, /aria-label="Iniziative popolari"/);
  assert.ok(page.indexOf('app-page-scroll min-h-0') < page.indexOf('<IniziativeStatsChart'));
  assert.ok(page.indexOf('<IniziativeRanking') < page.indexOf('{/* Dialog di visualizzazione iniziativa */}'));
  assert.doesNotMatch(page, /min-h-screen bg-gradient-to-b from-background/);
});

test('Iniziative Popolari voting header must not link back to Vota', () => {
  const header = read('client/src/pages/VotaIniziativaPopolare/components/Header.tsx');
  assert.ok(!header.includes('href="/vota"'));
  assert.ok(!header.includes('Torna a Vota'));
  assert.ok(!header.includes('<ArrowLeft'));
});

test('Grazia keeps title and voting controls fixed; only ranking scrolls', () => {
  const page = read('client/src/pages/Grazia/index.tsx');
  const header = read('client/src/pages/Grazia/components/Header.tsx');
  const app = read('client/src/App.tsx');
  assert.ok(app.includes('<Route path="/grazia">'));
  assert.match(page, /<PageContainer className="overflow-hidden/);
  assert.match(page, /grazia-page__fixed-header shrink-0/);
  assert.match(page, /grazia-page__fixed-controls min-h-0 shrink-0/);
  assert.match(page, /className="app-page-scroll min-h-0 min-w-0 overflow-y-auto/);
  assert.match(page, /aria-label="Classifica Grazia"/);
  assert.ok(page.indexOf('grazia-page__fixed-header') < page.indexOf('app-page-scroll min-h-0'));
  assert.ok(page.indexOf('grazia-page__fixed-controls') < page.indexOf('app-page-scroll min-h-0'));
  assert.ok(page.indexOf('<GraziaForm') < page.indexOf('app-page-scroll min-h-0'));
  assert.ok(page.indexOf('app-page-scroll min-h-0') < page.indexOf('<ClassificaCarcerati'));
  assert.ok(page.indexOf('<ClassificaCarcerati') < page.indexOf('{/* Dialog separato dalla classifica scorrevole. */}'));
  assert.ok(!header.includes('<Link'), 'Header must not contain navigation links');
  assert.ok(!header.includes('href="/vota"'), 'No back-to-Vota route');
  assert.ok(!header.includes('Torna a Vota'), 'No back-to-Vota button');
  assert.ok(!header.includes('<ArrowLeft'), 'No back arrow');
  assert.doesNotMatch(page, /page-with-navbar/);
});

test('Capo di Stato keeps title/consent/voting controls fixed while only ranking rows scroll', () => {
  const app = read('client/src/App.tsx');
  const page = read('client/src/pages/CapodiStato/index.tsx');
  const header = read('client/src/pages/CapodiStato/components/Header.tsx');
  const ranking = read('client/src/pages/CapodiStato/components/CandidatesRanking.tsx');

  assert.ok(app.includes('<Route path="/capo-stato">'));
  assert.ok(app.includes('<Route path="/capo-di-stato">'));
  assert.match(page, /<PageContainer className="capo-di-stato-page overflow-hidden/);
  assert.match(page, /capo-stato__fixed-header shrink-0/);
  assert.match(page, /capo-stato__fixed-controls min-h-0/);
  assert.ok(page.indexOf('capo-stato__fixed-header') < page.indexOf('capo-stato__fixed-controls'));
  assert.ok(page.indexOf('capo-stato__fixed-controls') < page.indexOf('<CandidatesRanking'));
  assert.match(ranking, /className="app-page-scroll min-h-0 flex-1 overflow-y-auto/);
  assert.match(ranking, /aria-label="Lista candidati Capo di Stato"/);
  assert.ok(ranking.indexOf('<CardHeader') < ranking.indexOf('app-page-scroll min-h-0'));
  assert.ok(!header.includes('<Link'), 'Capo di Stato header must have no links');
  assert.ok(!header.includes('href="/vota"'), 'No back-to-Vota route');
  assert.ok(!header.includes('Torna a Vota'), 'No back-to-Vota text');
  assert.ok(!header.includes('<ArrowLeft'), 'No back arrow');
  assert.doesNotMatch(page, /min-h-screen bg-gradient|page-with-navbar/);
});


test('Amnistia fixes header and voting form; only offence rows scroll', () => {
  const app = read('client/src/App.tsx');
  const page = read('client/src/pages/Amnistia/index.tsx');
  const header = read('client/src/pages/Amnistia/components/Header.tsx');
  const ranking = read('client/src/pages/Amnistia/components/ClassificaLeggi.tsx');
  assert.ok(app.includes('<Route path="/amnistia">'));
  assert.match(page, /<PageContainer className="overflow-hidden/);
  assert.match(page, /amnistia-page__fixed-header shrink-0/);
  assert.match(page, /amnistia-page__fixed-controls min-h-0/);
  assert.ok(page.indexOf('amnistia-page__fixed-header') < page.indexOf('amnistia-page__fixed-controls'));
  assert.ok(page.indexOf('<AmnistiaForm') < page.indexOf('<ClassificaLeggi'));
  assert.match(ranking, /className="app-page-scroll min-h-0 flex-1 overflow-y-auto/);
  assert.match(ranking, /aria-label="Lista reati Amnistia"/);
  assert.ok(ranking.indexOf('<CardHeader') < ranking.indexOf('app-page-scroll min-h-0'));
  assert.ok(!header.includes('<Link'), 'Amnistia must not show back-to-Vota links');
  assert.ok(!header.includes('href="/vota"'), 'Amnistia must not link to Vota');
  assert.doesNotMatch(page, /page-with-navbar|min-h-screen bg-gradient/);
});

test('Capo di Stato shows a real mobile pie alongside consent statistics', () => {
  const consent = read('client/src/pages/CapodiStato/components/ConsensoSection.tsx');
  assert.match(consent, /data-testid="capo-consenso-pie-mobile"/);
  assert.match(consent, /aria-label="Grafico a torta consenso Capo di Stato"/);
  assert.match(consent, /Ti senti rappresentato dall'attuale Capo di Stato\?/);
  assert.doesNotMatch(consent, /<CardTitle[^>]*>\s*Consenso/);
  assert.match(consent, /max-w-sm justify-center/);
  assert.match(consent, /innerRadius="34%"/);
  assert.match(consent, /outerRadius="89%"/);
  assert.match(consent, /min-\[390px\]:h-28/);
  assert.match(consent, /isAnimationActive=\{false\}/);
  assert.match(consent, /PieChart/);
});

test('sightings header stays visible while all three categories scroll', () => {
  const page = read('client/src/pages/Avvistamenti/index.tsx');
  assert.match(page, /<PageContainer className="overflow-hidden/);
  assert.match(page, /container mx-auto h-full min-h-0 w-full flex flex-col/);
  assert.match(page, /className="app-page-scroll min-h-0 flex-1 overflow-y-auto/);
  assert.match(page, /aria-label="Categorie degli avvistamenti"/);
  assert.ok(page.indexOf('{/* Header */}') < page.indexOf('app-page-scroll min-h-0'));
  assert.ok(page.indexOf('app-page-scroll min-h-0') < page.indexOf('emergencySections.map'));
  for (const section of ['emergenze', 'decoro-urbano', 'sicurezza']) {
    assert.ok(page.includes(`id: "${section}"`));
  }
});
