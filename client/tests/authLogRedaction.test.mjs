import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auth = readFileSync(new URL("../src/hooks/use-auth.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/pages/Impostazioni/hooks/useLogout.ts", import.meta.url), "utf8");

function consoleDiagnostics(source) {
  return source.split("\n").filter((line) => /console\.(error|warn)\s*\(/.test(line));
}

test("auth failures do not forward exception objects into console logs", () => {
  const lines = consoleDiagnostics(auth);
  assert.ok(lines.length >= 5, "expected auth diagnostics to remain visible");
  for (const line of lines) {
    assert.doesNotMatch(line, /,\s*(?:error|err|exception)\s*\)/, "raw exception must not be logged");
  }
  assert.match(auth, /error instanceof Error && error\.name === "AbortError"/, "keep abort handling");
  assert.match(auth, /Errore fetch \/auth\/me \(dettagli omessi\)/);
  assert.match(auth, /Token JWT non decodificabile/);
  assert.match(auth, /Errore logout backend \(dettagli omessi\)/);
  assert.match(auth, /Credential Manager Android \(dettagli omessi\)/);
});

test("settings logout UI keeps a generic failure toast without logging the exception", () => {
  const lines = consoleDiagnostics(settings);
  assert.ok(lines.length > 0, "keep generic operational diagnostic");
  for (const line of lines) assert.doesNotMatch(line, /,\s*(?:error|err|exception)\s*\)/);
  assert.match(settings, /await logoutMutation\.mutateAsync\(\)/);
  assert.match(settings, /Errore durante il logout\. Riprova\./);
});
