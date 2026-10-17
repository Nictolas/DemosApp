'use strict';

const { getPool } = require('../config/database');
const { captureReferendumForecastSnapshots } = require('../services/referendumForecastSnapshotService');

class ReferendumForecastSnapshotJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.lastRunAt = null;
    this.lastResult = null;
    this.lastError = null;
    this.intervalMs = Math.max(
      5 * 60 * 1000,
      Number.parseInt(process.env.REFERENDUM_FORECAST_SNAPSHOT_INTERVAL_MS || '900000', 10) || 900000,
    );
  }

  async execute() {
    if (this.isRunning) return this.lastResult;
    this.isRunning = true;
    this.lastRunAt = new Date();
    try {
      const result = await captureReferendumForecastSnapshots({ pool: getPool(), now: this.lastRunAt });
      this.lastResult = result;
      this.lastError = result.errors?.length ? `${result.errors.length} snapshot errors` : null;
      if (result.errors?.length) {
        console.warn(`⚠️ Snapshot referendum parziali: ${result.captured}/${result.fetched}, errori=${result.errors.length}`);
      } else {
        console.log(`✅ Snapshot referendum: ${result.captured}/${result.fetched}, soppressi=${result.suppressed}, bucket=${result.bucketStart}`);
      }
      return result;
    } catch (error) {
      if (error?.code === '42P01' && /civic_ballot_forecast_snapshots/i.test(String(error.message || ''))) {
        this.lastResult = {
          schemaReady: false,
          fetched: 0,
          captured: 0,
          suppressed: 0,
          errors: [],
          reason: 'REFERENDUM_FORECAST_SNAPSHOT_MIGRATION_REQUIRED',
        };
        this.lastError = null;
        return this.lastResult;
      }
      this.lastError = error?.message || String(error);
      console.error('❌ Snapshot referendum fallito:', this.lastError);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.interval) return;
    console.log(`🚀 Job snapshot referendum attivo ogni ${this.intervalMs / 60000} min`);
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

module.exports = new ReferendumForecastSnapshotJob();
