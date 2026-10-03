const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  createResearchIssuerKeySetSnapshotPersistence
} = require('../services/researchIssuerKeySetSnapshotPersistence');

const makeSnapshot = (sequence, extra = {}) => JSON.stringify({
  payload: { sequence, ...extra },
  signature: 'fixture'
});

const makeHighWaterMarkStore = (initial = 0) => {
  let floor = initial;
  return {
    async readMinimumSequence() {
      return floor;
    },
    async advanceTo(sequence) {
      if (sequence < floor) throw new Error('rollback');
      floor = sequence;
    },
    current() {
      return floor;
    }
  };
};

const makeTempTarget = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'demos-keyset-persist-'));
  return { dir, snapshotPath: path.join(dir, 'issuer-keyset.json') };
};

test('authenticated issuer key-set snapshot persists atomically and recovers only after restart revalidation', async (t) => {
  const { dir, snapshotPath } = await makeTempTarget();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const highWater = makeHighWaterMarkStore();
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore: highWater
  });

  const snapshotJson = makeSnapshot(7, { issuedAt: 1, expiresAt: 2 });
  const persisted = await persistence.persistAuthenticatedSnapshot({
    snapshotJson,
    sequence: 7
  });
  assert.equal(persisted.sequence, 7);
  assert.equal(highWater.current(), 7);

  const stat = await fs.stat(snapshotPath);
  assert.equal(stat.mode & 0o077, 0);

  let revalidateCalls = 0;
  const recovered = await persistence.recoverAuthenticatedSnapshot({
    revalidate: async (candidate) => {
      revalidateCalls += 1;
      assert.equal(candidate, snapshotJson);
      return { ready: true, sequence: 7, expiresAt: 2 };
    }
  });
  assert.equal(revalidateCalls, 1);
  assert.equal(recovered.snapshotJson, snapshotJson);
  assert.equal(recovered.sequence, 7);
  assert.equal(recovered.expiresAt, 2);
});

test('rollback of the persisted file below the independent high-water mark fails closed before revalidation', async (t) => {
  const { dir, snapshotPath } = await makeTempTarget();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const highWater = makeHighWaterMarkStore();
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore: highWater
  });

  await persistence.persistAuthenticatedSnapshot({ snapshotJson: makeSnapshot(10), sequence: 10 });
  await persistence.persistAuthenticatedSnapshot({ snapshotJson: makeSnapshot(11), sequence: 11 });

  await fs.writeFile(snapshotPath, makeSnapshot(10), { mode: 0o600 });
  await fs.chmod(snapshotPath, 0o600);
  let revalidateCalls = 0;
  await assert.rejects(
    () => persistence.recoverAuthenticatedSnapshot({
      revalidate: async () => {
        revalidateCalls += 1;
        return { ready: true, sequence: 10 };
      }
    }),
    /high-water mark/i
  );
  assert.equal(revalidateCalls, 0);
});

test('failed high-water mark advance does not replace the previous snapshot', async (t) => {
  const { dir, snapshotPath } = await makeTempTarget();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const highWater = makeHighWaterMarkStore();
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore: highWater
  });

  const first = makeSnapshot(3);
  await persistence.persistAuthenticatedSnapshot({ snapshotJson: first, sequence: 3 });
  const failingHighWater = {
    async readMinimumSequence() {
      return 3;
    },
    async advanceTo() {
      throw new Error('durable monotonic store unavailable');
    }
  };
  const failingPersistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore: failingHighWater
  });

  await assert.rejects(
    () => failingPersistence.persistAuthenticatedSnapshot({
      snapshotJson: makeSnapshot(4),
      sequence: 4
    }),
    /monotonic store unavailable/i
  );
  assert.equal(await fs.readFile(snapshotPath, 'utf8'), first);
});

test('restart recovery rejects tampered or stale material when cryptographic/freshness revalidation fails', async (t) => {
  const { dir, snapshotPath } = await makeTempTarget();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const highWater = makeHighWaterMarkStore();
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore: highWater
  });

  await persistence.persistAuthenticatedSnapshot({ snapshotJson: makeSnapshot(21), sequence: 21 });
  await assert.rejects(
    () => persistence.recoverAuthenticatedSnapshot({
      revalidate: async () => ({ ready: false, reason: 'freshness-window', sequence: 21 })
    }),
    /restart revalidation/i
  );
});

test('persistence requires an absolute path and an independently supplied monotonic store', () => {
  assert.throws(
    () => createResearchIssuerKeySetSnapshotPersistence({
      snapshotPath: 'relative.json',
      highWaterMarkStore: makeHighWaterMarkStore()
    }),
    /absolute/i
  );
  assert.throws(
    () => createResearchIssuerKeySetSnapshotPersistence({
      snapshotPath: path.join(os.tmpdir(), 'x.json')
    }),
    /high-water mark/i
  );
});


