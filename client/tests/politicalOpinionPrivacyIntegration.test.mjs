import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");

test("statistics selector isolates political answer cache by account and verified consent epoch", () => {
  const selector = read("pages/StatisticheOpinione/components/OpinionSelector.tsx");
  assert.match(selector, /useAuth\(\)/);
  assert.match(selector, /queryKey: \['statsOpinionQuestions', user\?\.id, verifiedPoliticalConsent\?\.timestamp, grado\]/);
  assert.match(selector, /enabled: !!user\?\.id && isSessionVerified && verifiedPoliticalConsent\?\.granted === true/);
  assert.match(selector, /queryFn: async \(\{ signal \}\) => \{/);
  assert.match(selector, /undefined, undefined, signal/);
  assert.match(selector, /return response\.data/);
  assert.doesNotMatch(selector, /console\.(?:log|error)\s*\(/);
  assert.doesNotMatch(selector, /queryKey: \['opinioniQuestions', grado\]/);
});

test("verified remote revocation cancels statistics as well as editors and profile snapshots", () => {
  const auth = read("hooks/use-auth.tsx");
  assert.match(auth, /"statsOpinionQuestions"/);
  assert.match(auth, /"opinioniQuestions"/);
  assert.match(auth, /"profilePolitical"/);
  assert.match(auth, /"profileFull"/);
  const cancel = auth.indexOf("await queryClient.cancelQueries({ predicate: personalToCancel })");
  const remove = auth.indexOf("queryClient.removeQueries({ predicate: personalToCancel })");
  const wipe = auth.indexOf("await clearEncryptedProfile(owner)");
  assert.ok(cancel > 0 && remove > cancel && wipe > remove, "remote revoke must cancel, purge RAM and then wipe disk");
  assert.match(auth, /query\.queryKey\[1\] === owner/);
});

test("central API client never writes raw responses or personal political answers to the console", () => {
  const client = read("lib/queryClient.ts");
  assert.doesNotMatch(client, /Text preview|Parsed data|Text that failed to parse/);
  assert.doesNotMatch(client, /console\.(?:log|error)\([^\n]*(?:text|JSON\.stringify\(data|data\.data)/);
  assert.match(client, /externalSignal\?: AbortSignal/);
  assert.match(client, /externalSignal\?\.removeEventListener\("abort", abortFromQuery\)/);
});

test("local GDPR revoke cancels stats and editors before discarding encrypted snapshots", () => {
  const gdpr = read("pages/GDPR/index.tsx");
  const cancel = gdpr.indexOf("queryClient.cancelQueries({ queryKey: ['statsOpinionQuestions'] })");
  const remove = gdpr.indexOf("queryClient.removeQueries({ queryKey: ['statsOpinionQuestions'] })");
  const disk = gdpr.indexOf("await clearAllEncryptedProfiles()");
  assert.ok(cancel > 0 && remove > cancel && disk > remove);
});
