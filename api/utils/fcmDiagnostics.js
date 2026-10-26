'use strict';

// Log only strict, bounded diagnostic codes. Firebase messages, stacks and
// arbitrary strings can contain FCM registration secrets and user data.
function safeFcmErrorCode(error) {
  const code = error?.code;
  if (typeof code !== 'string') return 'FCM_UNCLASSIFIED';
  if (/^messaging\/[a-z][a-z0-9-]{0,63}$/.test(code)) return code;
  if (/^[A-Z0-9]{5}$/.test(code)) return code; // PostgreSQL SQLSTATE
  return 'FCM_UNCLASSIFIED';
}
module.exports = { safeFcmErrorCode };
