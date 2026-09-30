const FORBIDDEN_RESEARCH_IDENTITY_KEYS = new Set([
  'account_id',
  'user_id',
  'email',
  'nome',
  'cognome',
  'name',
  'fiscal_number',
  'google_sub',
  'apple_user_id',
  'firestore_uid',
  'webauthn_user_handle',
  'webauthn_credential_id',
  'session_id',
  'fcm_token',
  'fcm_tokens'
]);

const collectForbiddenResearchIdentityKeys = (value, path = '$', matches = []) => {
  if (!value || typeof value !== 'object') return matches;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectForbiddenResearchIdentityKeys(item, `${path}[${index}]`, matches);
    });
    return matches;
  }

  Object.entries(value).forEach(([key, child]) => {
    const normalizedKey = String(key).trim().toLowerCase();
    const childPath = `${path}.${key}`;

    if (FORBIDDEN_RESEARCH_IDENTITY_KEYS.has(normalizedKey)) {
      matches.push(childPath);
    }

    collectForbiddenResearchIdentityKeys(child, childPath, matches);
  });

  return matches;
};

const assertResearchPayloadSeparated = (payload) => {
  const forbiddenPaths = collectForbiddenResearchIdentityKeys(payload);

  if (forbiddenPaths.length > 0) {
    const error = new Error('Research payload contains direct identity fields');
    error.code = 'RESEARCH_IDENTITY_LINK_FORBIDDEN';
    error.forbiddenPaths = forbiddenPaths;
    throw error;
  }

  return true;
};

module.exports = {
  FORBIDDEN_RESEARCH_IDENTITY_KEYS,
  collectForbiddenResearchIdentityKeys,
  assertResearchPayloadSeparated
};
