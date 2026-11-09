'use strict';

/**
 * Offline-only quota model. Not a distributed limiter or billing guarantee.
 * Google counts STANDARD PREPARATIONS (and classic token requests) separately
 * from server-side decryptions. On-demand standard token requests must not
 * automatically be treated as additional preparations.
 */
function estimatePlayIntegrityQuota({
  dailyActiveUsers,
  androidFraction = 0.7,
  protectedActionsPerAndroidDau = 0.15,
  actionsPerPreparedUser = 1,
  preparationQuota = 10_000,
  decryptionQuota = 10_000
} = {}) {
  if (!Number.isSafeInteger(dailyActiveUsers) || dailyActiveUsers < 0) {
    throw new RangeError('dailyActiveUsers must be a nonnegative safe integer');
  }
  const measures = [androidFraction, protectedActionsPerAndroidDau, actionsPerPreparedUser, preparationQuota, decryptionQuota];
  if (measures.some(x => typeof x !== 'number' || !Number.isFinite(x))) {
    throw new RangeError('All quota parameters must be finite');
  }
  if (androidFraction < 0 || androidFraction > 1 || protectedActionsPerAndroidDau < 0
      || actionsPerPreparedUser < 1 || !Number.isSafeInteger(preparationQuota) || preparationQuota < 1
      || !Number.isSafeInteger(decryptionQuota) || decryptionQuota < 1) {
    throw new RangeError('Invalid quota scenario');
  }
  const androidActive = Math.round(dailyActiveUsers * androidFraction);
  const actions = Math.round(androidActive * protectedActionsPerAndroidDau);
  if (!Number.isSafeInteger(actions)) throw new RangeError('Scenario too large');
  const preparations = Math.min(androidActive, Math.ceil(actions / actionsPerPreparedUser));
  const decryptions = actions; // one server decode for each protected action

  return Object.freeze({
    androidActive, protectedActions: actions,
    preparations, decryptions,
    preparationUtilization: preparations / preparationQuota,
    decryptionUtilization: decryptions / decryptionQuota,
    exceedsEitherQuota: preparations > preparationQuota || decryptions > decryptionQuota
  });
}

module.exports = { estimatePlayIntegrityQuota };
