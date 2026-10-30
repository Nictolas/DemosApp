import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";

const requireFromClient = createRequire(new URL("../package.json", import.meta.url));
const ts = requireFromClient("typescript");
const source = readFileSync(
  new URL("../src/pages/Profilo/utils/encryptedProfileVault.ts", import.meta.url), "utf8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function gate() {
  let release;
  return { promise: new Promise(resolve => { release = resolve; }), release: () => release() };
}
function createVault() {
  const records = new Map();
  let pendingOwnerPut = null;
  let holdOwnerPut = null;
  let enteredOwnerPut = null;

  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore() {},
    transaction(_name, _mode) {
      const tx = {
        oncomplete: null, onerror: null, onabort: null,
        objectStore() {
          return {
            get(id) {
              const req = { onsuccess: null, onerror: null, result: undefined };
              queueMicrotask(() => {
                req.result = records.get(id);
                req.onsuccess?.();
              });
              return req;
            },
            put(value, id) {
              const commit = () => queueMicrotask(() => {
                records.set(id, value);
                tx.oncomplete?.();
              });
              if (id.startsWith("owner:") && holdOwnerPut) {
                pendingOwnerPut = commit;
                const triggered = enteredOwnerPut;
                holdOwnerPut = null;
                enteredOwnerPut = null;
                triggered?.();
              } else commit();
            },
            delete(id) {
              queueMicrotask(() => {
                records.delete(id);
                tx.oncomplete?.();
              });
            },
            clear() {
              queueMicrotask(() => {
                records.clear();
                tx.oncomplete?.();
              });
            },
          };
        },
      };
      return tx;
    },
  };
  const indexedDB = {
    open() {
      const req = { result: db, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
  };
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, exports: module.exports, window: {}, indexedDB,
    crypto: webcrypto, TextDecoder, TextEncoder, Uint8Array, Map, Set,
    console,
  }, { filename: "encryptedProfileVault.ts" });

  return {
    vault: module.exports, records,
    interceptOwnerWrite() {
      assert.equal(holdOwnerPut, null);
      const entered = gate();
      enteredOwnerPut = entered.release;
      holdOwnerPut = true;
      return {
        entered: entered.promise,
        release() {
          assert.equal(typeof pendingOwnerPut, "function");
          const commit = pendingOwnerPut;
          pendingOwnerPut = null;
          commit();
        },
      };
    },
  };
}
const profile = {
  version: 1,
  consent: { granted: true, timestamp: "epoch-1" },
  full: null, government: null, representatives: null,
  candidates: null, opinions: null, preferences: null,
  opinionE: null, opinionN: null, opinionR: null, opinionCO: null,
};
test("per-account revocation waits for an already-started IndexedDB write", async () => {
  const { vault, records, interceptOwnerWrite } = createVault();
  const blocked = interceptOwnerWrite();
  const storing = vault.storeEncryptedProfile("citizen-a", profile);
  await blocked.entered;
  let purged = false;
  const revoke = vault.clearEncryptedProfile("citizen-a").then(() => { purged = true; });
  await Promise.resolve();
  assert.equal(purged, false, "must not report erasure while old write can still commit");
  blocked.release();
  await Promise.all([storing, revoke]);
  assert.equal(records.has("owner:citizen-a"), false);
  assert.equal(await vault.loadEncryptedProfile("citizen-a"), null);
});

test("logout waits for queued writes and cannot resurrect former owner's data", async () => {
  const { vault, records, interceptOwnerWrite } = createVault();
  const blocked = interceptOwnerWrite();
  const storing = vault.patchEncryptedProfile("citizen-b", { ...profile });
  await blocked.entered;
  let loggedOut = false;
  const logout = vault.clearAllEncryptedProfiles().then(() => { loggedOut = true; });
  await Promise.resolve();
  assert.equal(loggedOut, false, "logout purge must wait for old write transaction");
  blocked.release();
  await Promise.all([storing, logout]);
  assert.equal(records.size, 0);
  assert.equal(await vault.loadEncryptedProfile("citizen-b"), null);
});
