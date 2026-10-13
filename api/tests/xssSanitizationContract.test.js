const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CLIENT_SRC = path.join(ROOT, 'client', 'src');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() ? [full] : [];
  });
}

test('rich HTML sanitizer uses DOMPurify with a narrow allowlist', () => {
  const sanitizer = read('client/src/lib/sanitize-html.ts');
  assert.match(sanitizer, /import DOMPurify from ['"]dompurify['"]/);
  assert.match(sanitizer, /ALLOWED_TAGS:\s*RICH_TEXT_TAGS/);
  assert.match(sanitizer, /ALLOWED_ATTR:\s*RICH_TEXT_ATTRS/);
  assert.match(sanitizer, /ALLOW_DATA_ATTR:\s*false/);
  assert.match(sanitizer, /ALLOW_ARIA_ATTR:\s*false/);
  assert.doesNotMatch(sanitizer, /['"]style['"]/);
  assert.doesNotMatch(sanitizer, /['"]script['"]/);
  assert.doesNotMatch(sanitizer, /['"]iframe['"]/);
});

test('all application rich HTML sinks are sanitized at the render boundary', () => {
  const files = walk(CLIENT_SRC).filter((file) => file.endsWith('.tsx'));
  const violations = [];

  for (const file of files) {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/');
    const source = fs.readFileSync(file, 'utf8');

    // chart.tsx builds static CSS from local theme constants; it does not render API/user HTML.
    if (relative === 'client/src/components/ui/chart.tsx') continue;

    let index = source.indexOf('dangerouslySetInnerHTML');
    while (index !== -1) {
      const window = source.slice(index, index + 500);
      if (!window.includes('sanitizeRichHtml(')) {
        const line = source.slice(0, index).split('\n').length;
        violations.push(`${relative}:${line}`);
      }
      index = source.indexOf('dangerouslySetInnerHTML', index + 1);
    }
  }

  assert.deepEqual(violations, []);
});

test('notification rich text is sanitized before rendering', () => {
  const utils = read('client/src/pages/Notifiche/utils/notificheUtils.ts');
  const item = read('client/src/pages/Notifiche/components/NotificaItem.tsx');
  assert.match(utils, /getNotificaTitle[\s\S]*sanitizeRichHtml/);
  assert.match(utils, /getNotificaMessage[\s\S]*sanitizeRichHtml/);
  assert.match(item, /sanitizeRichHtml\(titoloString\)/);
  assert.match(item, /sanitizeRichHtml\(msg\)/);
  assert.match(item, /sanitizeRichHtml\(lineaFormattata\)/);
  assert.match(item, /sanitizeRichHtml\(lineaEvidenziata\)/);
});
