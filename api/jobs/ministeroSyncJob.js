const ministeroSync = require('../services/ministeroSync');
const logger = require('../services/centralizedLogger');

/**
 * Job periodico per sincronizzare iniziative/referendum dal Ministero
 * Esegue ogni 1 ora per dati freschi (configurabile)
 * Sincronizzazione differenziata: più frequente per referendum "in corso"
 */
class MinisteroSyncJob {
  constructor() {
    this.interval = null;
    this.intervalInCorso = null; // Sincronizzazione più frequente per referendum in corso
    this.dailyInterval = null; // Interval per sincronizzazione giornaliera
    this.isRunning = false;
    this.isRunningInCorso = false; // Flag separata per sync rapida
    this.lastSyncTime = null;
    this.lastSyncStatus = null;
    this.lastSyncError = null;
    
    // Intervallo principale: ogni 1 ora (3600000 ms) invece di 6 ore per dati più freschi
    this.intervalMs = parseInt(process.env.MINISTERO_SYNC_INTERVAL_MS || '3600000'); // Default 1 ora
    
    // Intervallo per referendum "in corso": ogni 30 minuti per aggiornamenti più frequenti
    this.intervalInCorsoMs = parseInt(process.env.MINISTERO_SYNC_IN_CORSO_INTERVAL_MS || '1800000'); // Default 30 minuti
    
    // Numero di tentativi in caso di errore
    this.maxRetries = parseInt(process.env.MINISTERO_SYNC_MAX_RETRIES || '3');
    this.retryDelayMs = parseInt(process.env.MINISTERO_SYNC_RETRY_DELAY_MS || '60000'); // 1 minuto
  }

  /**
   * Esegue la sincronizzazione con retry automatico
   */
  async executeWithRetry() {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await ministeroSync.syncAll();
        this.lastSyncStatus = 'success';
        this.lastSyncError = null;
        return; // Successo, esci dal loop
      } catch (error) {
        lastError = error;
        console.error(`❌ Tentativo ${attempt}/${this.maxRetries} fallito:`, error.message);
        
        if (attempt < this.maxRetries) {
          console.log(`⏳ Riprovo tra ${this.retryDelayMs / 1000} secondi...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
        }
      }
    }
    
    // Tutti i tentativi falliti
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
      await this.executeWithRetry();
      console.log(`✅ Sincronizzazione Ministero completata con successo (${new Date().toISOString()})`);
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
    
    // Esegui immediatamente al primo avvio
    this.execute();

    // Sincronizzazione completa periodica (tutti i referendum)
    this.interval = setInterval(() => {
      // Wrappare in Promise per gestire errori async e evitare unhandledRejection
      Promise.resolve(this.execute()).catch(error => {
        console.error('❌ Errore non gestito in execute():', error);
      });
    }, this.intervalMs);

    // Sincronizzazione più frequente per referendum "in corso" (solo quelli attivi)
    // Questo permette di avere dati più freschi per i referendum attualmente in votazione
    this.intervalInCorso = setInterval(() => {
      // Wrappare in Promise per gestire errori async e evitare unhandledRejection
      Promise.resolve(this.syncInCorsoOnly()).catch(error => {
        console.error('❌ Errore non gestito in syncInCorsoOnly():', error);
      });
    }, this.intervalInCorsoMs);

    // Esegui anche ogni giorno alle 3:00 AM per sincronizzazione completa
    this.scheduleDaily();
  }

  /**
   * Sincronizza solo i referendum "in corso" per avere dati più freschi
   * Questa sincronizzazione è più leggera e veloce
   */
  async syncInCorsoOnly() {
    if (this.isRunningInCorso || this.isRunning) {
      console.log('⏸️ Sincronizzazione già in corso, skip sync in corso...');
      return;
    }

    this.isRunningInCorso = true;
    console.log(`🔄 Sincronizzazione rapida referendum in corso (${new Date().toISOString()})...`);

    try {
      // Recupera solo i referendum in corso dall'API
      const data = await ministeroSync.fetchAllFromMinistero();
      let iniziative = [];
      
      if (Array.isArray(data)) {
        iniziative = data;
      } else if (data && typeof data === 'object') {
        iniziative = data.content || data.iniziative || data.data || [];
      }

      // Filtra solo quelli in corso
      const inCorso = iniziative.filter(item => {
        const stato = item.idDecStatoIniziativa?.nome || item.stato || '';
        return stato.toLowerCase().includes('raccolta') || 
               stato.toLowerCase().includes('aperto') || 
               stato.toLowerCase().includes('in corso');
      });

      console.log(`📊 Trovati ${inCorso.length} referendum/iniziative in corso da aggiornare`);

      // Aggiorna solo questi nel database
      let updated = 0;
      for (const iniziativa of inCorso) {
        try {
          await ministeroSync.saveIniziativa(iniziativa);
          updated++;
        } catch (error) {
          console.error(`❌ Errore aggiornamento singola iniziativa:`, error.message);
        }
      }

      console.log(`✅ Sincronizzazione rapida completata: ${updated} referendum aggiornati`);
    } catch (error) {
      console.error('❌ Errore nella sincronizzazione rapida:', error.message);
      // Non blocchiamo il job principale per errori nella sync rapida
    } finally {
      this.isRunningInCorso = false;
    }
  }

  scheduleDaily() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(3, 0, 0, 0); // 3:00 AM

    const msUntil3AM = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      // Wrappare in Promise per gestire errori async
      Promise.resolve(this.execute()).catch(error => {
        console.error('❌ Errore non gestito in execute() (scheduleDaily):', error);
      });
      // Dopo la prima esecuzione, programma ogni 24 ore
      // Salva riferimento per cleanup
      this.dailyInterval = setInterval(() => {
        // Wrappare in Promise per gestire errori async
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

  /**
   * Restituisce lo stato attuale della sincronizzazione
   */
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

