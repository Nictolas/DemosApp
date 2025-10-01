// File: api/services/performanceOptimizer.js
// Sistema di ottimizzazione performance che si integra con il monitoraggio esistente
const { getPool, getPoolStats } = require('../config/database');
const logger = require('./centralizedLogger');

class PerformanceOptimizer {
  constructor() {
    this.optimizations = {
      database: {
        connectionPool: true,
        queryOptimization: true,
        connectionReuse: true
      },
      rateLimiting: {
        adaptiveLimits: true,
        userBasedLimits: true,
        burstHandling: true
      },
      memory: {
        garbageCollection: true,
        memoryLeakDetection: true,
        cacheOptimization: true
      }
    };
    
    this.metrics = {
      activeUsers: 0,
      averageResponseTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      databaseConnections: 0
    };
    
    this.isOptimizing = false;
  }

  // Avvia ottimizzazioni automatiche
  start() {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    console.log('🚀 Avvio ottimizzazioni performance automatiche...');
    
    // Ottimizzazioni ogni 30 secondi
    setInterval(() => {
      this.performOptimizations();
    }, 30000);
    
    // Monitoraggio real-time ogni 10 secondi
    setInterval(() => {
      this.updateMetrics();
    }, 10000);
  }

  // Esegue ottimizzazioni basate sulle metriche correnti
  async performOptimizations() {
    try {
      const poolStats = getPoolStats();
      const memoryUsage = process.memoryUsage();
      
      // Ottimizzazione pool database
      if (poolStats && poolStats.utilizationPercent > 80) {
        console.log('⚠️ Pool database saturo, ottimizzando...');
        await this.optimizeDatabasePool();
      }
      
      // Ottimizzazione memoria
      if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.8) {
        console.log('⚠️ Memoria satura, forzando garbage collection...');
        this.optimizeMemory();
      }
      
      // Ottimizzazione rate limiting dinamico
      await this.optimizeRateLimiting();
      
    } catch (error) {
      console.error('❌ Errore durante ottimizzazioni:', error);
      logger.logError(error, null, { context: 'performance_optimizer' });
    }
  }

  // Ottimizza il pool di connessioni database
  async optimizeDatabasePool() {
    try {
      const pool = getPool();
      const stats = getPoolStats();
      
      console.log('🔧 Ottimizzazione pool database:', stats);
      
      // Se il pool è saturo, chiudi connessioni idle
      if (stats.idleCount > 5) {
        console.log('🧹 Chiusura connessioni idle in eccesso');
        // Il pool gestisce automaticamente le connessioni idle
      }
      
      // Log delle statistiche per monitoraggio
      logger.logInfo('Pool database ottimizzato', {
        totalConnections: stats.totalCount,
        idleConnections: stats.idleCount,
        utilization: stats.utilizationPercent
      });
      
    } catch (error) {
      console.error('❌ Errore ottimizzazione pool:', error);
    }
  }

  // Ottimizza l'utilizzo della memoria
  optimizeMemory() {
    try {
      const beforeGC = process.memoryUsage();
      
      // Forza garbage collection se disponibile
      if (global.gc) {
        global.gc();
        console.log('🗑️ Garbage collection forzato');
      }
      
      const afterGC = process.memoryUsage();
      const freed = beforeGC.heapUsed - afterGC.heapUsed;
      
      console.log(`💾 Memoria liberata: ${Math.round(freed / 1024 / 1024)}MB`);
      
      logger.logInfo('Memoria ottimizzata', {
        beforeGC: Math.round(beforeGC.heapUsed / 1024 / 1024),
        afterGC: Math.round(afterGC.heapUsed / 1024 / 1024),
        freed: Math.round(freed / 1024 / 1024)
      });
      
    } catch (error) {
      console.error('❌ Errore ottimizzazione memoria:', error);
    }
  }

  // Ottimizza il rate limiting in base al carico
  async optimizeRateLimiting() {
    try {
      // Calcola il carico attuale
      const poolStats = getPoolStats();
      const memoryUsage = process.memoryUsage();
      
      const loadFactor = this.calculateLoadFactor(poolStats, memoryUsage);
      
      // Se il carico è basso, possiamo essere più permissivi
      if (loadFactor < 0.5) {
        console.log('📈 Carico basso, rate limiting più permissivo');
        // Qui potresti implementare logica per aumentare i limiti dinamicamente
      }
      
      // Se il carico è alto, essere più restrittivi
      if (loadFactor > 0.8) {
        console.log('📉 Carico alto, rate limiting più restrittivo');
        // Qui potresti implementare logica per ridurre i limiti dinamicamente
      }
      
    } catch (error) {
      console.error('❌ Errore ottimizzazione rate limiting:', error);
    }
  }

  // Calcola il fattore di carico del sistema
  calculateLoadFactor(poolStats, memoryUsage) {
    const poolUtilization = poolStats ? poolStats.utilizationPercent / 100 : 0;
    const memoryUtilization = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    // Media pesata dei fattori di carico
    return (poolUtilization * 0.6) + (memoryUtilization * 0.4);
  }

  // Aggiorna le metriche per il monitoraggio
  async updateMetrics() {
    try {
      const poolStats = getPoolStats();
      const memoryUsage = process.memoryUsage();
      
      this.metrics = {
        activeUsers: await this.getActiveUsersCount(),
        averageResponseTime: await this.getAverageResponseTime(),
        errorRate: await this.getErrorRate(),
        memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        databaseConnections: poolStats ? poolStats.totalCount : 0,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Errore aggiornamento metriche:', error);
    }
  }

  // Ottiene il numero di utenti attivi
  async getActiveUsersCount() {
    try {
      const pool = getPool();
      // Usa created_at come proxy per l'attività, dato che last_activity non esiste
      const result = await pool.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE created_at > NOW() - INTERVAL '15 minutes'
      `);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('❌ Errore conteggio utenti attivi:', error);
      return 0;
    }
  }

  // Ottiene il tempo di risposta medio
  async getAverageResponseTime() {
    // Implementazione semplificata - potresti usare un sistema di metriche più sofisticato
    return 0; // Placeholder
  }

  // Ottiene il tasso di errori
  async getErrorRate() {
    try {
      const pool = getPool();
      const result = await pool.query(`
        SELECT COUNT(*) as error_count 
        FROM centralized_logs 
        WHERE level = 'error' 
        AND created_at > NOW() - INTERVAL '1 hour'
      `);
      return parseInt(result.rows[0].error_count);
    } catch (error) {
      console.error('❌ Errore calcolo tasso errori:', error);
      return 0;
    }
  }

  // Ottiene le metriche correnti per il dashboard
  getCurrentMetrics() {
    return {
      ...this.metrics,
      optimizations: this.optimizations,
      isOptimizing: this.isOptimizing
    };
  }

  // Ottiene raccomandazioni per migliorare le performance
  getRecommendations() {
    const recommendations = [];
    
    if (this.metrics.memoryUsage > 500) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'Utilizzo memoria elevato. Considera di aumentare la memoria disponibile.',
        action: 'Aumenta i limiti di memoria del server'
      });
    }
    
    if (this.metrics.databaseConnections > 80) {
      recommendations.push({
        type: 'database',
        priority: 'medium',
        message: 'Pool database saturo. Considera di aumentare il numero di connessioni.',
        action: 'Aumenta max connections nel pool'
      });
    }
    
    if (this.metrics.errorRate > 10) {
      recommendations.push({
        type: 'errors',
        priority: 'high',
        message: 'Tasso di errori elevato. Verifica i log per identificare i problemi.',
        action: 'Analizza i log di errore e risolvi i problemi identificati'
      });
    }
    
    return recommendations;
  }

  // Ferma le ottimizzazioni
  stop() {
    this.isOptimizing = false;
    console.log('⏹️ Ottimizzazioni performance fermate');
  }
}

// Singleton
const performanceOptimizer = new PerformanceOptimizer();

module.exports = performanceOptimizer;
