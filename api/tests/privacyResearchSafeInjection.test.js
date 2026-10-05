const test = require('node:test');
const assert = require('node:assert/strict');

const {
  readCallableProperty,
  invokeDetachedCallable
} = require('../services/researchSafeInjection');

test('safe injection reads only own callable data properties', () => {
  const own = () => {};
  const candidate = {};
  Object.defineProperty(candidate, 'record', { value: own });
  assert.equal(readCallableProperty(candidate, 'record'), own);
  assert.equal(readCallableProperty(Object.create({ record: own }), 'record'), null);
  assert.equal(readCallableProperty({ record: 1 }, 'record'), null);
  assert.equal(readCallableProperty(null, 'record'), null);
});

test('safe injection never invokes accessor properties while reading', () => {
  let reads = 0;
  const candidate = Object.defineProperty({}, 'record', {
    get() {
      reads += 1;
      return () => {};
    }
  });
  assert.equal(readCallableProperty(candidate, 'record'), null);
  assert.equal(reads, 0);
});

test('safe injection contains descriptor traps from hostile proxies', () => {
  const candidate = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error('descriptor trap');
    }
  });
  assert.equal(readCallableProperty(candidate, 'record'), null);
});

test('detached invocation forwards exactly one argument without receiver state', () => {
  const argument = Object.freeze({ kind: 'request' });
  let seenArgument;
  let seenThis;
  function callable(value) {
    'use strict';
    seenArgument = value;
    seenThis = this;
  }
  assert.equal(invokeDetachedCallable(callable, argument), true);
  assert.equal(seenArgument, argument);
  assert.equal(seenThis, undefined);
});

test('detached invocation rejects non-callables without side effects', () => {
  for (const value of [null, undefined, false, 0, 'fn', {}, []]) {
    assert.equal(invokeDetachedCallable(value, { kind: 'request' }), false);
  }
});

test('detached invocation contains synchronous and exotic apply failures', () => {
  assert.equal(invokeDetachedCallable(() => { throw new Error('failure'); }, null), false);
  const exotic = new Proxy(() => {}, {
    apply() {
      throw new Error('apply trap');
    }
  });
  assert.equal(invokeDetachedCallable(exotic, null), false);
});
