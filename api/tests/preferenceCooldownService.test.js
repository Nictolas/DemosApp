const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COOLDOWN_HOURS,
  getPreferenceCooldown,
  assertPreferenceChangeAllowed,
  recordPreferenceChange,
} = require('../services/preferenceCooldownService');

class FakeDb {
  constructor() {
    this.records = new Map();
    this.queryCount = 0;
    this.missingTable = false;
  }

  key(userId, scope) {
    return `${String(userId)}|${String(scope)}`;
  }

  async query(sql, params) {
    this.queryCount += 1;
    if (this.missingTable) {
      const error = new Error('relation does not exist');
      error.code = '42P01';
      throw error;
    }

    if (/SELECT last_changed_at/i.test(sql)) {
      const value = this.records.get(this.key(params[0], params[1]));
      return { rows: value ? [{ last_changed_at: value }] : [] };
    }

    if (/INSERT INTO preference_change_cooldowns/i.test(sql)) {
      this.records.set(this.key(params[0], params[1]), new Date(params[2]));
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected query: ${sql}`);
  }
}

test('canonical preference cooldown is exactly 24 hours', () => {
  assert.equal(COOLDOWN_HOURS, 24);
});

test('first choice is immediately allowed when no prior state exists', async () => {
  const db = new FakeDb();
  const state = await getPreferenceCooldown(db, {
    userId: 'u1',
    scope: 'test:preference',
    now: new Date('2026-10-09T10:00:00Z'),
  });
  assert.equal(state.isBlocked, false);
  assert.equal(state.unlockDate, null);
});

test('fallback current-state timestamp enforces the cooldown before migration row exists', async () => {
  const db = new FakeDb();
  const state = await getPreferenceCooldown(db, {
    userId: 'u1',
    scope: 'test:preference',
    fallbackChangedAt: '2026-10-09T09:00:00Z',
    now: new Date('2026-10-09T10:00:00Z'),
  });
  assert.equal(state.isBlocked, true);
  assert.equal(state.unlockDate, '2026-10-10T09:00:00.000Z');
});

test('recorded change blocks until 24 hours and becomes editable at the boundary', async () => {
  const db = new FakeDb();
  await recordPreferenceChange(db, {
    userId: 'u1',
    scope: 'test:preference',
    changedAt: '2026-10-09T10:00:00Z',
  });

  const before = await getPreferenceCooldown(db, {
    userId: 'u1',
    scope: 'test:preference',
    now: new Date('2026-10-10T09:59:59Z'),
  });
  assert.equal(before.isBlocked, true);

  const boundary = await getPreferenceCooldown(db, {
    userId: 'u1',
    scope: 'test:preference',
    now: new Date('2026-10-10T10:00:00Z'),
  });
  assert.equal(boundary.isBlocked, false);
  assert.equal(boundary.unlockDate, null);
});

test('assertion returns a stable conflict code and unlock date', async () => {
  const db = new FakeDb();
  await recordPreferenceChange(db, {
    userId: 'u1',
    scope: 'test:preference',
    changedAt: new Date(),
  });

  await assert.rejects(
    assertPreferenceChangeAllowed(db, { userId: 'u1', scope: 'test:preference' }),
    (error) => {
      assert.equal(error.code, 'PREFERENCE_COOLDOWN');
      assert.equal(error.status, 409);
      assert.ok(error.unlockDate);
      return true;
    },
  );
});

test('Admin bypass does not require a cooldown-table read', async () => {
  const db = new FakeDb();
  db.missingTable = true;
  const result = await assertPreferenceChangeAllowed(db, {
    userId: 'admin',
    scope: 'test:preference',
    isAdmin: true,
  });
  assert.equal(result.isBlocked, false);
  assert.equal(db.queryCount, 0);
});

test('missing cooldown migration fails closed for normal users', async () => {
  const db = new FakeDb();
  db.missingTable = true;
  await assert.rejects(
    assertPreferenceChangeAllowed(db, { userId: 'u1', scope: 'test:preference' }),
    (error) => {
      assert.equal(error.code, 'PREFERENCE_COOLDOWN_SCHEMA_MISSING');
      assert.equal(error.status, 503);
      return true;
    },
  );
});
