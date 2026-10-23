'use strict';

// This is a deployment boundary, not a user-controlled routing preference.
// Keep project references in code so a typo cannot point a worker at another
// Supabase project with matching schema and database role.
const SUPABASE_PROJECTS = Object.freeze({
  staging: 'fkeayjzvtuvzesljhjbc',
  production: 'wxnblcqoyjqxktwkcqok'
});

function parseDatabaseLocation(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch (_error) {
    throw new Error('AUDIT_OUTBOX_PROJECT_SCOPE_REJECTED');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname || !url.username || !url.password) {
    throw new Error('AUDIT_OUTBOX_PROJECT_SCOPE_REJECTED');
  }
  const host = url.hostname.toLowerCase();
  // The primary DEMOS app can legitimately use Supavisor in transaction
  // mode (6543), but the durable outbox needs direct/session mode (5432).
  // Validate the project identity in either case, separately enforce the
  // stronger connection restriction on the outbox URL.
  if (host !== '127.0.0.1' &&
      (url.pathname !== '/postgres' || !['5432', '6543'].includes(url.port))) {
    throw new Error('AUDIT_OUTBOX_PROJECT_SCOPE_REJECTED');
  }

  const direct = /^db[.]([a-z0-9]{20})[.]supabase[.]co$/.exec(host);
  if (direct) {
    return {
      project: direct[1],
      kind: url.port === '6543' ? 'transaction-pooler' : 'direct',
      role: url.username
    };
  }
  if (/^aws-[0-9]+-[a-z0-9-]+[.]pooler[.]supabase[.]com$/.test(host)) {
    const username = url.username;
    const split = username.lastIndexOf('.');
    if (split < 1) throw new Error('AUDIT_OUTBOX_PROJECT_SCOPE_REJECTED');
    return {
      project: username.slice(split + 1),
      kind: url.port === '6543' ? 'transaction-pooler' : 'session-pooler',
      role: username.slice(0, split)
    };
  }
  if (host === '127.0.0.1' && url.port === '5432' &&
      url.pathname === '/demos_outbox_ci') {
    return { project: 'ci-only', kind: 'local-ci', role: url.username };
  }
  throw new Error('AUDIT_OUTBOX_PROJECT_SCOPE_REJECTED');
}

function assertOutboxProjectScope({
  mainUrl,
  outboxUrl,
  deploymentScope,
  nodeEnv
}) {
  const primary = parseDatabaseLocation(mainUrl);
  const dedicated = parseDatabaseLocation(outboxUrl);
  if (primary.project !== dedicated.project ||
      primary.kind === 'local-ci' !== (dedicated.kind === 'local-ci')) {
    throw new Error('AUDIT_OUTBOX_PROJECT_SCOPE_REJECTED');
  }
  if (dedicated.kind === 'local-ci') {
    if (deploymentScope !== 'ci-only' || nodeEnv !== 'test') {
      throw new Error('AUDIT_OUTBOX_PROJECT_SCOPE_REJECTED');
    }
    return 'ci-only';
  }
  if (!Object.hasOwn(SUPABASE_PROJECTS, deploymentScope) ||
      primary.project !== SUPABASE_PROJECTS[deploymentScope] ||
      !/^demos_outbox_[a-z0-9_]{1,40}$/.test(dedicated.role) ||
      !['direct', 'session-pooler'].includes(dedicated.kind)) {
    throw new Error('AUDIT_OUTBOX_PROJECT_SCOPE_REJECTED');
  }
  return deploymentScope;
}

module.exports = {
  SUPABASE_PROJECTS, parseDatabaseLocation, assertOutboxProjectScope
};
