const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fsConstants = require('node:fs').constants;

const {
  createResearchIssuerKeySetSnapshotPersistence
} = require('../services/researchIssuerKeySetSnapshotPersistence');

const snapshot = (sequence) => JSON.stringify({ payload: { sequence }, signature: 'fixture' });

const createHighWater = (events, initial = 0) => {
  let floor = initial;
  return {
    async readMinimumSequence() {
      events.push('floor:read');
      return floor;
    },
    async advanceTo(sequence) {
      events.push('floor:advance');
      floor = sequence;
    }
  };
};

test('persistence orders durable temp write, monotonic advance, publish and directory fsync', async () => {
  const events = [];
  const target = path.resolve('virtual', 'issuer-keyset.json');
  const directory = path.dirname(target);
  const io = {
    async mkdir(actual, options) {
      assert.equal(actual, directory);
      assert.deepEqual(options, { recursive: true, mode: 0o700 });
      events.push('mkdir');
    },
    async open(actual, flags, mode) {
      if (actual === directory) {
        assert.equal(flags, 'r');
        events.push('dir:open');
        return {
          async sync() { events.push('dir:sync'); },
          async close() { events.push('dir:close'); }
        };
      }
      assert.match(actual, /\.tmp-/);
      assert.equal(flags, 'wx');
      assert.equal(mode, 0o600);
      events.push('temp:open');
      return {
        async writeFile(bytes) {
          assert.equal(bytes.toString('utf8'), snapshot(1));
          events.push('temp:write');
        },
        async sync() { events.push('temp:sync'); },
        async close() { events.push('temp:close'); }
      };
    },
    async rename(from, to) {
      assert.match(from, /\.tmp-/);
      assert.equal(to, target);
      events.push('rename');
    },
    async unlink() {
      events.push('unlink');
    }
  };

  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath: target,
    highWaterMarkStore: createHighWater(events),
    io,
    randomBytes: () => Buffer.alloc(12, 1)
  });

  await persistence.persistAuthenticatedSnapshot({ snapshotJson: snapshot(1), sequence: 1 });

  assert.deepEqual(events, [
    'floor:read',
    'mkdir',
    'temp:open',
    'temp:write',
    'temp:sync',
    'temp:close',
    'floor:advance',
    'floor:read',
    'rename',
    'dir:open',
    'dir:sync',
    'dir:close',
    'floor:read'
  ]);
});

test('failed monotonic advance cleans the unpublished temp file and never renames', async () => {
  const events = [];
  const target = path.resolve('virtual', 'issuer-keyset.json');
  const io = {
    async mkdir() { events.push('mkdir'); },
    async open(actual) {
      assert.match(actual, /\.tmp-/);
      events.push('temp:open');
      return {
        async writeFile() { events.push('temp:write'); },
        async sync() { events.push('temp:sync'); },
        async close() { events.push('temp:close'); }
      };
    },
    async rename() { events.push('rename'); },
    async unlink(actual) {
      assert.match(actual, /\.tmp-/);
      events.push('unlink');
    }
  };
  const highWater = {
    async readMinimumSequence() { return 0; },
    async advanceTo() {
      events.push('floor:advance');
      throw new Error('monotonic unavailable');
    }
  };
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath: target,
    highWaterMarkStore: highWater,
    io,
    randomBytes: () => Buffer.alloc(12, 2)
  });

  await assert.rejects(
    () => persistence.persistAuthenticatedSnapshot({ snapshotJson: snapshot(1), sequence: 1 }),
    /monotonic unavailable/
  );
  assert.equal(events.includes('rename'), false);
  assert.equal(events.at(-1), 'unlink');
});

test('recovery opens snapshot read-only with no-follow when supported before reading bytes', async () => {
  const target = path.resolve('virtual', 'issuer-keyset.json');
  const events = [];
  const io = {
    async open(actual, flags) {
      assert.equal(actual, target);
      assert.equal(flags & fsConstants.O_RDONLY, fsConstants.O_RDONLY);
      if (fsConstants.O_NOFOLLOW) {
        assert.equal(flags & fsConstants.O_NOFOLLOW, fsConstants.O_NOFOLLOW);
      }
      events.push('open');
      return {
        async stat() {
          events.push('stat');
          return { isFile: () => true, size: Buffer.byteLength(snapshot(4)), mode: 0o100600 };
        },
        async readFile() {
          events.push('read');
          return Buffer.from(snapshot(4));
        },
        async close() { events.push('close'); }
      };
    },
    async rename() { throw new Error('not used'); }
  };
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath: target,
    highWaterMarkStore: {
      async readMinimumSequence() { return 4; },
      async advanceTo() {}
    },
    io
  });

  const recovered = await persistence.recoverAuthenticatedSnapshot({
    revalidate: async () => ({ ready: true, sequence: 4 })
  });
  assert.equal(recovered.sequence, 4);
  assert.deepEqual(events, ['open', 'stat', 'read', 'close']);
});

