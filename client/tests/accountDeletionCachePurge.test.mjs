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

const authSource = readFileSync(new URL("../src/hooks/use-auth.tsx", import.meta.url), "utf8");

test("logout aborts authenticated queries and clears RAM before encrypted vault purge", () => {
  const start = authSource.indexOf("const logoutMutation = useMutation");
  const clearTokens = authSource.indexOf("clearSessionTokens();", start);
  const cancel = authSource.indexOf("await queryClient.cancelQueries();", start);
  const clearRam = authSource.indexOf("queryClient.removeQueries();", start);
  const clearSummary = authSource.indexOf("clearAllProfileSummaries();", start);
  const clearVault = authSource.indexOf("await clearAllEncryptedProfiles();", start);
  const navigation = authSource.indexOf('window.location.href = "/";', start);
  assert.ok(start >= 0 && clearTokens > start, "logout must clear credentials");
  assert.ok(cancel > clearTokens && clearRam > cancel, "logout must cancel GETs and clear RAM");
  assert.ok(clearSummary > clearRam && clearVault > clearSummary, "vault wipe must follow RAM cleanup");
  const onSuccess = authSource.indexOf("onSuccess: () =>", start);
  const fullClear = authSource.indexOf("queryClient.clear();", start);
  assert.ok(onSuccess > clearVault && fullClear > onSuccess && navigation > fullClear, "full cache clear stays in onSuccess, preserving logout navigation");
  assert.ok(navigation > clearVault, "navigation must not precede the encrypted purge");
});

test("auth session failures never log the raw HTTP response body", () => {
  const start = authSource.indexOf("if (!response.ok)");
  const end = authSource.indexOf("const result = await response.json()", start);
  assert.ok(start >= 0 && end > start, "must inspect the /auth/me error branch");
  const errorBranch = authSource.slice(start, end);
  assert.ok(errorBranch.includes("console.error("));
  assert.ok(errorBranch.includes("response.status"));
  assert.doesNotMatch(errorBranch, /response[.](?:text|json)[(]/, "response bodies may contain personal data");
});
