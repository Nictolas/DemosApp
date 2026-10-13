'use strict';

const { getPool } = require('../config/database');
const { syncItalianPoliticalTerritoriesFromProfiles } = require('../services/politicalTerritoryResolverService');

class PoliticalTerritoryResolverJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.lastRunAt = null;
    this.lastResult = null;
    this.lastError = null;
    this.intervalMs = Math.max(
      60 * 60 * 1000,
      Number.parseInt(process.env.POLITICAL_TERRITORY_RESOLVER_INTERVAL_MS || '21600000', 10) || 21600000,
    );
    this.batchSize = Math.max(
      1,
      Math.min(5000, Number.parseInt(process.env.POLITICAL_TERRITORY_RESOLVER_BATCH_SIZE || '500', 10) || 500),
    );
  }

  async execute() {
    if (this.isRunning) return this.lastResult;
    this.isRunning = true;
    this.lastRunAt = new Date();
    try {
      const result = await syncItalianPoliticalTerritoriesFromProfiles({ pool: getPool(), batchSize: this.batchSize });
      this.lastResult = result;
      this.lastError = null;
      if (!result.available) {
        console.log('ℹ️ Resolver territoriale politico: schema canonico non installato, nessuna modifica');
      } else {
        console.log(`✅ Resolver territoriale politico: ${result.resolved} risolti, ${result.unchanged} invariati, ${result.unresolved} non risolti, errori=${result.errors.length}`);
      }
      return result;
    } catch (error) {
      this.lastError = error?.message || String(error);
      console.error('❌ Resolver territoriale politico fallito:', this.lastError);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.interval) return;
    console.log(`🚀 Resolver territoriale politico attivo ogni ${this.intervalMs / 3600000}h`);
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
      batchSize: this.batchSize,
    };
  }
}

module.exports = new PoliticalTerritoryResolverJob();
