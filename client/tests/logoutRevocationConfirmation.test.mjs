import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requestLogoutRevocation, runBoundedLogoutSideEffect } from "../src/lib/logout-revocation.ts";

const auth = readFileSync(new URL("../src/hooks/use-auth.tsx", import.meta.url), "utf8");

test("200 confirms server revocation and sends both tokens without logging them", async () => {
  let request;
  const result = await requestLogoutRevocation({
    url: "https://example.invalid/api/auth/logout",
    accessToken: "synthetic-access-A",
    refreshToken: "synthetic-refresh-A",
    fetcher: async (_url, options) => {
      request = options;
      return { ok: true, status: 200 };
    },
  });
  assert.deepEqual(result, { serverRevocationConfirmed: true, reason: "confirmed" });
  assert.equal(request.headers.Authorization, "Bearer synthetic-access-A");
  assert.equal(JSON.parse(request.body).refreshToken, "synthetic-refresh-A");
});

for (const status of [500, 503, 401]) {
  test(`HTTP ${status} never confirms remote revocation`, async () => {
    const result = await requestLogoutRevocation({
      url: "/api/auth/logout",
      accessToken: "synthetic-access-A",
      refreshToken: "synthetic-refresh-A",
      fetcher: async () => ({ ok: false, status }),
    });
    assert.deepEqual(result, { serverRevocationConfirmed: false, reason: "http-error" });
  });
}

test("offline/network failure does not confirm server revocation", async () => {
  const result = await requestLogoutRevocation({
    url: "/api/auth/logout",
    accessToken: "synthetic-access-A",
    refreshToken: "synthetic-refresh-A",
    fetcher: async () => { throw new Error("synthetic sensitive token fragment"); },
  });
  assert.deepEqual(result, { serverRevocationConfirmed: false, reason: "network" });
});

test("timeout aborts request and does not claim remote revocation", async () => {
  let aborted = false;
  const result = await requestLogoutRevocation({
    url: "/api/auth/logout",
    accessToken: "synthetic-access-A",
    refreshToken: null,
    timeoutMs: 10,
    fetcher: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("AbortError"));
      }, { once: true });
    }),
  });
  assert.equal(aborted, true);
  assert.deepEqual(result, { serverRevocationConfirmed: false, reason: "timeout" });
});

test("hard deadline returns when fetch ignores AbortSignal and never settles", async () => {
  let aborted = false;
  let watchdog;
  const watchdogPromise = new Promise((_resolve, reject) => {
    watchdog = setTimeout(() => reject(new Error("logout remained pending after abort")), 500);
  });
  try {
    const result = await Promise.race([
      requestLogoutRevocation({
        url: "/api/auth/logout",
        accessToken: "synthetic-access-A",
        refreshToken: "synthetic-refresh-A",
        timeoutMs: 10,
        fetcher: async (_url, options) => new Promise(() => {
          options.signal.addEventListener("abort", () => { aborted = true; }, { once: true });
          // Deliberately ignore abort: no resolve/reject, like a broken adapter.
        }),
      }),
      watchdogPromise,
    ]);
    assert.equal(aborted, true);
    assert.deepEqual(result, { serverRevocationConfirmed: false, reason: "timeout" });
  } finally {
    clearTimeout(watchdog);
  }
});

test("late 200 after abort is still unconfirmed", async () => {
  const result = await requestLogoutRevocation({
    url: "/api/auth/logout",
    accessToken: "synthetic-access-A",
    refreshToken: null,
    timeoutMs: 5,
    fetcher: async () => new Promise((resolve) => {
      setTimeout(() => resolve({ ok: true, status: 200 }), 20);
    }),
  });
  assert.deepEqual(result, { serverRevocationConfirmed: false, reason: "timeout" });
});

test("no tokens means no revocation claim and no network request", async () => {
  let called = false;
  const result = await requestLogoutRevocation({
    url: "/api/auth/logout",
    accessToken: null,
    refreshToken: null,
    fetcher: async () => { called = true; return { ok: true }; },
  });
  assert.equal(called, false);
  assert.deepEqual(result, { serverRevocationConfirmed: false, reason: "missing-token" });
});

test("local session wipe precedes remote revocation; warning survives redirect without tokens", () => {
  const logout = auth.slice(auth.indexOf("const logoutMutation = useMutation"));
  const positions = [
    logout.indexOf("clearSessionTokens();"),
    logout.indexOf("await queryClient.cancelQueries();"),
    logout.indexOf("queryClient.removeQueries();"),
    logout.indexOf("await clearAllEncryptedProfiles();"),
    logout.indexOf("await requestLogoutRevocation({"),
  ];
  assert.ok(positions.every((p) => p >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(logout, /localSessionCleared: true, serverRevocationConfirmed: revocation.serverRevocationConfirmed/);
  assert.match(logout, /if \(localSessionCleared && !serverRevocationConfirmed\)/);
  assert.match(logout, /sessionStorage.setItem\(LOGOUT_REVOCATION_WARNING_KEY, "1"\)/);
  assert.match(auth, /sessionStorage.removeItem\(LOGOUT_REVOCATION_WARNING_KEY\)/);
  assert.match(auth, /La revoca della sessione sul server non è confermata/);
  assert.doesNotMatch(auth, /sessionStorage.setItem\([^\n]*(?:tokenToRevoke|refreshTokenToRevoke)/);
});

test("best-effort native cleanup cannot hang logout when a bridge ignores abort", async () => {
  let aborted = false;
  let watchdog;
  const watchdogPromise = new Promise((_resolve, reject) => {
    watchdog = setTimeout(() => reject(new Error("native cleanup remained pending")), 500);
  });
  try {
    const result = await Promise.race([
      runBoundedLogoutSideEffect(async (signal) => new Promise(() => {
        signal.addEventListener("abort", () => { aborted = true; }, { once: true });
      }), 10),
      watchdogPromise,
    ]);
    assert.equal(result, false);
    assert.equal(aborted, true);
  } finally {
    clearTimeout(watchdog);
  }
});

test("best-effort cleanup reports failure without leaking exception details", async () => {
  assert.equal(await runBoundedLogoutSideEffect(async () => {
    throw new Error("synthetic-private-device-id");
  }), false);
  assert.equal(await runBoundedLogoutSideEffect(async () => undefined), true);
});

test("push and Credential Manager cannot block logout indefinitely", () => {
  const logout = auth.slice(auth.indexOf("const logoutMutation = useMutation"));
  assert.match(logout, /runBoundedLogoutSideEffect\(async \(signal\) => \{/);
  assert.match(logout, /signal,/);
  assert.match(logout, /runBoundedLogoutSideEffect\(async \(\) => \{\s*await unregisterNativePush\(\)/);
  assert.match(logout, /runBoundedLogoutSideEffect\(async \(\) => \{\s*await clearNativeGoogleCredentialState\(\)/);
  const nativePush = readFileSync(new URL("../src/lib/native-push.ts", import.meta.url), "utf8");
  assert.doesNotMatch(nativePush, /console\.warn\([^\n]*,\s*error\)/);
  assert.match(nativePush, /dettagli omessi/);
});
