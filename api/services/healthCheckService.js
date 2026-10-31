// File: api/services/healthCheckService.js
const { pool } = require('../middleware/auth');
const performanceMonitor = require('./performanceMonitor');
const logger = require('./centralizedLogger');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

class HealthCheckService {
  constructor() {
    this.checks = {
      database: this.checkDatabase.bind(this),
      memory: this.checkMemory.bind(this),
      disk: this.checkDiskSpace.bind(this),
      network: this.checkNetwork.bind(this),
      services: this.checkServices.bind(this),
      security: this.checkSecurity.bind(this)
    };
  }

  // Esegue tutti i controlli di salute
  async runAllChecks() {
    const results = {
      timestamp: new Date().toISOString(),
      status: 'HEALTHY',
      checks: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };

    for (const [name, checkFunction] of Object.entries(this.checks)) {
      try {
        const checkResult = await checkFunction();
        results.checks[name] = checkResult;
        results.summary.total++;
        
        if (checkResult.status === 'OK') {
          results.summary.passed++;
        } else if (checkResult.status === 'WARNING') {
          results.summary.warnings++;
        } else {
          results.summary.failed++;
        }
      } catch (error) {
        results.checks[name] = {
          status: 'ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        };
        results.summary.total++;
        results.summary.failed++;
      }
    }

    // Determina status generale
    if (results.summary.failed > 0) {
      results.status = 'UNHEALTHY';
    } else if (results.summary.warnings > 0) {
      results.status = 'DEGRADED';
    }

    return results;
  }

  // Controlla database
  async checkDatabase() {
    const startTime = Date.now();
    
    try {
      // Test connessione
      const client = await pool.connect();
      
      // Test query semplice
      const result = await client.query('SELECT 1 as test');
      client.release();
      const includeCountsEnv = process.env.HEALTHCHECK_DB_INCLUDE_COUNTS;
      const includeCounts =
        includeCountsEnv === 'true' ? true :
        includeCountsEnv === 'false' ? false :
        process.env.NODE_ENV !== 'production';

      let userCount = null;
      let newUsersToday = null;
      if (includeCounts) {
        // Query più pesante: utile in debug, non necessaria per “sono vivo?”
        const complexResult = await pool.query(`
          SELECT 
            count(*) as user_count,
            count(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as new_users_today
          FROM users
        `);
        userCount = parseInt(complexResult.rows[0].user_count);
        newUsersToday = parseInt(complexResult.rows[0].new_users_today);
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'OK',
        message: 'Database operativo',
        responseTime: `${responseTime}ms`,
        ...(includeCounts ? { userCount, newUsersToday } : { countsSkipped: true }),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: `Database error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Controlla memoria
  async checkMemory() {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const freeMem = require('os').freemem();
      const usedMem = totalMem - freeMem;
      const memPercent = (usedMem / totalMem) * 100;
      
      let status = 'OK';
      if (memPercent > 90) {
        status = 'ERROR';
      } else if (memPercent > 80) {
        status = 'WARNING';
      }
      
      return {
        status,
        message: `Memoria: ${memPercent.toFixed(2)}% utilizzata`,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        systemTotal: totalMem,
        systemFree: freeMem,
        systemUsed: usedMem,
        memoryPercent: memPercent,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: `Memory check error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Controlla spazio disco
  async checkDiskSpace() {
    try {
      let totalBytes = 0;
      let freeBytes = 0;
      let usedBytes = 0;
      let diskPercent = 0;
      let isEstimated = false;
      let method = 'df';

      try {
        // Render/Linux: usa df per avere valori disco reali dell'host applicativo.
        const { stdout } = await execFileAsync('df', ['-Pk', '/']);
        const lines = stdout.trim().split('\n');
        const dataLine = lines[lines.length - 1];
        const cols = dataLine.trim().split(/\s+/);
        // Colonne df -Pk: Filesystem 1024-blocks Used Available Capacity Mounted on
        const totalKb = Number(cols[1] || 0);
        const usedKb = Number(cols[2] || 0);
        const availKb = Number(cols[3] || 0);
        totalBytes = totalKb * 1024;
        usedBytes = usedKb * 1024;
        freeBytes = availKb * 1024;
        diskPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
      } catch (_dfError) {
        // Fallback esplicito: stima su RAM (meno accurata), ma dichiarata in risposta.
        const os = require('os');
        freeBytes = os.freemem();
        totalBytes = os.totalmem();
        usedBytes = totalBytes - freeBytes;
        diskPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
        isEstimated = true;
        method = 'memory-estimate';
      }
      
      let status = 'OK';
      if (diskPercent > 95) {
        status = 'ERROR';
      } else if (diskPercent > 85) {
        status = 'WARNING';
      }
      
      return {
        status,
        message: `Spazio disco server app (Render): ${diskPercent.toFixed(2)}% utilizzato${isEstimated ? ' (stima)' : ''}`,
        source: 'render-app-server',
        sourceLabel: 'Server applicativo (Render) - NON Supabase',
        method,
        isEstimated,
        totalBytes,
        usedBytes,
        freeBytes,
        freeSpace: freeBytes,
        diskPercent: diskPercent,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: `Disk check error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Controlla rete
  async checkNetwork() {
    try {
      const networkInterfaces = require('os').networkInterfaces();
      const activeInterfaces = Object.keys(networkInterfaces).filter(name => {
        const interfaces = networkInterfaces[name];
        return interfaces.some(iface => !iface.internal && iface.family === 'IPv4');
      });
      
      return {
        status: 'OK',
        message: `Rete operativa: ${activeInterfaces.length} interfacce attive`,
        activeInterfaces: activeInterfaces,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: `Network check error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Controlla servizi
  async checkServices() {
    try {
      const services = {
        performanceMonitor: performanceMonitor.isMonitoring,
        database: true, // Già controllato in checkDatabase
        logging: true,  // Assumiamo che funzioni se arriviamo qui
        security: true  // Assumiamo che funzioni se arriviamo qui
      };
      
      const failedServices = Object.entries(services)
        .filter(([name, status]) => !status)
        .map(([name]) => name);
      
      let status = 'OK';
      if (failedServices.length > 0) {
        status = 'ERROR';
      }
      
      return {
        status,
        message: failedServices.length === 0 
          ? 'Tutti i servizi operativi' 
          : `Servizi non operativi: ${failedServices.join(', ')}`,
        services: services,
        failedServices: failedServices,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: `Services check error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Controlla sicurezza
  async checkSecurity() {
    try {
      // Se Axiom è abilitato, leggi da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        const { getCentralizedLogs } = require('../utils/axiomQueryHelper');
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getCentralizedLogs({
          startTime: oneHourAgo,
          endTime,
          limit: 100000
        });
        
        // Filtra errori di sicurezza
        const securityIssues = logs.filter(log => {
          const message = (log.message || '').toLowerCase();
          const level = log.level || '';
          return (level === 'ERROR' || level === 'E' || level === 'WARN' || level === 'W') &&
                 (message.includes('security') || message.includes('attack') || message.includes('violation'));
        }).length;
        
        let status = 'OK';
        if (securityIssues > 10) {
          status = 'ERROR';
        } else if (securityIssues > 5) {
          status = 'WARNING';
        }
        
        return {
          status,
          message: `Sicurezza: ${securityIssues} eventi nell'ultima ora`,
          securityIssues: securityIssues,
          timestamp: new Date().toISOString()
        };
      }
      
      // Fallback PostgreSQL solo se la tabella esiste (log migrati su Axiom)
      const { isCentralizedLogsTableAvailable } = require('../utils/centralizedLogsDb');
      if (!(await isCentralizedLogsTableAvailable())) {
        return {
          status: 'OK',
          message: 'Sicurezza: log su Axiom (tabella centralized_logs non presente)',
          securityIssues: 0,
          timestamp: new Date().toISOString()
        };
      }

      const securityErrorsQuery = `
        SELECT COUNT(*) as count
        FROM centralized_logs 
        WHERE timestamp >= (EXTRACT(EPOCH FROM NOW() - INTERVAL '1 hour') * 1000)::BIGINT
        AND (message ILIKE '%security%' OR message ILIKE '%attack%' OR message ILIKE '%violation%')
        AND level IN ('E', 'W')
      `;
      
      const result = await pool.query(securityErrorsQuery);
      const securityIssues = parseInt(result.rows[0].count);
      
      let status = 'OK';
      if (securityIssues > 10) {
        status = 'ERROR';
      } else if (securityIssues > 5) {
        status = 'WARNING';
      }
      
      return {
        status,
        message: `Sicurezza: ${securityIssues} eventi nell'ultima ora`,
        securityIssues: securityIssues,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: `Security check error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Ottieni metriche di performance correnti
  getCurrentPerformanceMetrics() {
    return performanceMonitor.getCurrentMetrics();
  }

  // Ottieni stato salute sistema
  getSystemHealth() {
    return performanceMonitor.getSystemHealth();
  }

  // Ottieni metriche storiche
  async getHistoricalMetrics(hours = 24) {
    return await performanceMonitor.getHistoricalMetrics(hours);
  }

  // Salva stato salute
  async saveHealthStatus(healthStatus) {
    try {
      const query = `
        INSERT INTO health_checks (
          timestamp, status, checks, summary
        ) VALUES ($1, $2, $3, $4)
      `;
      
      await pool.query(query, [
        healthStatus.timestamp,
        healthStatus.status,
        JSON.stringify(healthStatus.checks),
        JSON.stringify(healthStatus.summary)
      ]);
    } catch (error) {
      console.error('❌ Errore salvataggio stato salute:', error);
    }
  }

  // Ottieni storico controlli salute
  async getHealthHistory(hours = 24) {
    try {
      const query = `
        SELECT * FROM health_checks 
        WHERE timestamp >= NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
      `;
      
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore recupero storico salute:', error);
      return [];
    }
  }

  // RP-10 not approved: block direct callers before any database query.
  async cleanupHealthHistory(_retentionDays = 30) {
    const error = new Error('RETENTION_POLICY_NOT_APPROVED');
    error.code = 'RETENTION_POLICY_NOT_APPROVED';
    error.statusCode = 409;
    throw error;
  }

}

// Istanza singleton
const healthCheckService = new HealthCheckService();

module.exports = healthCheckService;
