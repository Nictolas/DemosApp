'use strict';

/**
 * PROTOTYPE ONLY — deterministic export/import of the versioned opinion catalog.
 *
 * JSON is a possible representation of a future durable, append-only registry.
 * This module performs NO file I/O, SQL, DDL, network calls or migrations.
 * It must not be wired to DEMOS routes until the storage/rollback plan is approved.
 * SHA-256 fingerprints detect accidental slot mismatches; they do NOT authenticate
 * manifests or defend against an attacker who can rewrite both IDs and hashes.
 */
const {createCatalogRegistry} = require('./opinionCodecEnvelope');

const MANIFEST_SCHEMA_VERSION = 1;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_CATALOG_VERSIONS = 2048;

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every(key =>
    Object.prototype.hasOwnProperty.call(value, key));
}

function serializeCatalogRegistry(registry) {
  if (!registry || !Array.isArray(registry.versions) ||
      registry.versions.length === 0 ||
      registry.versions.length > MAX_CATALOG_VERSIONS ||
      typeof registry.get !== 'function') {
    throw new TypeError('Expected a versioned opinion catalog registry');
  }
  const catalogs = registry.versions.map(version => {
    const entry = registry.get(version);
    return {
      version:entry.version,
      ids:[...entry.ids],
      fingerprint:entry.fingerprint
    };
  });
  // Validate the snapshot again rather than trusting a caller-provided registry.
  const checked = createCatalogRegistry(catalogs);
  for (const item of catalogs) {
    if (item.fingerprint !== checked.get(item.version).fingerprint) {
      throw new RangeError('Manifest fingerprint does not match ordered IDs');
    }
  }
  const json = JSON.stringify({schemaVersion:MANIFEST_SCHEMA_VERSION,catalogs});
  if (Buffer.byteLength(json, 'utf8') > MAX_MANIFEST_BYTES) {
    throw new RangeError('Opinion catalog manifest exceeds allowed size');
  }
  return json;
}

function restoreCatalogRegistry(serialized) {
  if (!Buffer.isBuffer(serialized) && typeof serialized !== 'string') {
    throw new TypeError('Expected a serialized opinion catalog manifest');
  }
  const byteLength = Buffer.isBuffer(serialized)
    ? serialized.length : Buffer.byteLength(serialized, 'utf8');
  if (byteLength === 0 || byteLength > MAX_MANIFEST_BYTES) {
    throw new RangeError('Invalid opinion catalog manifest size');
  }
  let manifest;
  try {
    manifest = JSON.parse(Buffer.isBuffer(serialized)
      ? serialized.toString('utf8') : serialized);
  } catch {
    throw new TypeError('Opinion catalog manifest is not valid JSON');
  }
  if (!hasExactKeys(manifest, ['schemaVersion','catalogs']) ||
      manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
      !Array.isArray(manifest.catalogs) ||
      manifest.catalogs.length < 1 ||
      manifest.catalogs.length > MAX_CATALOG_VERSIONS) {
    throw new RangeError('Invalid or unsupported opinion catalog manifest');
  }
  const catalogs = manifest.catalogs.map(entry => {
    if (!hasExactKeys(entry, ['version','ids','fingerprint']) ||
        !Array.isArray(entry.ids) ||
        typeof entry.fingerprint !== 'string' ||
        !/^[a-f0-9]{64}$/.test(entry.fingerprint)) {
      throw new TypeError('Invalid opinion catalog manifest entry');
    }
    return {version:entry.version,ids:[...entry.ids],fingerprint:entry.fingerprint};
  });
  const registry = createCatalogRegistry(catalogs);
  for (const entry of catalogs) {
    if (registry.get(entry.version).fingerprint !== entry.fingerprint) {
      throw new RangeError('Manifest fingerprint mismatch: possible slot corruption');
    }
  }
  return registry;
}

function appendCatalogManifest(serialized, nextIds) {
  const previous = restoreCatalogRegistry(serialized);
  const last = previous.get(previous.latestVersion);
  if (!Array.isArray(nextIds) || nextIds.length <= last.ids.length) {
    throw new RangeError('A new manifest version must append at least one opinion');
  }
  const nextVersion = previous.latestVersion + 1;
  if (!Number.isSafeInteger(nextVersion)) {
    throw new RangeError('No safe opinion catalog version remains');
  }
  const versions = previous.versions.map(version => {
    const entry = previous.get(version);
    return {version,ids:entry.ids};
  });
  versions.push({version:nextVersion,ids:nextIds});
  return serializeCatalogRegistry(createCatalogRegistry(versions));
}

module.exports = {
  MANIFEST_SCHEMA_VERSION, MAX_MANIFEST_BYTES,
  serializeCatalogRegistry, restoreCatalogRegistry, appendCatalogManifest
};
