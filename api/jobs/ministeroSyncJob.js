const ministeroSync = require('../services/ministeroSync');
const logger = require('../services/centralizedLogger');

/**
 * Job periodico per sincronizzare iniziative/referendum dal Ministero
 * Esegue ogni 6 ore (21600000 ms) o secondo configurazione
 */
class MinisteroSyncJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.intervalMs = parseInt(process.env.MINISTERO_SYNC_INTERVAL_MS || '21600000'); // Default 6 ore
  }

  async execute() {
    if (this.isRunning) {
      console.log('⏸️ Sincronizzazione Ministero già in corso, skip...');
      return;
    }

    this.isRunning = true;
    console.log(`🔄 Esecuzione sincronizzazione Ministero (${new Date().toISOString()})...`);

    try {
      await ministeroSync.syncAll();
    } catch (error) {
      console.error('❌ Errore nell\'esecuzione sincronizzazione Ministero:', error);
      await logger.error('Errore job sincronizzazione Ministero', { error: error.message });
    } finally {
      this.isRunning = false;
      console.log(`✅ Sincronizzazione Ministero completata (${new Date().toISOString()})`);
    }
  }

  start() {
    if (this.interval) {
      console.log('⚠️ Job sincronizzazione Ministero già avviato');
      return;
    }

    console.log(`🚀 Avvio job sincronizzazione Ministero (intervallo: ${this.intervalMs / 1000 / 60} minuti)`);
    
    // Esegui immediatamente al primo avvio
    this.execute();

    // Poi esegui periodicamente
    this.interval = setInterval(() => {
      this.execute();
    }, this.intervalMs);

    // Esegui anche ogni giorno alle 3:00 AM
    this.scheduleDaily();
  }

  scheduleDaily() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(3, 0, 0, 0); // 3:00 AM

    const msUntil3AM = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.execute();
      // Dopo la prima esecuzione, programma ogni 24 ore
      setInterval(() => {
        this.execute();
      }, 24 * 60 * 60 * 1000);
    }, msUntil3AM);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('🛑 Job sincronizzazione Ministero fermato');
    }
  }
}

module.exports = new MinisteroSyncJob();

