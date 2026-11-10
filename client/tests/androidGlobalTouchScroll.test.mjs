import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Menu must not attach a document-wide touch-scroll blocker', () => {
  const menu = read('../src/pages/Menu/hooks/useMenuData.ts');
  const hook = read('../src/hooks/useNoScroll.ts');
  assert.doesNotMatch(menu, /useNoScroll/);
  assert.doesNotMatch(hook, /addEventListener\(['"]touchmove['"]/);
  assert.doesNotMatch(hook, /addEventListener\(['"]wheel['"]/);
  assert.match(hook, /bodyOverflow: body\.overflow/);
  assert.match(hook, /htmlOverflow: html\.overflow/);
  assert.match(hook, /body\.overflow = previous\.bodyOverflow/);
  assert.match(hook, /html\.overflow = previous\.htmlOverflow/);
});

test('Mobile keeps native touch gestures and nested scroll chaining', () => {
  const css = read('../src/index.css');
  assert.doesNotMatch(css, /\*\s*\{\s*touch-action:\s*pan-y\s*!important/);
  assert.doesNotMatch(css, /\*\s*\{\s*overscroll-behavior:\s*none\s*!important/);
  assert.match(css, /body\.android-device \.app-main/);
  assert.match(css, /body\.android-device \.app-main \[data-radix-scroll-area-viewport\]/);
  assert.match(css, /touch-action: auto !important/);
  assert.match(css, /overscroll-behavior-y: auto/);
});
