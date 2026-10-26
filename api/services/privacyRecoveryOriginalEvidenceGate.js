'use strict';

// Offline byte-level artifact check, layered AFTER the signed-evidence gate.
// All buffers must be supplied by a separately trusted operator workflow.
// This module never fetches a provider document or authorizes any restoration.
const crypto = require('node:crypto');
const { REQUIRED_CONTROLS } = require('./privacyRecoveryQuarantineEvidenceGate');
const { assessSignedQuarantineEvidence } = require('./privacyRecoverySignedEvidenceGate');
const PER_ARTIFACT_LIMIT_BYTES = 4 * 1024 * 1024;
const TOTAL_LIMIT_BYTES = 16 * 1024 * 1024;
const EXPECTED_CONTROLS = Object.freeze(Object.keys(REQUIRED_CONTROLS));

function noGo(signed, blockers, verifiedOriginalArtifacts = 0) {
  return {
    decision: 'NO_GO', blockers, checked: signed.checked, required: signed.required,
    verifiedSignatures: signed.verifiedSignatures,
    verifiedOriginalArtifacts
  };
}

function assessOriginalRecoveryArtifacts(payload, independentTrustRoots, originals, options = {}) {
  const signed = assessSignedQuarantineEvidence(payload, independentTrustRoots, options);
  if (signed.decision !== 'MANUAL_INDEPENDENT_REVIEW_REQUIRED') {
    return noGo(signed, signed.blockers);
  }
  // Prohibit string or base64 inputs, implicit conversions and missing bytes.
  // Operators MUST present the exact downloaded source bytes, without
  // normalization or a digest provided solely by the original claimant.
  if (!originals || typeof originals !== 'object' || Array.isArray(originals) ||
      Buffer.isBuffer(originals)) {
    return noGo(signed, ['MISSING_ORIGINAL_ARTIFACTS']);
  }
  const names = Object.keys(originals);
  if (names.some(name => !Object.prototype.hasOwnProperty.call(REQUIRED_CONTROLS, name))) {
    return noGo(signed, ['UNKNOWN_ORIGINAL_ARTIFACT']);
  }
  const blockers = [];
  let verifiedOriginalArtifacts = 0;
  let totalBytes = 0;
  const seenDigests = new Set();
  for (const name of EXPECTED_CONTROLS) {
    // Reject getter-based properties; read data descriptors only.
    const descriptor = Object.getOwnPropertyDescriptor(originals, name);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
        !Buffer.isBuffer(descriptor.value) || descriptor.value.length === 0) {
      blockers.push('MISSING_OR_INVALID_ORIGINAL:' + name);
      continue;
    }
    const bytes = descriptor.value;
    if (bytes.length > PER_ARTIFACT_LIMIT_BYTES) {
      blockers.push('ORIGINAL_TOO_LARGE:' + name);
      continue;
    }
    totalBytes += bytes.length;
    if (totalBytes > TOTAL_LIMIT_BYTES) {
      blockers.push('ORIGINAL_BATCH_TOO_LARGE');
      break;
    }
    const digest = crypto.createHash('sha256').update(bytes).digest();
    const expected = Buffer.from(payload.controls[name].evidenceSha256, 'hex');
    if (expected.length !== digest.length || !crypto.timingSafeEqual(digest, expected)) {
      blockers.push('ORIGINAL_DIGEST_MISMATCH:' + name);
      continue;
    }
    const hex = digest.toString('hex');
    if (seenDigests.has(hex)) {
      blockers.push('REUSED_ORIGINAL_ARTIFACT:' + name);
      continue;
    }
    seenDigests.add(hex);
    verifiedOriginalArtifacts++;
  }
  if (blockers.length) return noGo(signed, blockers, verifiedOriginalArtifacts);
  // A matching SHA256 and signature attest bytes/integrity, not that they came
  // from a real provider or prove the service was isolated. No automatic GO.
  return {
    decision: 'MANUAL_INDEPENDENT_REVIEW_REQUIRED', blockers: [],
    checked: signed.checked, required: signed.required,
    verifiedSignatures: signed.verifiedSignatures,
    verifiedOriginalArtifacts
  };
}

module.exports = {
  assessOriginalRecoveryArtifacts,
  PER_ARTIFACT_LIMIT_BYTES,
  TOTAL_LIMIT_BYTES
};
