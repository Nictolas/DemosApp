const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('minister-to-profile navigation never mounts the old ministry within the new route', () => {
  const app = read('client/src/App.tsx');
  const navbar = read('client/src/lib/nav-items.ts');
  const minister = read('client/src/pages/Governo/[slug]/index.tsx');
  const transition = read('client/src/components/PageTransition.tsx');

  assert.match(app, /<Route path="\/governo\/:slug">/);
  assert.match(app, /<Route path="\/profilo">/);
  assert.match(navbar, /path: "\/profilo"/);
  assert.match(minister, /if \(!ministero\)/);
  assert.match(minister, /<Redirect to="\/governo"\s*\/>/);

  // Rendering the exiting minister page after navigation would invoke that
  // Redirect with the new route params and override the Profile click.
  assert.match(transition, /const actualLocation = location \?\? currentLocation/);
  assert.match(transition, /const isVisible = visibleLocation === actualLocation/);
  assert.match(transition, />\s*\{children\}\s*<\/div>/);
  assert.doesNotMatch(transition, /childrenRef|displayContent|setContent\(/);
});

test('rapid navbar navigation cannot leave the route hidden by an abandoned timer', () => {
  const transition = read('client/src/components/PageTransition.tsx');
  assert.match(transition, /window\.setTimeout\(/);
  assert.match(transition, /return \(\) => window\.clearTimeout\(timer\)/);
  assert.match(transition, /\[actualLocation, isVisible, delay, showLoader, loaderDuration\]/);
  assert.match(transition, /setVisibleLocation\(actualLocation\)/);
  assert.doesNotMatch(transition, /isPending\.current/);
});
