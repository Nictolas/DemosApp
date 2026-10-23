'use strict';

/** Separate privacy oversight from operational/technical administrator powers. */
function isDpoGrantAllowed(row) {
  return Boolean(
    row &&
    row.status === 'a' &&
    row.is_dpo === true &&
    row.is_admin !== true
  );
}

/**
 * Access to the aggregate-only privacy dashboard is shared by active Admins
 * and active DPOs. This does NOT grant Admins the DPO role or vice versa.
 */
function isPrivacyOverviewAccessAllowed(row) {
  return Boolean(
    row &&
    row.status === 'a' &&
    (row.is_admin === true || isDpoGrantAllowed(row))
  );
}

module.exports = { isDpoGrantAllowed, isPrivacyOverviewAccessAllowed };
