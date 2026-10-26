const { isPrivacyRecoveryMaintenanceActive } = require('../middleware/privacyRecoveryMaintenance');
﻿'use strict';

const { getPool } = require('../config/database');
const {
  ingestItalianElectionUnitSnapshot,
  getElectionUnitImportStatus,
} = require('../services/italianElectionUnitIngestionService');

class ItalianElectionUnitSyncJob {
  constructor() {
    this.isRunning = false;
    this.lastRunAt = null;
    this.lastResult = null;
    this.lastError = null;
  }

  async execute() {
    if (isPrivacyRecoveryMaintenanceActive()) return;
    if (this.isRunning) return this.lastResult;
    const eventId = String(process.env.ITALIAN_ELECTION_UNIT_SYNC_EVENT_ID || '').trim();
    const sourceId = String(process.env.ITALIAN_ELECTION_UNIT_SYNC_SOURCE_ID || 'POLITICHE_20220925').trim();
    if (!eventId) {
      const error = new Error('ITALIAN_ELECTION_UNIT_SYNC_EVENT_ID required');
      error.code = 'ELECTION_UNIT_SYNC_EVENT_REQUIRED';
      throw error;
    }
    this.isRunning = true;
    this.lastRunAt = new Date();
    try {
      const pool = getPool();
      const result = await ingestItalianElectionUnitSnapshot({
        db: pool,
        eventId,
        sourceId,
        verifySources: process.env.ITALIAN_ELECTION_UNIT_SYNC_VERIFY_SOURCE !== 'false',
      });
      const status = result.available
        ? await getElectionUnitImportStatus(pool, { eventId, sourceId })
        : null;
      this.lastResult = { ...result, status };
      this.lastError = null;
      console.log(`✅ Import unità elettorali ${sourceId}: ${result.units || 0} unità, ${result.mappings || 0} mapping`);
      return this.lastResult;
    } catch (error) {
      this.lastError = error?.code || error?.message || String(error);
      console.error('❌ Import unità elettorali fallito:', this.lastError);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (isPrivacyRecoveryMaintenanceActive()) return;
    setImmediate(() => this.execute().catch(() => {}));
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult,
      lastError: this.lastError,
    };
  }
}

module.exports = new ItalianElectionUnitSyncJob();
