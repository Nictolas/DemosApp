const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('minister-to-profile navigation only mounts the new route', () => {
  const app = read('client/src/App.tsx');
  const navbar = read('client/src/lib/nav-items.ts');
  const minister = read('client/src/pages/Governo/[slug]/index.tsx');
  const transition = read('client/src/components/PageTransition.tsx');

  assert.match(app, /<Route path="\/governo\/:slug">/);
  assert.match(app, /<Route path="\/profilo">/);
  assert.match(navbar, /path: "\/profilo"/);
  assert.match(minister, /if \(!ministero\)/);
  assert.match(minister, /<Redirect to="\/governo"\s*\/>/);

  // A stale ministry subtree could redirect after the user visits Profile.
  // PageTransition must render only its current children immediately.
  assert.match(transition, /\{children\}/);
  assert.doesNotMatch(transition, /childrenRef|displayContent|setContent\(|previousChildren|previousLocation/);
  assert.doesNotMatch(transition, /setTimeout|setInterval/);
});

test('rapid navbar navigation cannot strand pages invisible', () => {
  const transition = read('client/src/components/PageTransition.tsx');
  const styles = read('client/src/index.css');
  assert.match(transition, /demos-route-enter/);
  assert.match(transition, /page-visible/);
  assert.match(transition, /fade-up-visible/);
  assert.match(transition, /fade-side-visible/);
  assert.doesNotMatch(transition, /visibleLocation|setVisibleLocation|page-hidden|page-loader/);
  assert.match(styles, /\.fade-up-transition\.demos-route-enter/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
