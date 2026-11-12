import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

async function loadColorScheme() {
  const path = fileURLToPath(new URL("../src/lib/colorScheme.ts", import.meta.url));
  const source = await readFile(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import("data:text/javascript;base64," + Buffer.from(compiled.outputText).toString("base64"));
}

test("dark mode defaults to system, reacts to changes and remains device-only", async () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  try {
    const entries = new Map();
    const classes = new Set();
    const listeners = {};
    const media = {
      matches: true,
      addEventListener(_event, callback) { listeners.media = callback; },
    };
    const themeMeta = {
      setAttribute(_key, value) { entries.set("meta", value); },
    };
    globalThis.window = {
      matchMedia: () => media,
      localStorage: {
        getItem: (key) => entries.get(key) ?? null,
        setItem: (key, value) => entries.set(key, value),
        removeItem: (key) => entries.delete(key),
      },
      addEventListener(event, callback) { listeners[event] = callback; },
    };
    globalThis.document = {
      documentElement: {
        classList: {
          toggle(key, enabled) { if (enabled) classes.add(key); else classes.delete(key); },
        },
        style: {},
      },
      querySelector: (selector) => selector === 'meta[name="theme-color"]' ? themeMeta : null,
    };

    const scheme = await loadColorScheme();
    assert.equal(scheme.readColorSchemePreference(), "system");
    scheme.initializeColorScheme();
    assert.ok(classes.has("dark"));
    assert.equal(globalThis.document.documentElement.style.colorScheme, "dark");
    assert.equal(entries.get("meta"), "#0b1220");

    media.matches = false;
    listeners.media();
    assert.ok(!classes.has("dark"));

    scheme.saveColorSchemePreference("dark");
    assert.ok(classes.has("dark"));
    assert.equal(entries.get("demos:color-scheme"), "dark");

    listeners.media();
    assert.ok(classes.has("dark"), "manual selection must override system changes");

    scheme.saveColorSchemePreference("system");
    assert.ok(!entries.has("demos:color-scheme"), "automatic is represented by no stored key");
    assert.ok(!classes.has("dark"));
    media.matches = true;
    listeners.media();
    assert.ok(classes.has("dark"));

    entries.set("demos:color-scheme", "light");
    listeners.storage({ key: "demos:color-scheme" });
    assert.ok(!classes.has("dark"));
    assert.equal(entries.get("meta"), "#1E1E1E");
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});

test("unrecognized stored preferences do not activate arbitrary themes", async () => {
  const oldWindow = globalThis.window;
  try {
    globalThis.window = { localStorage: { getItem: () => "custom" } };
    const scheme = await loadColorScheme();
    assert.equal(scheme.readColorSchemePreference(), "system");
  } finally {
    globalThis.window = oldWindow;
  }
});
