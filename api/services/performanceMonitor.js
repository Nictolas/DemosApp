// File: api/services/performanceMonitor.js
const os = require('os');
const process = require('process');
const { pool } = require('../middleware/auth');

// Axiom integration per performance metrics
let Axiom;
let axiomPerformance;
try {
  Axiom = require('@axiomhq/axiom-node');
  if (process.env.AXIOM_ENABLED === 'true' && process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
    axiomPerformance = new Axiom({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: process.env.AXIOM_REGION || 'eu'
    });
  }
} catch (error) {
  // Axiom SDK non installato, continua senza
  axiomPerformance = null;
}
const logger = require('./centralizedLogger');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      system: {},
      application: {},
      database: {},
      memory: {},
      network: {},
      errors: {}
    };
    
    this.thresholds = {
      cpu: 80,           // CPU usage %
      memory: 85,        // Memory usage %
      responseTime: 2000, // Response time ms
      errorRate: 5,      // Error rate %
      dbConnections: 80, // DB connections %
      diskSpace: 90      // Disk space %
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.alertCooldown = new Map(); // Prevenzione spam alert

    // Contatori/cache per ridurre query DB “pesanti” ad alta frequenza.
    this.tickCount = 0;
    this.dbMetricsCache = {
      size: { at: 0, value: null },
      slowQueries: { at: 0, value: null },
    };
    /** Ultimo snapshot DB riuscito (usato se PERFORMANCE_MONITOR_DB_METRICS_ENABLED=false). */
    this._lastDatabaseMetrics = null;
    /** Cache metriche errori (Axiom/PostgreSQL) tra un tick e l’altro. */
    this._errorMetricsCache = null;
  }

  // Avvia monitoraggio
  start(intervalMs = 30000) {
    if (this.isMonitoring) {
      console.log('⚠️ Performance monitoring già attivo');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        this.tickCount += 1;
        await this.collectMetrics();
        await this.checkThresholds();
        await this.logMetrics();
      } catch (error) {
        console.error('❌ Errore monitoraggio performance:', error);
      }
    }, intervalMs);

    console.log(`📊 Performance monitoring avviato (intervallo: ${intervalMs}ms)`);
  }

  // Ferma monitoraggio
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('📊 Performance monitoring fermato');
  }

  // Raccoglie metriche sistema
  async collectMetrics() {
    const timestamp = new Date().toISOString();
    
    // Metriche sistema
    this.metrics.system = {
      timestamp,
      uptime: process.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      pid: process.pid,
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg()
    };

    // Metriche applicazione
    this.metrics.application = {
      timestamp,
      memoryUsage: process.memoryUsage(),
      cpuUsage: await this.getCpuUsage(),
      eventLoopDelay: await this.getEventLoopDelay(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length
    };

    // Metriche database
    this.metrics.database = await this.getDatabaseMetrics();

    // Metriche memoria
    this.metrics.memory = {
      timestamp,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      rss: process.memoryUsage().rss,
      systemTotal: os.totalmem(),
      systemFree: os.freemem(),
      systemUsed: os.totalmem() - os.freemem()
    };

    // Metriche rete
    this.metrics.network = await this.getNetworkMetrics();

    // Metriche errori
    this.metrics.errors = await this.getErrorMetrics();
  }

  // Calcola utilizzo CPU
  async getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const cpuTime = (endUsage.user + endUsage.system) / 1000; // Convert to ms
        const elapsedTime = endTime - startTime;
        const cpuPercent = (cpuTime / elapsedTime) * 100;
        
        resolve({
          percent: Math.min(cpuPercent, 100),
          user: endUsage.user / 1000,
          system: endUsage.system / 1000
        });
      }, 100);
    });
  }

  // Calcola delay event loop
  async getEventLoopDelay() {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(delay);
      });
    });
  }

  // Metriche database
  async getDatabaseMetrics() {
    if (process.env.PERFORMANCE_MONITOR_DB_METRICS_ENABLED === 'false') {
      if (this._lastDatabaseMetrics) {
        return {
          ...this._lastDatabaseMetrics,
          timestamp: new Date().toISOString(),
          dbMetricsSkipped: true,
        };
      }
      return {
        timestamp: new Date().toISOString(),
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        databaseSize: 'N/A',
        databaseSizeBytes: 0,
        slowQueries: [],
        dbMetricsSkipped: true,
      };
    }

    let client = null;
    try {
      client = await pool.connect();
      
      // Connessioni attive
      const connectionsQuery = `
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      
      const connections = await client.query(connectionsQuery);

      // Sampling metriche “pesanti”: evita di interrogare size/statements ad ogni tick.
      const heavyEveryNTicks = Math.max(
        1,
        parseInt(process.env.PERFORMANCE_MONITOR_HEAVY_DB_METRICS_EVERY_N_TICKS || '10', 10)
      );
      const isHeavyTick = this.tickCount % heavyEveryNTicks === 0;

      // Dimensioni database (pesante): ricalcola solo su heavy tick, altrimenti usa cache.
      let databaseSize = 'N/A';
      let databaseSizeBytes = 0;
      if (isHeavyTick || !this.dbMetricsCache.size.value) {
        try {
          const sizeQuery = `
            SELECT pg_size_pretty(pg_database_size(current_database())) as database_size,
                   pg_database_size(current_database()) as database_size_bytes
          `;
          const size = await client.query(sizeQuery);
          databaseSize = size.rows[0]?.database_size || 'N/A';
          databaseSizeBytes = parseInt(size.rows[0]?.database_size_bytes || 0);
          this.dbMetricsCache.size = {
            at: Date.now(),
            value: { databaseSize, databaseSizeBytes },
          };
        } catch (_e) {
          // Se fallisce, prova comunque cache precedente
        }
      }
      if (this.dbMetricsCache.size.value) {
        databaseSize = this.dbMetricsCache.size.value.databaseSize;
        databaseSizeBytes = this.dbMetricsCache.size.value.databaseSizeBytes;
      }

      // Query lente (pg_stat_statements): ricalcola solo su heavy tick, altrimenti usa cache.
      let slowQueries = [];
      if (isHeavyTick || !this.dbMetricsCache.slowQueries.value) {
        try {
          const slowQueriesQuery = `
            SELECT query, mean_exec_time, calls, total_exec_time
            FROM pg_stat_statements 
            WHERE mean_exec_time > 1000 
            ORDER BY mean_exec_time DESC 
            LIMIT 5
          `;
          const slowQueriesResult = await client.query(slowQueriesQuery);
          slowQueries = slowQueriesResult.rows;
          this.dbMetricsCache.slowQueries = { at: Date.now(), value: slowQueries };
        } catch (_error) {
          // pg_stat_statements potrebbe non essere abilitato
        }
      }
      if (!slowQueries.length && Array.isArray(this.dbMetricsCache.slowQueries.value)) {
        slowQueries = this.dbMetricsCache.slowQueries.value;
      }
      
      const out = {
        timestamp: new Date().toISOString(),
        totalConnections: parseInt(connections.rows[0]?.total_connections || 0),
        activeConnections: parseInt(connections.rows[0]?.active_connections || 0),
        idleConnections: parseInt(connections.rows[0]?.idle_connections || 0),
        databaseSize,
        databaseSizeBytes,
        slowQueries: slowQueries
      };
      this._lastDatabaseMetrics = { ...out };
      delete this._lastDatabaseMetrics.timestamp;
      return out;
    } catch (error) {
      console.error('❌ Errore metriche database:', error);
      return {
        timestamp: new Date().toISOString(),
        error: error.message
      };
    } finally {
      // Garantisce sempre il release del client
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('❌ Errore nel rilasciare client database:', releaseError);
        }
      }
    }
  }

  // Metriche rete
  async getNetworkMetrics() {
    const networkInterfaces = os.networkInterfaces();
    const stats = {
      timestamp: new Date().toISOString(),
      interfaces: {}
    };

    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      stats.interfaces[name] = interfaces.map(iface => ({
        family: iface.family,
        address: iface.address,
        internal: iface.internal
      }));
    }

    return stats;
  }

  // Metriche errori
  async getErrorMetrics() {
    if (process.env.PERFORMANCE_MONITOR_ERROR_METRICS_ENABLED === 'false') {
      return {
        timestamp: new Date().toISOString(),
        errorsLastHour: 0,
        warningsLastHour: 0,
        totalIssues: 0,
        errorMetricsSkipped: true
      };
    }

    const errorEveryNTicks = Math.max(
      1,
      parseInt(process.env.PERFORMANCE_MONITOR_ERROR_METRICS_EVERY_N_TICKS || '1', 10)
    );
    if (
      errorEveryNTicks > 1 &&
      this._errorMetricsCache &&
      this.tickCount % errorEveryNTicks !== 0
    ) {
      return {
        ...this._errorMetricsCache,
        timestamp: new Date().toISOString(),
        errorMetricsCached: true
      };
    }

    try {
      // Se Axiom è abilitato, leggi da Axiom (anche se la tabella centralized_logs è stata eliminata)
      if (process.env.AXIOM_ENABLED === 'true') {
        try {
          const { getCentralizedLogs } = require('../utils/axiomQueryHelper');
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const endTime = new Date();
          const axiomLimit = Math.max(
            100,
            parseInt(process.env.PERFORMANCE_MONITOR_AXIOM_LOGS_LIMIT || '10000', 10)
          );

          const logs = await getCentralizedLogs({
            startTime: oneHourAgo,
            endTime,
            limit: axiomLimit
          });
          
          // Filtra ERROR e WARN
          const errors = logs.filter(log => log.level === 'ERROR' || log.level === 'E').length;
          const warnings = logs.filter(log => log.level === 'WARN' || log.level === 'W').length;
          
          const axiomOut = {
            timestamp: new Date().toISOString(),
            errorsLastHour: errors,
            warningsLastHour: warnings,
            totalIssues: errors + warnings
          };
          this._errorMetricsCache = { ...axiomOut };
          delete this._errorMetricsCache.timestamp;
          return axiomOut;
        } catch (error) {
          console.error('❌ Errore metriche errori da Axiom:', error);
          return {
            timestamp: new Date().toISOString(),
            errorsLastHour: 0,
            warningsLastHour: 0,
            totalIssues: 0
          };
        }
      }

      const { isCentralizedLogsTableAvailable } = require('../utils/centralizedLogsDb');
      if (!(await isCentralizedLogsTableAvailable())) {
        return {
          timestamp: new Date().toISOString(),
          errorsLastHour: 0,
          warningsLastHour: 0,
          totalIssues: 0
        };
      }
      
      const query = `
        SELECT 
          level,
          COUNT(*) as count
        FROM centralized_logs 
        WHERE timestamp >= (EXTRACT(EPOCH FROM NOW() - INTERVAL '1 hour') * 1000)::BIGINT
        AND level IN ('E', 'W')
        GROUP BY level
      `;
      
      const result = await pool.query(query);
      const errorCounts = result.rows.reduce((acc, row) => {
        acc[row.level] = parseInt(row.count);
        return acc;
      }, {});

      const dbOut = {
        timestamp: new Date().toISOString(),
        errorsLastHour: errorCounts.E || 0,
        warningsLastHour: errorCounts.W || 0,
        totalIssues: (errorCounts.E || 0) + (errorCounts.W || 0)
      };
      this._errorMetricsCache = { ...dbOut };
      delete this._errorMetricsCache.timestamp;
      return dbOut;
    } catch (error) {
      console.error('❌ Errore metriche errori:', error);
      return {
        timestamp: new Date().toISOString(),
        errorsLastHour: 0,
        warningsLastHour: 0,
        totalIssues: 0
      };
    }
  }

  // Controlla soglie e genera alert
  async checkThresholds() {
    const alerts = [];

    // CPU
    if (this.metrics.application.cpuUsage.percent > this.thresholds.cpu) {
      alerts.push({
        type: 'CPU_HIGH',
        severity: 'WARNING',
        message: `CPU usage alto: ${this.metrics.application.cpuUsage.percent.toFixed(2)}%`,
        value: this.metrics.application.cpuUsage.percent,
        threshold: this.thresholds.cpu
      });
    }

    // Memoria
    const memoryPercent = (this.metrics.memory.systemUsed / this.metrics.memory.systemTotal) * 100;
    if (memoryPercent > this.thresholds.memory) {
      alerts.push({
        type: 'MEMORY_HIGH',
        severity: 'WARNING',
        message: `Memoria usage alto: ${memoryPercent.toFixed(2)}%`,
        value: memoryPercent,
        threshold: this.thresholds.memory
      });
    }

    // Database connections
    const dbPercent = (this.metrics.database.activeConnections / 100) * 100; // Assumendo max 100 connessioni
    if (dbPercent > this.thresholds.dbConnections) {
      alerts.push({
        type: 'DB_CONNECTIONS_HIGH',
        severity: 'WARNING',
        message: `Connessioni DB alte: ${this.metrics.database.activeConnections}`,
        value: this.metrics.database.activeConnections,
        threshold: this.thresholds.dbConnections
      });
    }

    // Errori
    if (this.metrics.errors.totalIssues > this.thresholds.errorRate) {
      alerts.push({
        type: 'ERROR_RATE_HIGH',
        severity: 'CRITICAL',
        message: `Tasso errori alto: ${this.metrics.errors.totalIssues} errori/ore`,
        value: this.metrics.errors.totalIssues,
        threshold: this.thresholds.errorRate
      });
    }

    // Event loop delay
    if (this.metrics.application.eventLoopDelay > 100) {
      alerts.push({
        type: 'EVENT_LOOP_DELAY',
        severity: 'WARNING',
        message: `Event loop delay alto: ${this.metrics.application.eventLoopDelay.toFixed(2)}ms`,
        value: this.metrics.application.eventLoopDelay,
        threshold: 100
      });
    }

    // Invia alert se necessario
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  // Invia alert
  async sendAlert(alert) {
    const alertKey = `${alert.type}_${new Date().toISOString().split('T')[0]}`;
    
    // Controlla cooldown per evitare spam
    if (this.alertCooldown.has(alertKey)) {
      return;
    }

    // Log dell'alert
    await logger.warn(`Performance Alert: ${alert.message}`, {
      alertType: alert.type,
      severity: alert.severity,
      value: alert.value,
      threshold: alert.threshold,
      timestamp: new Date().toISOString()
    });

    // Imposta cooldown (1 ora)
    this.alertCooldown.set(alertKey, true);
    setTimeout(() => {
      this.alertCooldown.delete(alertKey);
    }, 60 * 60 * 1000);

    console.log(`🚨 PERFORMANCE ALERT: ${alert.message}`);
  }

  // Log metriche
  async logMetrics() {
    await logger.debug('Performance metrics collected', {
      system: this.metrics.system,
      application: this.metrics.application,
      database: this.metrics.database,
      memory: this.metrics.memory,
      errors: this.metrics.errors
    });
  }

  // Ottieni metriche correnti
  getCurrentMetrics() {
    return this.metrics;
  }

  // Ottieni stato salute sistema
  getSystemHealth() {
    const health = {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check CPU
    health.checks.cpu = {
      status: this.metrics.application.cpuUsage?.percent < this.thresholds.cpu ? 'OK' : 'WARNING',
      value: this.metrics.application.cpuUsage?.percent || 0,
      threshold: this.thresholds.cpu
    };

    // Check Memory
    const memoryPercent = this.metrics.memory.systemUsed / this.metrics.memory.systemTotal * 100;
    health.checks.memory = {
      status: memoryPercent < this.thresholds.memory ? 'OK' : 'WARNING',
      value: memoryPercent,
      threshold: this.thresholds.memory
    };

    // Check Database
    const dbPercent = (this.metrics.database.activeConnections || 0) / 100 * 100;
    health.checks.database = {
      status: dbPercent < this.thresholds.dbConnections ? 'OK' : 'WARNING',
      value: this.metrics.database.activeConnections || 0,
      threshold: this.thresholds.dbConnections
    };

    // Check Errors
    health.checks.errors = {
      status: (this.metrics.errors.totalIssues || 0) < this.thresholds.errorRate ? 'OK' : 'CRITICAL',
      value: this.metrics.errors.totalIssues || 0,
      threshold: this.thresholds.errorRate
    };

    // Check Event Loop
    health.checks.eventLoop = {
      status: (this.metrics.application.eventLoopDelay || 0) < 100 ? 'OK' : 'WARNING',
      value: this.metrics.application.eventLoopDelay || 0,
      threshold: 100
    };

    // Status generale
    const hasCritical = Object.values(health.checks).some(check => check.status === 'CRITICAL');
    const hasWarning = Object.values(health.checks).some(check => check.status === 'WARNING');
    
    if (hasCritical) {
      health.status = 'CRITICAL';
    } else if (hasWarning) {
      health.status = 'WARNING';
    }

    return health;
  }

  // Salva metriche storiche
  async saveHistoricalMetrics() {
    try {
      const query = `
        INSERT INTO performance_metrics (
          timestamp, cpu_usage, memory_usage, memory_total, memory_free,
          db_connections, db_size_bytes, error_count, warning_count,
          event_loop_delay, uptime, load_average
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      
      const values = [
        new Date().toISOString(),
        this.metrics.application.cpuUsage?.percent || 0,
        this.metrics.memory.systemUsed || 0,
        this.metrics.memory.systemTotal || 0,
        this.metrics.memory.systemFree || 0,
        this.metrics.database.activeConnections || 0,
        this.metrics.database.databaseSizeBytes || 0,
        this.metrics.errors.errorsLastHour || 0,
        this.metrics.errors.warningsLastHour || 0,
        this.metrics.application.eventLoopDelay || 0,
        this.metrics.system.uptime || 0,
        JSON.stringify(this.metrics.system.loadAverage || [])
      ];
      
      await pool.query(query, values);
      
      // Invia anche ad Axiom (dataset real-time)
      this.sendMetricsToAxiom(values).catch(() => {});
    } catch (error) {
      console.error('❌ Errore salvataggio metriche storiche:', error);
    }
  }

  /**
   * Invia performance metrics ad Axiom (dataset real-time)
   * DISABILITATO: Le performance metrics non sono necessarie per GDPR
   * Mantengono solo metriche tecniche (CPU, memoria, database) che non riguardano dati personali
   */
  async sendMetricsToAxiom(metricsValues) {
    // DISABILITATO per GDPR compliance
    // Le performance metrics non sono necessarie per conformità GDPR
    // Contengono solo metriche tecniche (CPU, memoria, database) che non riguardano dati personali
    return;
    
    // Codice originale commentato per riferimento:
    /*
    if (!axiomPerformance || process.env.AXIOM_ENABLED !== 'true') return;

    try {
      const logEntry = {
        _time: new Date().toISOString(),
        log_type: 'performance',
        cpu_usage: metricsValues[1],
        memory_usage: metricsValues[2],
        memory_total: metricsValues[3],
        memory_free: metricsValues[4],
        db_connections: metricsValues[5],
        db_size_bytes: metricsValues[6],
        error_count: metricsValues[7],
        warning_count: metricsValues[8],
        event_loop_delay: metricsValues[9],
        uptime: metricsValues[10],
        load_average: metricsValues[11] ? JSON.parse(metricsValues[11]) : null
      };

      const dataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
      axiomPerformance.ingestEvents(dataset, [logEntry])
        .catch(err => {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Errore invio performance metrics Axiom:', err.message);
          }
        });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Errore preparazione performance metrics Axiom:', error);
      }
    }
    */
  }

  // Ottieni metriche storiche
  async getHistoricalMetrics(hours = 24) {
    try {
      const query = `
        SELECT * FROM performance_metrics 
        WHERE timestamp >= NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
      `;
      
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore recupero metriche storiche:', error);
      return [];
    }
  }

  // RP-10 not approved: block direct callers before any database query.
  async cleanupOldMetrics(_retentionDays = 30) {
    const error = new Error('RETENTION_POLICY_NOT_APPROVED');
    error.code = 'RETENTION_POLICY_NOT_APPROVED';
    error.statusCode = 409;
    throw error;
  }

}

// Istanza singleton
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
