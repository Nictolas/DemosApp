import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAndroidPageScrollPolicy } from '../src/lib/androidPageScrollPolicy.ts';

const fixed = [
  '/opinioni', '/opinioni-nazionali', '/opinioni-comunali',
  '/opinioni-regionali', '/opinioni-europee', '/rappresentanti',
  '/scegli-rappresentante/presidente', '/candidati', '/candidati/sindaco',
  '/registrazione-genere', '/registrazione-nome',
  '/registrazione-cittadinanza', '/registrazione-data-nascita',
  '/registrazione-consensi', '/registrazione-crea-passkey',
  '/auth', '/'
];
const scroll = [
  '/approfondimento', '/proponi-opinione', '/sondaggi',
  '/sondaggi/toscana', '/sondaggi/toscana/pisa',
  '/sondaggi/toscana/pisa/cascina', '/statistiche-utenti',
  '/statistiche-opinione', '/statistiche-opinione/123',
  '/statistiche-opinione/123/regione/toscana',
  '/legal-documents', '/data-retention', '/gdpr-rights',
  '/security-measures', '/registro-trattamenti', '/accessibilita',
  '/standard-sicurezza-minori', '/cookie-policy',
  '/terms-of-service', '/privacy-policy',
  '/audit-dashboard',
  '/monitoring-dashboard/services', '/monitoring-dashboard/security',
  '/monitoring-dashboard/memory', '/monitoring-dashboard/database',
  '/monitoring-dashboard/disk', '/monitoring-dashboard/performance',
  '/monitoring-dashboard/health', '/monitoring-dashboard/overview',
  '/violations-dashboard', '/security-dashboard', '/backup-dashboard',
  '/rate-limiting-dashboard', '/validation-dashboard', '/logging-dashboard',
  '/scopri-demos'
];
test('53 explicitly selected Android routes get the intended PAGE scroll policy',()=>{
  assert.equal(fixed.length,17); assert.equal(scroll.length,36);
  for(const path of fixed) assert.equal(getAndroidPageScrollPolicy(path),'fixed',path);
  for(const path of scroll) assert.equal(getAndroidPageScrollPolicy(path),'scroll',path);
});
test('unselected routes are untouched; patterns do not capture descendants',()=>{
  for(const path of ['/preferiti','/notifiche','/impostazioni','/gdpr',
    '/scegli-rappresentante','/candidati/a/b','/sondaggi/a/b/c/d',
    '/statistiche-opinione/12/regione/a/other','/statistiche-opinioni']) {
    assert.equal(getAndroidPageScrollPolicy(path),'inherit',path);
  }
  assert.equal(getAndroidPageScrollPolicy('/candidati/sindaco?x=1'),'fixed');
  assert.equal(getAndroidPageScrollPolicy('/sondaggi/toscana/'),'scroll');
});
test('Android-only scroll classes and internal scrolling lists exist',()=>{
  const root = new URL('../src/',import.meta.url);
  const read = p => readFileSync(new URL(p,root),'utf8');
  const css=read('index.css'),layout=read('components/RobustAppLayout.tsx');
  assert.match(css,/body\.android-device \.app-main\.android-page-scroll-fixed/);
  assert.match(css,/body\.android-device \.app-main\.android-page-scroll-enabled/);
  assert.match(layout,/getAndroidPageScrollPolicy\(location\)/);
  assert.match(layout,/android-page-scroll-fixed/);
  const candidates=read('pages/Candidati/index.tsx');
  assert.doesNotMatch(candidates,/<style jsx global>/);
  for(const page of ['OpinioniNazionali','OpinioniRegionali','OpinioniComunali','OpinioniEuropee']) {
    assert.match(read('pages/'+page+'.tsx'),/flex-1 min-h-0 overflow-y-auto app-page-scroll/);
  }
  for(const page of ['Candidati','ScegliRappresentante']) {
    assert.match(read('pages/'+page+'/index.tsx'),/flex-1 min-h-0 overflow-y-auto app-page-scroll/);
  }
  // Even an empty representatives/candidates list must not clip its call to action.
  assert.match(read('pages/ScegliRappresentante/index.tsx'),/overflow-y-auto app-page-scroll[^>]*>\s*<EmptyState/);
});

