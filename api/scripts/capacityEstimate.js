'use strict';

/**
 * DEMOS capacity planning model.
 *
 * This is intentionally a demand/sensitivity model, not a load-test substitute.
 * Inputs that are not direct measurements are explicit assumptions so they can be
 * replaced after real production sampling.
 */

const BYTES_PER_GB = 1_000_000_000;
const DAYS_PER_MONTH = 30;

const MEASURED = Object.freeze({
  frontendBuildBytes: 2_797_508,
  frontendFirstLoadTransferBytes: 681_169,
  backendMemoryLimitBytes: 536_870_900,
  backendObservedMemoryBytesLow: 85_184_510,
  backendObservedMemoryBytesHigh: 97_468_420,
  backendInstances: 1,
});

const CURRENT_ACCOUNT_OBSERVED = Object.freeze({
  // Observed in the Render billing UI on 2026-10-11. Workspace quota, not an
  // intrinsic performance limit of the backend service.
  renderIncludedBandwidthGB: 5,
  renderFreeInstanceHoursPerMonth: 750,
});

const REFERENCE_ONLY = Object.freeze({
  // Public-plan sensitivity values. They are NOT asserted to be the current
  // account-specific DEMOS database/frontend limits and must be re-verified
  // before a purchasing or go-live decision.
  referenceFrontendTransferGB: 100,
  referenceDatabaseStorageGB: 1,
});

const ASSUMPTIONS = Object.freeze({
  // Logical database footprint including user-linked rows and indexes.
  // This is a planning assumption, not a measurement of production rows.
  dbBytesPerRegisteredUser: 50_000,
  // Backend/API transfer per daily active user per active day.
  apiBytesPerDauDay: 3_000_000,
  // One full uncached frontend shell load per DAU per day is deliberately
  // conservative for static assets because browsers/CDNs cache repeat loads.
  fullFrontendLoadsPerDauDay: 1,
  // Capacity budgets should preserve operating headroom rather than plan to 100%.
  storageUtilizationBudget: 0.70,
  transferUtilizationBudget: 0.70,
});

const DEMAND_SCENARIOS = Object.freeze([
  { id: 'closed-beta', registeredUsers: 100, dau: 20 },
  { id: 'pilot', registeredUsers: 1_000, dau: 200 },
  { id: 'regional-beta', registeredUsers: 10_000, dau: 2_000 },
  { id: 'national-scale', registeredUsers: 100_000, dau: 20_000 },
]);

function bytesToGB(bytes) {
  return bytes / BYTES_PER_GB;
}

function estimateScenario(scenario, assumptions = ASSUMPTIONS) {
  const dbBytes = scenario.registeredUsers * assumptions.dbBytesPerRegisteredUser;
  const apiTransferBytesMonth = scenario.dau * assumptions.apiBytesPerDauDay * DAYS_PER_MONTH;
  const frontendTransferBytesMonth = (
    scenario.dau *
    assumptions.fullFrontendLoadsPerDauDay *
    MEASURED.frontendFirstLoadTransferBytes *
    DAYS_PER_MONTH
  );

  return {
    ...scenario,
    dbStorageGB: bytesToGB(dbBytes),
    apiTransferGBMonth: bytesToGB(apiTransferBytesMonth),
    frontendTransferGBMonth: bytesToGB(frontendTransferBytesMonth),
    totalModeledTransferGBMonth: bytesToGB(apiTransferBytesMonth + frontendTransferBytesMonth),
  };
}

function storageUserBound(storageGB, bytesPerUser, utilizationBudget = ASSUMPTIONS.storageUtilizationBudget) {
  if (!(storageGB > 0) || !(bytesPerUser > 0) || !(utilizationBudget > 0 && utilizationBudget <= 1)) {
    throw new Error('Invalid storage capacity inputs');
  }
  return Math.floor(storageGB * BYTES_PER_GB * utilizationBudget / bytesPerUser);
}

function frontendLoadBound(transferGB, loadBytes = MEASURED.frontendFirstLoadTransferBytes, utilizationBudget = ASSUMPTIONS.transferUtilizationBudget) {
  if (!(transferGB > 0) || !(loadBytes > 0) || !(utilizationBudget > 0 && utilizationBudget <= 1)) {
    throw new Error('Invalid transfer capacity inputs');
  }
  return Math.floor(transferGB * BYTES_PER_GB * utilizationBudget / loadBytes);
}

function dauBoundFromApiTransfer(transferGB, bytesPerDauDay = ASSUMPTIONS.apiBytesPerDauDay, days = DAYS_PER_MONTH, utilizationBudget = ASSUMPTIONS.transferUtilizationBudget) {
  if (!(transferGB > 0) || !(bytesPerDauDay > 0) || !(days > 0) || !(utilizationBudget > 0 && utilizationBudget <= 1)) {
    throw new Error('Invalid API transfer capacity inputs');
  }
  return Math.floor(transferGB * BYTES_PER_GB * utilizationBudget / (bytesPerDauDay * days));
}

function storageSensitivity(storageGB = REFERENCE_ONLY.referenceDatabaseStorageGB) {
  return [20_000, 50_000, 200_000].map((bytesPerUser) => ({
    bytesPerUser,
    usersAt70PercentBudget: storageUserBound(storageGB, bytesPerUser),
  }));
}

function buildReport() {
  const scenarios = DEMAND_SCENARIOS.map((scenario) => estimateScenario(scenario));
  return {
    measured: MEASURED,
    currentAccountObserved: CURRENT_ACCOUNT_OBSERVED,
    referenceOnly: REFERENCE_ONLY,
    assumptions: ASSUMPTIONS,
    scenarios,
    sensitivities: {
      referenceDatabaseStorage: storageSensitivity(),
      referenceFrontendFullLoadsAt70Percent: frontendLoadBound(REFERENCE_ONLY.referenceFrontendTransferGB),
      renderWorkspaceApiDauAt70Percent: dauBoundFromApiTransfer(CURRENT_ACCOUNT_OBSERVED.renderIncludedBandwidthGB),
    },
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildReport(), null, 2)}\n`);
}

module.exports = {
  BYTES_PER_GB,
  DAYS_PER_MONTH,
  MEASURED,
  CURRENT_ACCOUNT_OBSERVED,
  REFERENCE_ONLY,
  ASSUMPTIONS,
  DEMAND_SCENARIOS,
  bytesToGB,
  estimateScenario,
  storageUserBound,
  frontendLoadBound,
  dauBoundFromApiTransfer,
  storageSensitivity,
  buildReport,
};
