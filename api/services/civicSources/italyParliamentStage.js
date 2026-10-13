'use strict';

const { CIVIC_PROCESS_STAGES } = require('../../config/civicProcesses');

const TERMINAL_PATTERNS = [
  /approvat[oa] definitivamente/i,
  /^approvat[oa]$/i,
  /divenut[oa] legge/i,
  /^respint[oa]$/i,
  /^ritirat[oa]$/i,
  /^decadut[oa]$/i,
  /^assorbit[oa]$/i,
  /^conclus[oa] definitivamente$/i,
];

function mapItalianParliamentaryStage(sourceStatus) {
  const status = String(sourceStatus || '').trim();
  if (status && TERMINAL_PATTERNS.some(pattern => pattern.test(status))) {
    return CIVIC_PROCESS_STAGES.CLOSED;
  }
  return CIVIC_PROCESS_STAGES.PARLIAMENTARY_REVIEW;
}

module.exports = { mapItalianParliamentaryStage };