test('all 10 approved legal URLs are real routes; public policies keep their own fixed footer',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  for(const route of scroll.slice(-10)) {
    assert.equal(getAndroidPageScrollPolicy(route),'scroll');
    assert.ok(app.includes('<Route path="'+route+'">'),'missing routed legal page: '+route);
    assert.equal(getAndroidPageScrollPolicy(route+'/?from=registration#section'),'scroll',route);
    assert.equal(getAndroidPageScrollPolicy(route+'/other'),'inherit',route);
  }
  const root=new URL('../src/pages/',import.meta.url);
  for(const name of ['PrivacyPolicy','TermsOfService']) {
    const page=readFileSync(new URL(name+'.tsx',root),'utf8');
    assert.match(page,/className="fixed bottom-0/);
    assert.match(page,/pb-28/);
  }
  // Public pages deliberately omit the bottom app navbar; body must stay
  // stationary while the main container remains scrollable.
  const shell=readFileSync(new URL('../src/components/RobustAppLayout.tsx',import.meta.url),'utf8');
  for(const publicRoute of ['/privacy-policy','/terms-of-service','/cookie-policy']) {
    assert.ok(shell.includes("'"+publicRoute+"'"));
  }
});

test('all newly approved entry and dashboard routes exist; only their page scroll changes',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const scrollAdditions=["/audit-dashboard","/monitoring-dashboard/services","/monitoring-dashboard/security","/monitoring-dashboard/memory","/monitoring-dashboard/database","/monitoring-dashboard/disk","/monitoring-dashboard/performance","/monitoring-dashboard/health","/violations-dashboard","/security-dashboard","/backup-dashboard","/rate-limiting-dashboard","/validation-dashboard","/logging-dashboard","/monitoring-dashboard/overview","/scopri-demos"];
  const fixedAdditions=["/registrazione-genere","/registrazione-nome","/registrazione-cittadinanza","/registrazione-data-nascita","/registrazione-consensi","/registrazione-crea-passkey","/auth","/"];
  assert.equal(scrollAdditions.length,16);
  assert.equal(fixedAdditions.length,8);
  for(const route of scrollAdditions){
    assert.ok(app.includes('<Route path="'+route+'">'),'missing dashboard/public route: '+route);
    assert.equal(getAndroidPageScrollPolicy(route),'scroll',route);
    assert.equal(getAndroidPageScrollPolicy(route+'?view=active#overview'),'scroll',route);
    assert.equal(getAndroidPageScrollPolicy(route+'/extra'),'inherit',route);
  }
  for(const route of fixedAdditions){
    assert.ok(app.includes('<Route path="'+route+'">'),'missing entry/registration route: '+route);
    assert.equal(getAndroidPageScrollPolicy(route),'fixed',route);
    assert.equal(getAndroidPageScrollPolicy(route==='/'?'/auth?mode=login':route+'?source=onboarding'),'fixed',route);
  }
  assert.equal(getAndroidPageScrollPolicy('/registrazione-3-residenza'),'inherit');
  assert.equal(getAndroidPageScrollPolicy('/monitoring-dashboard'),'inherit');
  assert.equal(getAndroidPageScrollPolicy('/reset-password'),'inherit');
  // A fixed page is not allowed to lock the body globally. Dialogs/lists
  // continue using independent scrollable containers, outside this policy.
  const css=readFileSync(new URL('../src/index.css',import.meta.url),'utf8');
  assert.match(css,/\.app-main\.android-page-scroll-fixed/);
  assert.match(css,/\.app-main\.android-page-scroll-enabled/);
  assert.match(css,/\.app-main\.android-page-scroll-fixed > \.app-main__inner/);
});

test('fixed registration screens protect the action buttons with an inner scroll area',()=>{
  const src=new URL('../src/',import.meta.url);
  const css=readFileSync(new URL('index.css',src),'utf8');
  assert.match(css,/\.android-fixed-registration > \.android-fixed-registration__panel/);
  assert.match(css,/\.android-fixed-registration__panel \{[\s\S]*?overflow-y:\s*auto/);
  for(const name of [
    'registrazione-nome','registrazione-genere','registrazione-cittadinanza',
    'registrazione-data-nascita','registrazione-consensi',
    'registrazione-crea-passkey'
  ]){
    const file=readFileSync(new URL('pages/'+name+'.tsx',src),'utf8');
    assert.match(file,/android-fixed-registration/);
    assert.match(file,/android-fixed-registration__panel/);
  }
  // The mobile login/landing has its existing dedicated internal
  // short-viewport fallback; do not globally disable its auth controls.
  const landing=readFileSync(new URL('pages/landing-mobile.css',src),'utf8');
  assert.match(landing,/\.landing-mobile\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.equal(getAndroidPageScrollPolicy('/'),'fixed');
  assert.equal(getAndroidPageScrollPolicy('/auth'),'fixed');
});
