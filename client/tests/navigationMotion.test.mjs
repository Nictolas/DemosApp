import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const transition = read('../src/components/PageTransition.tsx');
const helper = read('../src/hooks/useSmoothNavigation.ts');
const profile = read('../src/pages/Profilo/index.tsx');
const compass = read('../src/pages/CompassoPolitico.tsx');
const styles = read('../src/index.css');
const app = read('../src/App.tsx');
const browserNavigation = read('../src/hooks/useBrowserNavigation.ts');

test('route changes never delay rendering or retain an old route', () => {
  assert.match(transition, /demos-route-enter/);
  assert.match(transition, /\{children\}/);
  assert.doesNotMatch(transition, /setTimeout|visibleLocation|page-hidden|page-loader/);
  assert.match(styles, /animation: demos-route-appear 190ms/);
  assert.match(styles, /animation: demos-route-slide 220ms/);
});

test('Compass has an optional shared-element transition and safe fallback', () => {
  assert.match(profile, /href="\/compasso-politico"/);
  assert.match(profile, /demos-compass-source/);
  assert.match(profile, /navigateSmoothly\("\/compasso-politico", "forward"\)/);
  assert.match(compass, /demos-compass-destination/);
  assert.match(compass, /navigateSmoothly\("\/profilo", "back"\)/);
  assert.match(helper, /startViewTransition/);
  assert.match(helper, /flushSync\(\(\) => setLocation\(to\)\)/);
  assert.match(helper, /setLocation\(to\);/);
  assert.match(styles, /::view-transition-group\(demos-compass\)/);
});

test('return restores only scroll position, without replacing nested scrollports', () => {
  assert.match(profile, /rememberProfileScroll\(scrollRegionRef\.current\?\.scrollTop \?\? 0\)/);
  assert.match(profile, /ref=\{scrollRegionRef\} className="app-page-scroll/);
  assert.match(profile, /new ResizeObserver\(restore\)/);
  assert.match(helper, /let profileScrollToRestore: number \| null = null/);
  assert.doesNotMatch(helper, /localStorage|sessionStorage|fetch\(|apiRequest/);
  assert.doesNotMatch(styles.slice(styles.indexOf('/* DEMOS navigation motion v2')), /touch-action|overflow:\s*hidden|pointer-events:\s*none/);
});

test('reduced motion and loading skeleton are available', () => {
  assert.match(helper, /prefers-reduced-motion: reduce/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(compass, /demos-compass-skeleton/);
  assert.match(compass, /role="status"/);
  assert.match(compass, /sr-only">Caricamento delle tue Opinioni/);
  assert.match(styles, /demos-compass-content > :nth-child\(3\)/);
});

test('swipe and keyboard back from Compass return to Profile', () => {
  assert.match(app, /'\\/compasso-politico': '\\/profilo'/);
  assert.match(browserNavigation, /'\\/compasso-politico': '\\/profilo'/);
});
