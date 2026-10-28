import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAndroidPageScrollPolicy } from '../src/lib/androidPageScrollPolicy.ts';

const fixed = [
  '/opinioni', '/opinioni-nazionali', '/opinioni-comunali',
  '/opinioni-regionali', '/opinioni-europee', '/rappresentanti',
  '/scegli-rappresentante/presidente', '/candidati', '/candidati/sindaco'
];
const scroll = [
  '/approfondimento', '/proponi-opinione', '/sondaggi',
  '/sondaggi/toscana', '/sondaggi/toscana/pisa',
  '/sondaggi/toscana/pisa/cascina', '/statistiche-utenti',
  '/statistiche-opinione', '/statistiche-opinione/123',
  '/statistiche-opinione/123/regione/toscana'
];
test('19 explicitly selected Android routes get the intended PAGE scroll policy',()=>{
  assert.equal(fixed.length,9); assert.equal(scroll.length,10);
  for(const path of fixed) assert.equal(getAndroidPageScrollPolicy(path),'fixed',path);
  for(const path of scroll) assert.equal(getAndroidPageScrollPolicy(path),'scroll',path);
});
test('unselected routes are untouched; patterns do not capture descendants',()=>{
  for(const path of ['/', '/preferiti','/notifiche','/impostazioni','/gdpr',
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
