'use strict';

const { getPool } = require('../config/database');
const { syncItalianPopularInitiativesSources } = require('../services/italianPopularInitiativesParliamentSyncService');
const { syncItalianOfficialReferendumSources } = require('../services/italianReferendumOfficialSyncService');
const { syncOfficialGazetteReferendumLifecycle } = require('../services/referendumGazetteLifecycleService');
const { syncOfficialGazetteReferendumReindictions } = require('../services/referendumGazetteReindictionService');
const { syncItalianReferendumResults } = require('../services/italianReferendumResultSyncService');
const { syncReferendumBallotsFromCanonicalSources } = require('../services/referendumBallotSyncService');
const referendumForecastSnapshotJob = require('./referendumForecastSnapshotJob');

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
      const pool = getPool();
      const result = await syncItalianPopularInitiativesSources({ pool });

      // 1) Gazzetta Ufficiale: scopre convocazione, quesito e date.
      const officialReferendumSources = await syncItalianOfficialReferendumSources({ pool });
      result.sources = {
        ...(result.sources || {}),
        ...(officialReferendumSources || {}),
      };

      // 2) Gazzetta Ufficiale: intercetta atti successivi all'indizione
      // (precisazione/riformulazione del quesito e revoca).
      // Il matching e' fail-closed: se il precedente non e' univoco non aggiorna nulla.
      const referendumLifecycle = await syncOfficialGazetteReferendumLifecycle({ pool });
      result.sources = {
        ...(result.sources || {}),
        gazzettaLifecycle: referendumLifecycle,
      };

      // 3) Se dopo una revoca lo stesso referendum viene indetto di nuovo, il nuovo
      // decreto viene ricondotto alla consultazione originaria soltanto quando la
      // Gazzetta contiene una catena esplicita revoca -> precedente indizione.
      // Questo passaggio avviene prima della proiezione in civic_ballots, così non
      // vengono create due schede per la stessa consultazione rinviata.
      const referendumReindictions = await syncOfficialGazetteReferendumReindictions({ pool });
      result.sources = {
        ...(result.sources || {}),
        gazzettaReindiction: referendumReindictions,
      };

      // 4) Eligendo: solo dopo la chiusura dei seggi tenta di acquisire il
      // risultato nazionale definitivo Italia + Estero. Se il mapping del
      // quesito non e' univoco resta fail-closed e non associa dati a caso.
      const referendumResults = await syncItalianReferendumResults({ pool });
      result.sources = {
        ...(result.sources || {}),
        ...(referendumResults || {}),
      };

      // 5) Proiezione finale: la fonte Eligendo, quando presente e completa,
      // ha precedenza sulla Gazzetta per i campi di risultato ufficiale.
      const referendumBallots = await syncReferendumBallotsFromCanonicalSources({ pool });
      result.referendumBallots = referendumBallots;
      this.lastResult = result;

      const sourceEntries = Object.entries(result.sources || {});
      const errorCount = sourceEntries.reduce((sum, [, stats]) => sum + (stats.errors?.length || 0), 0)
        + (referendumBallots.errors?.length || 0);
      const fetchedCount = sourceEntries.reduce((sum, [, stats]) => sum + Number(stats.fetched || 0), 0);
      const ingestedCount = sourceEntries.reduce((sum, [, stats]) => sum + Number(stats.ingested || 0), 0);
      const summary = sourceEntries
        .map(([source, stats]) => {
          const extras = [];
          if (stats.scannedIssues != null) extras.push(`fascicoli=${stats.scannedIssues}`);
          if (stats.datesQueried != null) extras.push(`date=${stats.datesQueried}`);
          if (stats.pending) extras.push(`pending=${stats.pending}`);
          if (stats.ambiguous) extras.push(`ambigui=${stats.ambiguous}`);
          if (stats.unsafe) extras.push(`unsafe=${stats.unsafe}`);
          const suffix = extras.length ? `, ${extras.join(', ')}` : '';
          return `${source}: ${stats.ingested}/${stats.fetched}, errori=${stats.errors?.length || 0}${suffix}`;
        })
        .concat([
          `referendum-ballots: ${referendumBallots.ingested}/${referendumBallots.fetched}, errori=${referendumBallots.errors?.length || 0}${referendumBallots.schemaReady ? '' : ', schema=pending'}`,
        ])
        .join(' | ');

      if (fetchedCount > 0 && ingestedCount === 0 && errorCount > 0) {
        throw new Error(`CIVIC_SOURCE_SYNC_ALL_ROWS_FAILED: ${summary}`);
      }

      this.lastError = errorCount > 0 ? `PARTIAL_SOURCE_ERRORS: ${summary}` : null;
      if (errorCount > 0) {
        console.warn(`⚠️ Sync processi civici completato parzialmente - ${summary}`);
      } else {
        console.log(`✅ Sync processi civici completato - ${summary}`);
      }
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
    referendumForecastSnapshotJob.start();
    setImmediate(() => this.execute().catch(() => {}));
    this.interval = setInterval(() => this.execute().catch(() => {}), this.intervalMs);
    if (typeof this.interval.unref === 'function') this.interval.unref();
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    referendumForecastSnapshotJob.stop();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult,
      lastError: this.lastError,
      intervalMs: this.intervalMs,
      referendumForecastSnapshots: referendumForecastSnapshotJob.getStatus(),
    };
  }
}

module.exports = new CivicProcessSyncJob();
