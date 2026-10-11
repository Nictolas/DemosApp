'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {

  MEASURED,
  ASSUMPTIONS,
  DEMAND_SCENARIOS,
  estimateScenario,
  storageUserBound,
  frontendLoadBound,
  dauBoundFromApiTransfer,
  storageSensitivity,
  buildReport,
} = require('../scripts/capacityEstimate');

test('measured frontend transfer baseline remains the qualified build measurement', () => {
  assert.equal(MEASURED.frontendBuildBytes, 2_797_508);
  assert.equal(MEASURED.frontendFirstLoadTransferBytes, 681_169);
});

test('demand scenarios are estimates rather than a claimed supported-user maximum', () => {
  assert.deepEqual(
    DEMAND_SCENARIOS.map(({ registeredUsers, dau }) => [registeredUsers, dau]),
    [[100, 20], [1_000, 200], [10_000, 2_000], [100_000, 20_000]],
  );
  assert.equal(ASSUMPTIONS.dbBytesPerRegisteredUser, 50_000);
  assert.equal(ASSUMPTIONS.apiBytesPerDauDay, 3_000_000);
});

test('pilot demand estimate uses explicit storage and transfer assumptions', () => {
  const pilot = estimateScenario({ id: 'pilot', registeredUsers: 1_000, dau: 200 });
  assert.equal(pilot.dbStorageGB, 0.05);
  assert.equal(pilot.apiTransferGBMonth, 18);
  assert.ok(Math.abs(pilot.frontendTransferGBMonth - 4.087014) < 1e-9);
  assert.ok(Math.abs(pilot.totalModeledTransferGBMonth - 22.087014) < 1e-9);
});

test('one gigabyte storage reference reserves 30 percent headroom', () => {
  assert.equal(storageUserBound(1, 20_000), 35_000);
  assert.equal(storageUserBound(1, 50_000), 14_000);
  assert.equal(storageUserBound(1, 200_000), 3_500);
  assert.deepEqual(storageSensitivity(1).map((row) => row.usersAt70PercentBudget), [35_000, 14_000, 3_500]);
});

test('frontend transfer sensitivity uses measured gzip-equivalent shell size and headroom', () => {
  assert.equal(frontendLoadBound(100), 102_764);
});

test('current observed five-gigabyte Render workspace transfer is not enough for the pilot API assumption at 70 percent budget', () => {
  assert.equal(dauBoundFromApiTransfer(5), 38);
});

test('invalid capacity inputs fail closed instead of returning misleading values', () => {
  assert.throws(() => storageUserBound(0, 50_000), /Invalid storage capacity inputs/);
  assert.throws(() => frontendLoadBound(100, 0), /Invalid transfer capacity inputs/);
  assert.throws(() => dauBoundFromApiTransfer(5, 0), /Invalid API transfer capacity inputs/);
});

test('report keeps measured, observed-account, reference-only and assumption sections separate', () => {
  const report = buildReport();
  assert.ok(report.measured);
  assert.ok(report.currentAccountObserved);
  assert.ok(report.referenceOnly);
  assert.ok(report.assumptions);
  assert.equal(report.scenarios.length, 4);
  assert.equal(report.sensitivities.referenceDatabaseStorage.length, 3);
});

test('capacity plan documents multiple demand scenarios and refuses an unmeasured concurrency claim', () => {
  const plan = fs.readFileSync(path.resolve(__dirname, '..', '..', 'docs', 'CAPACITY_PLAN.md'), 'utf8');
  for (const scenario of ['Closed beta', 'Pilot', 'Beta regionale', 'Scala nazionale']) {
    assert.match(plan, new RegExp(scenario));
  }
  assert.match(plan, /non viene dichiarato un numero di utenti simultanei supportati/i);
  assert.match(plan, /F12-07/);
  assert.match(plan, /misura.*quota osservata.*riferimento esterno.*assunzione/is);
});
