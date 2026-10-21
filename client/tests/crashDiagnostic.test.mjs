import test from "node:test";
import assert from "node:assert/strict";
import { getSafeCrashDiagnostic } from "../src/lib/crashDiagnostic.ts";

test("safe diagnostic identifies a property crash and exact bundled source", () => {
  const error = new TypeError("Cannot read properties of undefined (reading 'favorevole')");
  error.stack = "TypeError: Cannot read properties of undefined (reading 'favorevole')\n at https://www.demos.community/assets/index-BcEHijwD.js:1891:8532";
  assert.equal(
    getSafeCrashDiagnostic(error),
    "DEMOS-MOBILE-ERR | TypeError | Proprietà mancante: favorevole | index-BcEHijwD.js:1891:8532"
  );
});

test("safe diagnostic never exposes a token, email address or arbitrary exception message", () => {
  const error = new Error("Bearer abc.secret123 user@example.com https://example.com/private");
  error.stack = "Error: private credentials\n at https://www.demos.community/assets/index-123.js:32:5";
  const result = getSafeCrashDiagnostic(error);
  assert.match(result, /^DEMOS-MOBILE-ERR \| Error \| Errore non classificato \| index-123.js:32:5$/);
  assert.doesNotMatch(result, /Bearer|secret|example.com|private|@/);
});

test("malicious property names and paths are excluded", () => {
  const error = {
    name: "SensitiveName",
    message: "Cannot read properties of undefined (reading 'hello@user@example.com')",
    stack: "https://attacker.test/token=abcdef/secret.txt",
  };
  assert.equal(getSafeCrashDiagnostic(error), "DEMOS-MOBILE-ERR | Error | Errore non classificato | file non disponibile");
});

test("React hook errors are classified without reporting the raw stack", () => {
  assert.match(
    getSafeCrashDiagnostic(new Error("Rendered more hooks than during the previous render.")),
    /Ordine hook React/
  );
});
