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

module.exports = { isDpoGrantAllowed };
