/**
 * Minimal diagnostic safe to show on a public error screen.
 * Never copy an untrusted exception message, URL, token, stack trace or user data.
 */
export function getSafeCrashDiagnostic(error: unknown): string {
  const candidate = error && typeof error === "object" ? error as { name?: unknown; message?: unknown; stack?: unknown } : {};
  const allowedNames = new Set(["TypeError", "ReferenceError", "RangeError", "SyntaxError", "Error"]);
  const name = typeof candidate.name === "string" && allowedNames.has(candidate.name) ? candidate.name : "Error";
  const message = typeof candidate.message === "string" ? candidate.message : "";

  let category = "Errore non classificato";
  // Only constant, identifier-shaped property names are exposed. No raw messages.
  const missingProperty = /^Cannot read properties of (?:undefined|null) \(reading ['"]([a-zA-Z_$][\w$]{0,47})['"]\)/.exec(message);
  if (missingProperty) {
    category = `Proprietà mancante: ${missingProperty[1]}`;
  } else if (/^Rendered (?:more|fewer) hooks than (?:during the previous render|expected)/.test(message)) {
    category = "Ordine hook React";
  } else if (message.startsWith("Maximum update depth exceeded")) {
    category = "Aggiornamento React ricorsivo";
  } else if (/^Minified React error #[0-9]{1,4}/.test(message)) {
    category = message.match(/^Minified React error #[0-9]{1,4}/)?.[0] || category;
  } else if (/^([a-zA-Z_$][\w$]{0,47}) is not defined/.test(message)) {
    category = "Riferimento non definito";
  }

  const stack = typeof candidate.stack === "string" ? candidate.stack : "";
  // Only a public, immutable JS asset filename/position, not the source stack/URL.
  const source = /(?:^|\/)assets\/([a-zA-Z0-9_.-]{1,90}\.js)(?::([0-9]{1,8}):([0-9]{1,8}))?/.exec(stack);
  const location = source
    ? `${source[1]}${source[2] && source[3] ? `:${source[2]}:${source[3]}` : ""}`
    : "file non disponibile";

  return `DEMOS-MOBILE-ERR | ${name} | ${category} | ${location}`;
}
