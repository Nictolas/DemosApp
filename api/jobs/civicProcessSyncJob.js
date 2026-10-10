'use strict';

const { getPool } = require('../config/database');
const { syncItalianPopularInitiativesSources } = require('../services/italianPopularInitiativesParliamentSyncService');

class CivicProcessSyncJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.lastRunAt = null;
    this.lastResult = null;
    this.lastError = null;
    this.intervalMs = Math.max(
      60 * 60 * 1000,
      Number.parseInt(process.env.CIVIC_PROCESS_SYNC_INTERVAL_MS || '21600000', 10) || 21600000
    );
  }

  async execute() {
    if (this.isRunning) return this.lastResult;
    this.isRunning = true;
    this.lastRunAt = new Date();
    try {
      const result = await syncItalianPopularInitiativesSources({ pool: getPool() });
      this.lastResult = result;
      this.lastError = null;
      const summary = Object.entries(result.sources || {})
        .map(([source, stats]) => `${source}: ${stats.ingested}/${stats.fetched}, errori=${stats.errors?.length || 0}`)
        .join(' | ');
      console.log(`✅ Sync processi civici completato - ${summary}`);
      return result;
    } catch (error) {
      this.lastError = error?.message || String(error);
      console.error('❌ Sync processi civici fallito:', this.lastError);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.interval) return;
    console.log(`🚀 Job processi civici attivo ogni ${this.intervalMs / 3600000}h`);
    setImmediate(() => this.execute().catch(() => {}));
    this.interval = setInterval(() => this.execute().catch(() => {}), this.intervalMs);
    if (typeof this.interval.unref === 'function') this.interval.unref();
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult,
      lastError: this.lastError,
      intervalMs: this.intervalMs,
    };
  }
}

module.exports = new CivicProcessSyncJob();