test('temp fsync failure cleans unpublished material before touching the monotonic floor', async () => {
  const events = [];
  const target = path.resolve('virtual', 'issuer-keyset.json');
  const io = {
    async mkdir() { events.push('mkdir'); },
    async open(actual) {
      assert.match(actual, /\.tmp-/);
      return {
        async writeFile() { events.push('temp:write'); },
        async sync() {
          events.push('temp:sync');
          throw new Error('fsync unavailable');
        },
        async close() { events.push('temp:close'); }
      };
    },
    async rename() { events.push('rename'); },
    async unlink() { events.push('unlink'); }
  };
  const highWater = {
    async readMinimumSequence() {
      events.push('floor:read');
      return 0;
    },
    async advanceTo() { events.push('floor:advance'); }
  };
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath: target,
    highWaterMarkStore: highWater,
    io,
    randomBytes: () => Buffer.alloc(12, 3)
  });

  await assert.rejects(
    () => persistence.persistAuthenticatedSnapshot({ snapshotJson: snapshot(1), sequence: 1 }),
    /fsync unavailable/
  );
  assert.equal(events.includes('floor:advance'), false);
  assert.equal(events.includes('rename'), false);
  assert.equal(events.at(-1), 'unlink');
});

test('recovery rejects oversized metadata before reading snapshot bytes or revalidating', async () => {
  const target = path.resolve('virtual', 'issuer-keyset.json');
  let readCalls = 0;
  let revalidateCalls = 0;
  const io = {
    async open() {
      return {
        async stat() {
          return { isFile: () => true, size: (64 * 1024) + 1, mode: 0o100600 };
        },
        async readFile() {
          readCalls += 1;
          return Buffer.from(snapshot(5));
        },
        async close() {}
      };
    },
    async rename() { throw new Error('not used'); }
  };
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath: target,
    highWaterMarkStore: {
      async readMinimumSequence() { return 5; },
      async advanceTo() {}
    },
    io
  });

  await assert.rejects(
    () => persistence.recoverAuthenticatedSnapshot({
      revalidate: async () => {
        revalidateCalls += 1;
        return { ready: true, sequence: 5 };
      }
    }),
    /invalid persisted issuer key-set snapshot file/i
  );
  assert.equal(readCalls, 0);
  assert.equal(revalidateCalls, 0);
});

test('recovery rejects broad permission metadata before reading bytes or revalidating', async () => {
  const target = path.resolve('virtual', 'issuer-keyset.json');
  let readCalls = 0;
  let revalidateCalls = 0;
  const io = {
    async open() {
      return {
        async stat() {
          return { isFile: () => true, size: Buffer.byteLength(snapshot(6)), mode: 0o100640 };
        },
        async readFile() {
          readCalls += 1;
          return Buffer.from(snapshot(6));
        },
        async close() {}
      };
    },
    async rename() { throw new Error('not used'); }
  };
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath: target,
    highWaterMarkStore: {
      async readMinimumSequence() { return 6; },
      async advanceTo() {}
    },
    io
  });

  await assert.rejects(
    () => persistence.recoverAuthenticatedSnapshot({
      revalidate: async () => {
        revalidateCalls += 1;
        return { ready: true, sequence: 6 };
      }
    }),
    /permissions are too broad/i
  );
  assert.equal(readCalls, 0);
  assert.equal(revalidateCalls, 0);
});

test('invalid input size fails before filesystem or high-water side effects', async () => {
  let ioCalls = 0;
  let floorCalls = 0;
  const target = path.resolve('virtual', 'issuer-keyset.json');
  const persistence = createResearchIssuerKeySetSnapshotPersistence({
    snapshotPath: target,
    highWaterMarkStore: {
      async readMinimumSequence() {
        floorCalls += 1;
        return 0;
      },
      async advanceTo() {
        floorCalls += 1;
      }
    },
    io: {
      async open() {
        ioCalls += 1;
        throw new Error('must not open');
      },
      async rename() {
        ioCalls += 1;
      },
      async mkdir() {
        ioCalls += 1;
      }
    }
  });

  await assert.rejects(
    () => persistence.persistAuthenticatedSnapshot({
      snapshotJson: Buffer.alloc((64 * 1024) + 1),
      sequence: 1
    }),
    /invalid authenticated issuer key-set snapshot size/i
  );
  assert.equal(ioCalls, 0);
  assert.equal(floorCalls, 0);
});