test('snapshot persistence serializes concurrent writes fail-closed', async () => {
  let floor = 0;
  let releaseAdvance;
  const advanceBlocked = new Promise((resolve) => { releaseAdvance = resolve; });
  let firstAdvanceStarted;
  const firstAdvance = new Promise((resolve) => { firstAdvanceStarted = resolve; });
  const highWaterMarkStore = {
    async readMinimumSequence() { return floor; },
    async advanceTo(sequence) {
      firstAdvanceStarted();
      await advanceBlocked;
      floor = sequence;
    }
  };
  const snapshotPath = path.join(
    os.tmpdir(),
    `demos-keyset-concurrency-${process.pid}-${Date.now()}.json`
  );
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore,
    randomBytes: () => Buffer.alloc(12, 4)
  });
  const snapshot = (sequence) => JSON.stringify({ payload: { sequence } });

  const first = persistence.persistAuthenticatedSnapshot({
    snapshotJson: snapshot(1),
    sequence: 1
  });
  await firstAdvance;
  await assert.rejects(
    () => persistence.persistAuthenticatedSnapshot({
      snapshotJson: snapshot(2),
      sequence: 2
    }),
    /write already in progress/i
  );
  releaseAdvance();
  await first;

  const second = await persistence.persistAuthenticatedSnapshot({
    snapshotJson: snapshot(2),
    sequence: 2
  });
  assert.equal(second.sequence, 2);

  try { await fs.unlink(snapshotPath); } catch {}
});


test('recovery fails closed if the independent high-water mark changes mid-read', async (t) => {
  const { dir, snapshotPath } = await makeTempTarget();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(snapshotPath, makeSnapshot(40), { mode: 0o600 });
  await fs.chmod(snapshotPath, 0o600);
  let reads = 0;
  const highWaterMarkStore = {
    async readMinimumSequence() {
      reads += 1;
      return reads === 1 ? 40 : 41;
    },
    async advanceTo() {}
  };
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore
  });
  let revalidateCalls = 0;
  await assert.rejects(
    () => persistence.recoverAuthenticatedSnapshot({
      revalidate: async () => {
        revalidateCalls += 1;
        return { ready: true, sequence: 40 };
      }
    }),
    /changed during recovery/i
  );
  assert.equal(revalidateCalls, 0);
});

test('recovery fails closed if the high-water mark changes during revalidation', async (t) => {
  const { dir, snapshotPath } = await makeTempTarget();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(snapshotPath, makeSnapshot(50), { mode: 0o600 });
  await fs.chmod(snapshotPath, 0o600);
  let floor = 50;
  const highWaterMarkStore = {
    async readMinimumSequence() { return floor; },
    async advanceTo() {}
  };
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore
  });
  await assert.rejects(
    () => persistence.recoverAuthenticatedSnapshot({
      revalidate: async () => {
        floor = 51;
        return { ready: true, sequence: 50 };
      }
    }),
    /changed during recovery/i
  );
});


test('snapshot write fails closed if another writer advances the high-water mark past its sequence', async (t) => {
  const { dir, snapshotPath } = await makeTempTarget();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(snapshotPath, makeSnapshot(60), { mode: 0o600 });
  await fs.chmod(snapshotPath, 0o600);
  let floor = 60;
  const highWaterMarkStore = {
    async readMinimumSequence() { return floor; },
    async advanceTo(sequence) {
      floor = sequence + 1;
    }
  };
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore
  });

  await assert.rejects(
    () => persistence.persistAuthenticatedSnapshot({
      snapshotJson: makeSnapshot(61),
      sequence: 61
    }),
    /changed concurrently/i
  );
  assert.equal(await fs.readFile(snapshotPath, 'utf8'), makeSnapshot(60));
  assert.equal(floor, 62);
});


test('snapshot write reports fail-closed if the high-water mark changes immediately after publish', async (t) => {
  const { dir, snapshotPath } = await makeTempTarget();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let floor = 70;
  let reads = 0;
  const highWaterMarkStore = {
    async readMinimumSequence() {
      reads += 1;
      if (reads >= 3) return 72;
      return floor;
    },
    async advanceTo(sequence) {
      floor = sequence;
    }
  };
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath,
    highWaterMarkStore
  });

  await assert.rejects(
    () => persistence.persistAuthenticatedSnapshot({
      snapshotJson: makeSnapshot(71),
      sequence: 71
    }),
    /changed after snapshot publish/i
  );
  assert.equal(await fs.readFile(snapshotPath, 'utf8'), makeSnapshot(71));
});
