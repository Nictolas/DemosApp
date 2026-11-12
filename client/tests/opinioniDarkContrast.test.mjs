import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const base = new URL("../src/", import.meta.url);
const [styles, opinions, topics, pending, editor] = await Promise.all([
  readFile(new URL("css/color-scheme.css", base), "utf8"),
  readFile(new URL("pages/Opinioni.tsx", base), "utf8"),
  readFile(new URL("components/OpinioniTopicsMenu.tsx", base), "utf8"),
  readFile(new URL("pages/OpinioniDaCompletare.tsx", base), "utf8"),
  readFile(new URL("pages/OpinioniArgomento.tsx", base), "utf8"),
]);

function luminance(hex) {
  const rgb = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("opinions hub dark theme overrides inline pastel surfaces without layout changes", () => {
  assert.match(opinions, /className="opinioni-propose-card /);
  assert.match(opinions, /className="opinioni-button opinioni-territory-card /);
  assert.match(opinions, /--opinion-territory-accent/);
  assert.match(topics, /className="opinioni-topic-card /);
  assert.match(topics, /--opinion-topic-accent/);
  assert.match(topics, /opinioni-topic-card__progress/);
  for (const selector of [
    "html.dark .opinioni-page",
    "html.dark .opinioni-propose-card polygon:first-child",
    "html.dark .opinioni-topic-card",
    "html.dark .opinioni-topic-card__icon",
    "html.dark .opinioni-territory-card polygon:last-child",
    "html.dark .opinioni-territory-card__title",
  ]) {
    assert.ok(styles.includes(selector), "Missing dark opinion style: " + selector);
  }
  assert.match(styles, /html\.dark \.opinioni-topic-card\s*\{[^}]*background-color: color-mix\(/s);
  assert.match(styles, /html\.dark \.opinioni-territory-card__title\s*\{\s*color: #f8fafc !important/s);
});

test("pending and topical opinions editors use dark surfaces and readable answer states", () => {
  assert.match(pending, /className="opinioni-editor-page /);
  assert.match(editor, /className="opinioni-editor-page /);
  assert.match(styles, /html\.dark \.opinioni-editor-page\s*\{[^}]*background-image: linear-gradient/s);
  for (const selector of [
    "html.dark .opinioni-editor-page > header",
    "html.dark .opinioni-editor-page > main section",
    "html.dark .opinioni-editor-page > main section.bg-green-50",
    "html.dark .opinioni-editor-page > main section.bg-blue-50",
    'button[aria-pressed="false"]',
    'button[aria-pressed="true"].bg-amber-500',
    'button[aria-pressed="true"].bg-yellow-500',
    'button[aria-pressed="true"].bg-green-600',
    'button[aria-pressed="true"].bg-red-600',
  ]) {
    assert.ok(styles.includes(selector), "Missing editor contrast style: " + selector);
  }
  for (const [fg, bg] of [
    ["#f8fafc", "#1e293b"], // topic card title
    ["#cbd5e1", "#1e293b"], // topic card description
    ["#e2e8f0", "#172337"], // unselected answer
    ["#0f172a", "#fbbf24"], // selected indeciso
    ["#f8fafc", "#166534"], // selected favorevole
    ["#f8fafc", "#991b1b"], // selected contrario
  ]) {
    assert.ok(contrast(fg, bg) >= 4.5, `WCAG AA contrast too low: ${fg} on ${bg}`);
  }
});
