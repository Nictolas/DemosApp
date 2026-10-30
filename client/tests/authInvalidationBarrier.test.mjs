import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/hooks/use-auth.tsx", import.meta.url), "utf8");
const start = source.indexOf("if (response.status === 401 || response.status === 404)");
const end = source.indexOf("if (!response.ok)", start);
const block = source.slice(start, end);

test("a stale /auth/me 401 cannot erase a newer account session", () => {
  assert.ok(start >= 0 && end > start, "expected auth invalidation handler");
  const guard = block.indexOf("if (getAuthToken() !== token) return null;");
  const tokens = block.indexOf("clearSessionTokens();");
  assert.ok(guard >= 0 && tokens > guard, "check current token before any local logout");
});

test("an invalidated session cancels old queries before clearing encrypted vault", () => {
  const cancel = block.indexOf("await queryClient.cancelQueries({ predicate: nonAuthQuery });");
  const remove = block.indexOf("queryClient.removeQueries({ predicate: nonAuthQuery });");
  const wipe = block.indexOf("await clearAllEncryptedProfiles();");
  const logout = block.indexOf("setToken(null);");
  assert.ok(cancel >= 0 && remove > cancel && wipe > remove && logout > wipe);
  assert.match(block, /query\.queryKey\[0\] !== "user"/, "do not cancel the active auth query");
  assert.doesNotMatch(block, /queryClient\.clear\(\)/, "do not clear active mutation callbacks");
});
