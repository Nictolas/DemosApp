'use strict';

/**
 * EXPERIMENTAL STORAGE ADAPTER, NOT WIRED TO ROUTES OR DATABASE.
 *
 * Persist catalogue versions + ordered IDs separately in a controlled,
 * append-only registry. Each BYTEA needs catalogVersion, hash and format tag;
 * version and fingerprint are NOT cryptographic authenticity.
 *
 * Public endpoints must keep accepting POST {opinioni:{id:'f'|'c'|'i'}}
 * and returning userAnswer:'f'|'c'|'i'|null. Do not send bytea,
 * version numbers or metadata to legacy Android clients.
 *
 * Only pure in-memory operations. The caller is responsible for SQL
 * CAS/locking, consent enforcement, account authorization and GDPR.
 */
const {catalogFingerprint,isAppendOnlyCatalog} = require('./opinionBitset');
const fixed = require('./opinionBitset');
const trimmed = require('./opinionTrimmedBitset');
const sparse = require('./opinionSparseBitset');

const FORMAT = Object.freeze({
  fixed: Object.freeze({encode:fixed.encodeAnswers,decode:fixed.decodeAnswers}),
  trimmed: Object.freeze({encode:trimmed.encodeTrimmed,decode:trimmed.decodeTrimmed}),
  sparse: Object.freeze({encode:sparse.encodeSparse,decode:sparse.decodeSparse})
});

function createCatalogRegistry(versionSpecs) {
  if (!Array.isArray(versionSpecs) || !versionSpecs.length) {
    throw new TypeError('At least one catalog version is required');
  }
  const byVersion = new Map();
  let previous = null;
  let lastVersion = 0;
  for (const input of versionSpecs) {
    if (!input || !Number.isSafeInteger(input.version) ||
        input.version <= lastVersion || !Array.isArray(input.ids)) {
      throw new TypeError('Catalog versions must be strictly increasing positive integers');
    }
    const ids = Object.freeze([...input.ids]);
    const fingerprint = catalogFingerprint(ids);
    if (previous && !isAppendOnlyCatalog(previous.ids, ids)) {
      throw new RangeError('Catalog versions cannot remove or reorder opinion IDs');
    }
    const catalog = Object.freeze({version:input.version,ids,fingerprint});
    byVersion.set(catalog.version,catalog);
    previous = catalog;
    lastVersion = catalog.version;
  }
  const versions = Object.freeze([...byVersion.keys()]);
  return Object.freeze({
    latestVersion:lastVersion,
    versions,
    get(version) {
      if (!Number.isSafeInteger(version)) throw new TypeError('Invalid catalog version');
      const c = byVersion.get(version);
      if (!c) throw new RangeError('Unknown catalog version');
      return c;
    }
  });
}

function encodingFor(format) {
  if (typeof format !== 'string' ||
      !Object.prototype.hasOwnProperty.call(FORMAT,format)) {
    throw new RangeError('Unsupported opinion storage encoding');
  }
  return FORMAT[format];
}

function assertEnvelope(registry, envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new TypeError('Invalid binary opinion envelope');
  }
  if (envelope.schemaVersion !== 1) {
    throw new RangeError('Unsupported binary envelope schema version');
  }
  const catalog=registry.get(envelope.catalogVersion);
  if (envelope.catalogFingerprint !== catalog.fingerprint) {
    throw new RangeError('Catalog fingerprint mismatch: possible slot corruption');
  }
  const codec=encodingFor(envelope.encoding);
  if (!Buffer.isBuffer(envelope.payload)) {
    throw new TypeError('Binary payload must be a Buffer');
  }
  return {catalog,codec};
}

function encodeEnvelope(registry, {version, encoding, answers}) {
  const catalog = registry.get(version);
  const codec = encodingFor(encoding);
  return Object.freeze({
    schemaVersion:1,
    catalogVersion:catalog.version,
    catalogFingerprint:catalog.fingerprint,
    encoding,
    payload:codec.encode(catalog.ids,answers)
  });
}

function decodeEnvelope(registry, envelope, asVersion=registry.latestVersion) {
  const {catalog,codec} = assertEnvelope(registry,envelope);
  const target=registry.get(asVersion);
  if (!isAppendOnlyCatalog(catalog.ids,target.ids)) {
    throw new RangeError('Cannot decode into an older or reordered catalog');
  }
  const decoded=codec.decode(catalog.ids,envelope.payload);
  // Pad newly added opinions as NULL; never silently map to indeciso.
  for (const id of target.ids) if (!Object.hasOwn(decoded,id)) decoded[id]=null;
  return decoded;
}

function upgradeEnvelope(registry,envelope,encoding=envelope.encoding) {
  // Explicit upgrade: older versions retain their own length until this is called.
  const answers=decodeEnvelope(registry,envelope,registry.latestVersion);
  return encodeEnvelope(registry,{
    version:registry.latestVersion, encoding, answers
  });
}

function decodeLegacyQuestionRows(registry,envelope,questionIds) {
  if (!Array.isArray(questionIds)) throw new TypeError('Expected ordered question IDs');
  const decoded=decodeEnvelope(registry,envelope);
  const ids=new Set(registry.get(registry.latestVersion).ids);
  return questionIds.map(id=>{
    if (!ids.has(id)) throw new RangeError('Unknown question ID');
    return {id,userAnswer:decoded[id]};
  });
}

function parseLegacyOpinionPost(body, registry, version=registry.latestVersion) {
  // This reproduces the shape accepted by /api/opinioni/salva; it does NOT
  // replace the existing route's authentication, consent or SQL validation.
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('Expected JSON request object');
  }
  const answers=Object.hasOwn(body,'opinioni')?body.opinioni:body;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) ||
      Buffer.isBuffer(answers) || Object.keys(answers).length===0) {
    throw new TypeError('Expected nonempty opinion map');
  }
  const allowed=new Set(registry.get(version).ids);
  const parsed={};
  for (const [id,value] of Object.entries(answers)) {
    if (!allowed.has(id)) throw new RangeError('Unknown question ID');
    // The deployed backend accepts normalized textual aliases as input.
    // Preserve its current behavior with the same normalization function.
    const {normalizeOpinionAnswer}=require('./politicalMatching');
    const normalized=normalizeOpinionAnswer(value);
    if (!normalized) throw new RangeError('Opinions must be f, c or i');
    parsed[id]=normalized;
  }
  return parsed;
}

module.exports={
  createCatalogRegistry,encodeEnvelope,decodeEnvelope,upgradeEnvelope,
  decodeLegacyQuestionRows,parseLegacyOpinionPost
};
