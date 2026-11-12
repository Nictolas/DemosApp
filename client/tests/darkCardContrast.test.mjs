import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const base = new URL("../src/", import.meta.url);
const [events, signature, links, styles] = await Promise.all([
  readFile(new URL("pages/Eventi.tsx", base), "utf8"),
  readFile(new URL("pages/Proponi.tsx", base), "utf8"),
  readFile(new URL("pages/Impostazioni/components/LinksSection.tsx", base), "utf8"),
  readFile(new URL("css/color-scheme.css", base), "utf8"),
]);

function luminance(hex) {
  const rgb = [1, 3, 5].map((pos) => {
    const value = parseInt(hex.slice(pos, pos + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("dark theme has explicit semantic card surfaces and sufficient title/description contrast", () => {
  const surfaces = ["#242039", "#322b4b", "#132742", "#203b5a",
    "#112b26", "#1a3933", "#301b28", "#482635", "#332617", "#49341f"];
  for (const background of surfaces) {
    assert.ok(styles.includes(background), "CSS palette missing " + background);
    assert.ok(contrast("#f8fafc", background) >= 4.5, "title contrast below AA: " + background);
    assert.ok(contrast("#cbd5e1", background) >= 4.5, "description contrast below AA: " + background);
  }
  for (const tone of ["neutral", "info", "success", "danger", "warning"]) {
    assert.ok(styles.includes("html.dark .demos-semantic-card--" + tone));
  }
  assert.match(styles, /html\.dark \.demos-semantic-card\s*\{[^}]*background-image: linear-gradient/s);
  assert.match(styles, /html\.dark \.demos-semantic-card:hover\s*\{[^}]*background-image: linear-gradient/s);
  assert.match(styles, /html\.dark \.demos-semantic-card \.demos-semantic-card__description\s*\{\s*color: #cbd5e1;/s);
});

test("Firma and Impostazioni explicitly assign dark tones to colorful cards", () => {
  assert.match(signature, /demos-semantic-card--\$\{option\.tone\}/);
  for (const tone of ["success", "danger", "info"]) {
    assert.ok(signature.includes('tone: "' + tone + '"'));
  }
  assert.equal((links.match(/demos-semantic-card--(?:neutral|info|success|danger|warning)/g) ?? []).length, 5);
  assert.ok(signature.includes("demos-semantic-card__title"));
  assert.ok(links.includes("demos-semantic-card__description"));
});

test("all Eventi card kinds use dark palettes, with contrasted dates and admin actions", () => {
  for (const mode of ["election", "european", "other"]) {
    assert.ok(events.includes("demos-event-card--" + mode));
    assert.ok(styles.includes("html.dark .demos-event-card--" + mode));
  }
  for (const background of ["#302819", "#162740", "#1e293b"]) {
    assert.ok(contrast("#f8fafc", background) >= 4.5, "event title contrast: " + background);
    assert.ok(contrast("#cbd5e1", background) >= 4.5, "event date contrast: " + background);
  }
  for (const name of ["Modifica evento", "Elimina evento"]) {
    assert.ok(styles.includes('button[aria-label="' + name + '"]'));
  }
  const scope = styles.slice(styles.indexOf("/*\n * Contrasto delle schede pastello"));
  assert.ok(scope.length > 0);
  assert.doesNotMatch(scope, /(?:overflow|touch-action|position|height)\s*:/,
    "color-only fix must never alter the mobile page scroll or layout");
});
