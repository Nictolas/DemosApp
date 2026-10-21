'use strict';

// Retain explicit audit/security events independently from verbosity settings.
// Without this, LOG_LEVEL=ERROR can silently suppress audit records (which are INFO).
const LEVELS = Object.freeze({
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
});

function normalizeLevel(level, fallback = 'INFO') {
  const value = String(level || '').trim().toUpperCase();
  return Object.hasOwn(LEVELS, value) ? value : fallback;
}

function shouldWriteLogEvent(level, configuredLevel = 'INFO', metadata = {}) {
  const eventLevel = String(level || '').trim().toUpperCase();
  if (!Object.hasOwn(LEVELS, eventLevel)) return false;

  if (metadata?.auditEvent === true || metadata?.securityEvent === true) return true;

  return LEVELS[eventLevel] <= LEVELS[normalizeLevel(configuredLevel)];
}

module.exports = { normalizeLevel, shouldWriteLogEvent };
