import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const toastSource = readFileSync(fileURLToPath(new URL("../src/components/ui/toast.tsx", import.meta.url)), "utf8");

test("all toast variants receive an opaque white root background", () => {
  assert.match(toastSource, /border bg-white text-slate-900/);
  assert.match(toastSource, /style=\{\{ \.\.\.style, backgroundColor: "#ffffff" \}\}/);
  assert.match(toastSource, /default: "border-slate-200"/);
  assert.match(toastSource, /destructive:\s*"destructive group border-red-300 text-red-900"/);
  assert.match(toastSource, /success:\s*"border-green-500 text-green-800"/);
});

test("toast exit does not fade translucently over underlying content", () => {
  assert.doesNotMatch(toastSource, /fade-out-80/);
});

test("close control remains visible without hovering, including on mobile", () => {
  assert.match(toastSource, /text-slate-600 opacity-100/);
});
