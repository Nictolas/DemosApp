'use strict';

function parseHostname(connectionString) {
  if (!connectionString) return null;
  return new URL(connectionString).hostname.toLowerCase();
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function isSupabaseHostname(hostname) {
  return Boolean(hostname) && (
    hostname.endsWith('.supabase.co') ||
    hostname.endsWith('.pooler.supabase.com')
  );
}

function isRenderInternalHostname(hostname) {
  return Boolean(hostname) && /^dpg-[a-z0-9-]+$/i.test(hostname);
}

function buildDatabaseSsl(connectionString, { supabaseCa } = {}) {
  const hostname = parseHostname(connectionString);
  if (!hostname || isLocalHostname(hostname)) return false;

  if (isSupabaseHostname(hostname)) {
    if (!supabaseCa) throw new Error('Supabase CA is required for verified TLS');
    return { rejectUnauthorized: true, ca: supabaseCa };
  }

  // Render private-network PostgreSQL uses self-signed TLS certificates.
  // Encryption is still required; certificate-chain verification is unavailable
  // for the internal hostname by design (equivalent to sslmode=require).
  if (isRenderInternalHostname(hostname)) {
    return { rejectUnauthorized: false };
  }

  // External Render and other public PostgreSQL endpoints use the system trust store.
  return { rejectUnauthorized: true };
}

module.exports = {
  parseHostname,
  isLocalHostname,
  isSupabaseHostname,
  isRenderInternalHostname,
  buildDatabaseSsl,
};
