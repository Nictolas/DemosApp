const ministeroSync = require('../services/ministeroSync');
const logger = require('../services/centralizedLogger');
const { collectMinisteroNewInitiatives } = require('../services/civicNewInitiativeEventCollector');

/**
 * Job periodico per sincronizzare iniziative/referendum dal Ministero
 * Esegue ogni 1 ora per dati freschi (configurabile)
 * Sincronizzazione differenziata: più frequente per referendum "in corso"
 */
class MinisteroSyncJob {
  constructor() {
    this.interval = null;
    this.intervalInCorso = null;
    this.dailyInterval = null;
    this.isRunning = false;
    this.isRunningInCorso = false;
    this.lastSyncTime = null;
    this.lastSyncStatus = null;
    this.lastSyncError = null;

    this.intervalMs = parseInt(process.env.MINISTERO_SYNC_INTERVAL_MS || '3600000');
    this.intervalInCorsoMs = parseInt(process.env.MINISTERO_SYNC_IN_CORSO_INTERVAL_MS || '1800000');
    this.maxRetries = parseInt(process.env.MINISTERO_SYNC_MAX_RETRIES || '3');
    this.retryDelayMs = parseInt(process.env.MINISTERO_SYNC_RETRY_DELAY_MS || '60000');
  }

  /**
   * Esegue la sincronizzazione con retry automatico.
   * Un fetch riuscito non basta: se il salvataggio produce errori e non processa
   * alcun record, il tentativo deve fallire invece di essere marcato come successo.
   */
  async executeWithRetry() {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await ministeroSync.syncAll();
        const processed = Number(result?.created || 0) + Number(result?.updated || 0);
        const errors = Number(result?.errors || 0);

        if (errors > 0 && processed === 0) {
          const error = new Error(`MINISTERO_SYNC_ALL_ROWS_FAILED: processed=${processed}, errors=${errors}`);
          error.code = 'MINISTERO_SYNC_ALL_ROWS_FAILED';
          throw error;
        }

        this.lastSyncStatus = errors > 0 ? 'partial' : 'success';
        this.lastSyncError = errors > 0 ? `processed=${processed}, errors=${errors}` : null;
        return result;
      } catch (error) {
        lastError = error;
        console.error(`❌ Tentativo ${attempt}/${this.maxRetries} fallito:`, error.message);

        if (attempt < this.maxRetries) {
          console.log(`⏳ Riprovo tra ${this.retryDelayMs / 1000} secondi...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
        }
      }
    }

    this.lastSyncStatus = 'error';
    this.lastSyncError = lastError?.message || 'Errore sconosciuto';
    throw lastError;
  }

  async execute() {
    if (this.isRunning) {
      console.log('⏸️ Sincronizzazione Ministero già in corso, skip...');
      return;
    }

    this.isRunning = true;
    this.lastSyncTime = new Date();
    console.log(`🔄 Esecuzione sincronizzazione Ministero (${this.lastSyncTime.toISOString()})...`);

    try {
      const result = await this.executeWithRetry();
      const errors = Number(result?.errors || 0);
      if (errors === 0) {
        // Outbox solo dopo una sincronizzazione completa, senza invii push.
        const events = await collectMinisteroNewInitiatives(require('../config/database').getPool());
        if (events.recorded > 0) {
          console.log('[civic-new] nuove raccolte ufficiali registrate:', events.recorded);
        }
      }
      if (errors > 0) {
        console.warn(`⚠️ Sincronizzazione Ministero completata parzialmente: ${errors} errori (${new Date().toISOString()})`);
      } else {
        console.log(`✅ Sincronizzazione Ministero completata con successo (${new Date().toISOString()})`);
      }
    } catch (error) {
      console.error('❌ Errore nell\'esecuzione sincronizzazione Ministero dopo tutti i tentativi:', error);
      await logger.error('Errore job sincronizzazione Ministero', {
        error: error.message,
        stack: error.stack,
        attempts: this.maxRetries
      });
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.interval) {
      console.log('⚠️ Job sincronizzazione Ministero già avviato');
      return;
    }

    console.log(`🚀 Avvio job sincronizzazione Ministero`);
    console.log(`   - Sincronizzazione completa: ogni ${this.intervalMs / 1000 / 60} minuti`);
    console.log(`   - Sincronizzazione referendum in corso: ogni ${this.intervalInCorsoMs / 1000 / 60} minuti`);
    console.log(`   - Tentativi massimi in caso di errore: ${this.maxRetries}`);

    this.execute();

    this.interval = setInterval(() => {
      Promise.resolve(this.execute()).catch(error => {
        console.error('❌ Errore non gestito in execute():', error);
      });
    }, this.intervalMs);

    this.intervalInCorso = setInterval(() => {
      Promise.resolve(this.syncInCorsoOnly()).catch(error => {
        console.error('❌ Errore non gestito in syncInCorsoOnly():', error);
      });
    }, this.intervalInCorsoMs);

    this.scheduleDaily();
  }

  /**
   * Sincronizza solo i referendum "in corso" per avere dati più freschi.
   */
  async syncInCorsoOnly() {
    if (this.isRunningInCorso || this.isRunning) {
      console.log('⏸️ Sincronizzazione già in corso, skip sync in corso...');
      return;
    }

    this.isRunningInCorso = true;
    console.log(`🔄 Sincronizzazione rapida referendum in corso (${new Date().toISOString()})...`);

    try {
      const data = await ministeroSync.fetchAllFromMinistero();
      let iniziative = [];

      if (Array.isArray(data)) {
        iniziative = data;
      } else if (data && typeof data === 'object') {
        iniziative = data.content || data.iniziative || data.data || [];
      }

      const inCorso = iniziative.filter(item => {
        const stato = item.idDecStatoIniziativa?.nome || item.stato || '';
        return stato.toLowerCase().includes('raccolta') ||
               stato.toLowerCase().includes('aperto') ||
               stato.toLowerCase().includes('in corso');
      });

      console.log(`📊 Trovati ${inCorso.length} referendum/iniziative in corso da aggiornare`);

      let updated = 0;
      let errors = 0;
      for (const iniziativa of inCorso) {
        try {
          await ministeroSync.saveIniziativa(iniziativa);
          updated++;
        } catch (error) {
          errors++;
          console.error(`❌ Errore aggiornamento singola iniziativa:`, error.message);
        }
      }

      if (errors > 0 && updated === 0 && inCorso.length > 0) {
        console.error(`❌ Sincronizzazione rapida fallita: 0/${inCorso.length} aggiornati, ${errors} errori`);
      } else if (errors > 0) {
        console.warn(`⚠️ Sincronizzazione rapida parziale: ${updated}/${inCorso.length} aggiornati, ${errors} errori`);
      } else {
        console.log(`✅ Sincronizzazione rapida completata: ${updated} referendum aggiornati`);
      }
    } catch (error) {
      console.error('❌ Errore nella sincronizzazione rapida:', error.message);
    } finally {
      this.isRunningInCorso = false;
    }
  }

  scheduleDaily() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(3, 0, 0, 0);

    const msUntil3AM = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      Promise.resolve(this.execute()).catch(error => {
        console.error('❌ Errore non gestito in execute() (scheduleDaily):', error);
      });
      this.dailyInterval = setInterval(() => {
        Promise.resolve(this.execute()).catch(error => {
          console.error('❌ Errore non gestito in execute() (dailyInterval):', error);
        });
      }, 24 * 60 * 60 * 1000);
    }, msUntil3AM);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.intervalInCorso) {
      clearInterval(this.intervalInCorso);
      this.intervalInCorso = null;
    }
    if (this.dailyInterval) {
      clearInterval(this.dailyInterval);
      this.dailyInterval = null;
    }
    console.log('🛑 Job sincronizzazione Ministero fermato');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      lastSyncStatus: this.lastSyncStatus,
      lastSyncError: this.lastSyncError,
      intervalMs: this.intervalMs,
      intervalInCorsoMs: this.intervalInCorsoMs,
      maxRetries: this.maxRetries
    };
  }
}

module.exports = new MinisteroSyncJob();
