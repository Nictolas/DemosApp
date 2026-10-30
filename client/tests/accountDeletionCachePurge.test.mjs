import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/Impostazioni/CancellaAccount/index.tsx", import.meta.url), "utf8");

test("account deletion revokes local tokens, cancels GETs, clears RAM and awaits encrypted IndexedDB purge", () => {
  const start = source.indexOf('await apiRequest("DELETE", "/api/user/delete-account"');
  const clearToken = source.indexOf("clearSessionTokens();", start);
  const cancel = source.indexOf("await queryClient.cancelQueries();", start);
  const clearRam = source.indexOf("queryClient.clear();", start);
  const clearSummary = source.indexOf("clearAllProfileSummaries();", start);
  const clearVault = source.indexOf("await clearAllEncryptedProfiles();", start);
  const navigate = source.indexOf('window.location.assign("/");', start);
  assert.ok(start >= 0, "must wait for successful account DELETE before purging local data");
  assert.ok(clearToken > start && cancel > clearToken && clearRam > cancel);
  assert.ok(clearSummary > clearRam && clearVault > clearSummary && navigate > clearVault);
  assert.doesNotMatch(source.slice(start, navigate), /void clearAllEncryptedProfiles\(\)/);
  assert.match(source, /import \{ useQueryClient \} from "@tanstack\/react-query"/);
});
