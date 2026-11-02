'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { probeCivicStagingDirectDns } =
  require('../staging/civic_render_direct_dns_probe');

const safe = Object.freeze({
  CIVIC_STAGING_DNS_CHECK: 'true',
  CIVIC_STAGING_PROJECT_REF: 'fkeayjzvtuvzesljhjbc',
});

test('does not perform a network lookup unless explicitly enabled', async () => {
  let lookups = 0;
  const fake = () => { lookups++; return Promise.resolve([]); };
  const actual = await probeCivicStagingDirectDns({
    env: {}, resolve4: fake, resolve6: fake,
  });
  assert.equal(actual, 'NOT_TESTED');
  assert.equal(lookups, 0);
});

test('rejects unconfigured or malformed staging project refs without DNS', async () => {
  let lookups = 0;
  for (const project of [undefined, '', '../other', 'abcd', 'FKEAYJZVTUVZESLJHJBC']) {
    const outcome = await probeCivicStagingDirectDns({
      env: {...safe, CIVIC_STAGING_PROJECT_REF: project},
      resolve4: async () => { lookups++; return []; },
      resolve6: async () => { lookups++; return []; },
    });
    assert.equal(outcome, 'INVALID_STAGING_PROJECT');
  }
  assert.equal(lookups, 0);
});

test('reports IPv6-only direct Supabase endpoint without disclosing addresses', async () => {
  const used = [];
  const outcome = await probeCivicStagingDirectDns({
    env: safe,
    resolve4: async (hostname) => {
      used.push(hostname);
      throw Object.assign(new Error('no ipv4'), {code: 'ENODATA'});
    },
    resolve6: async (hostname) => {
      used.push(hostname);
      return ['2001:db8:3::1'];
    },
  });
  assert.equal(outcome, 'DIRECT_IPV6_ONLY');
  assert.deepEqual(used, [
    'db.fkeayjzvtuvzesljhjbc.supabase.co',
    'db.fkeayjzvtuvzesljhjbc.supabase.co',
  ]);
  assert.equal(outcome.includes('fkeayjzvtuvzesljhjbc'), false);
});

test('reports dual-stack, IPv4-only and unavailable DNS accurately', async () => {
  const configs = [
    [['192.0.2.10'], ['2001:db8::1'], 'DIRECT_DUAL_STACK'],
    [['192.0.2.10'], [], 'DIRECT_IPV4_AVAILABLE'],
    [[], [], 'DIRECT_DNS_UNAVAILABLE'],
  ];
  for (const [a, aaaa, expected] of configs) {
    const outcome = await probeCivicStagingDirectDns({
      env: safe, resolve4: async () => a, resolve6: async () => aaaa,
    });
    assert.equal(outcome, expected);
  }
});
