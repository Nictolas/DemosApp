// File: api/routes/admin/monitoring.js
const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const performanceMonitor = require('../../services/performanceMonitor');
const performanceOptimizer = require('../../services/performanceOptimizer');
const healthCheckService = require('../../services/healthCheckService');
const { pool } = require('../../middleware/auth');
const { auditMiddleware } = require('../../middleware/auditMiddleware');
const { getCentralizedLogs } = require('../../utils/axiomQueryHelper');

const router = express.Router();
router.use(verifyToken, requireAdmin);

const MONITORING_TIMEOUT_MS = parseInt(process.env.MONITORING_ROUTE_TIMEOUT_MS || '12000', 10);

async function withTimeout(promise, timeoutMs, label = 'operazione monitoring') {
  let timer;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout dopo ${timeoutMs}ms`)), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// GET /api/admin/monitoring/health - Stato salute sistema
// NOTE: niente auditMiddleware sulle GET di monitoring per evitare punti di blocco in catena.
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await withTimeout(
      healthCheckService.runAllChecks(),
      MONITORING_TIMEOUT_MS,
      'health checks'
    );
    
    // Salvataggio non bloccante: la risposta non deve restare pending se il DB è lento.
    healthCheckService.saveHealthStatus(healthStatus).catch((saveError) => {
      console.warn('⚠️ saveHealthStatus fallita (non bloccante):', saveError.message);
    });
    
    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    console.error('❌ Errore health check:', error);
    res.status(500).json({
      success: false,
      error: 'Errore health check',
      data: {
        status: 'ERROR',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// GET /api/admin/monitoring/performance - Metriche performance correnti
router.get('/performance', async (req, res) => {
  try {
    const metrics = performanceMonitor.getCurrentMetrics();
    const health = performanceMonitor.getSystemHealth();
    const optimizerMetrics = performanceOptimizer.getCurrentMetrics();
    const recommendations = performanceOptimizer.getRecommendations();
    
    res.json({
      success: true,
      data: {
        metrics,
        health,
        optimizer: optimizerMetrics,
        recommendations
      }
    });
  } catch (error) {
    console.error('❌ Errore recupero metriche performance:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero metriche performance'
    });
  }
});

// GET /api/admin/monitoring/metrics/historical - Metriche storiche
router.get('/metrics/historical', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const metrics = await withTimeout(
      performanceMonitor.getHistoricalMetrics(hours),
      MONITORING_TIMEOUT_MS,
      'metriche storiche'
    );
    
    res.json({
      success: true,
      data: metrics,
      count: metrics.length
    });
  } catch (error) {
    console.error('❌ Errore recupero metriche storiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero metriche storiche'
    });
  }
});

// GET /api/admin/monitoring/health/history - Storico controlli salute
router.get('/health/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const history = await withTimeout(
      healthCheckService.getHealthHistory(hours),
      MONITORING_TIMEOUT_MS,
      'storico salute'
    );
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('❌ Errore recupero storico salute:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero storico salute'
    });
  }
});

// GET /api/admin/monitoring/alerts - Alert recenti
router.get('/alerts', async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'Gli alert sono disponibili solo con Axiom abilitato'
      });
    }
    
    const hours = parseInt(req.query.hours) || 24;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const endTime = new Date();
    
    // Ottieni log da Axiom
    const logs = await withTimeout(getCentralizedLogs({
      startTime,
      endTime,
      limit: 1000
    }), MONITORING_TIMEOUT_MS, 'alert da Axiom');
    
    // Filtra alert (WARN o ERROR con messaggi specifici)
    const alerts = logs
      .filter(log => {
        const message = (log.message || '').toLowerCase();
        const level = log.level || '';
        return (level === 'WARN' || level === 'ERROR') &&
               (message.includes('alert') || message.includes('warning') || message.includes('critical'));
      })
      .sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0))
      .slice(0, 100);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('❌ Errore recupero alert:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero alert',
      message: error.message
    });
  }
});

// GET /api/admin/monitoring/summary - Riepilogo sistema
router.get('/summary', async (req, res) => {
  try {
    // Metriche correnti
    const currentMetrics = performanceMonitor.getCurrentMetrics();
    const systemHealth = performanceMonitor.getSystemHealth();
    
    // Statistiche ultime 24h
    const [historicalResult, healthResult] = await Promise.allSettled([
      withTimeout(performanceMonitor.getHistoricalMetrics(24), MONITORING_TIMEOUT_MS, 'summary metrics 24h'),
      withTimeout(healthCheckService.getHealthHistory(24), MONITORING_TIMEOUT_MS, 'summary health history 24h')
    ]);
    const historicalMetrics = historicalResult.status === 'fulfilled' ? historicalResult.value : [];
    const healthHistory = healthResult.status === 'fulfilled' ? healthResult.value : [];
    
    // Calcola medie
    const avgCpu = historicalMetrics.length > 0
      ? historicalMetrics.reduce((sum, m) => sum + safeNumber(m.cpu_usage), 0) / historicalMetrics.length
      : 0;
    
    const avgMemory = historicalMetrics.length > 0
      ? historicalMetrics.reduce((sum, m) => sum + safeNumber(m.memory_usage), 0) / historicalMetrics.length
      : 0;
    
    const totalErrors = historicalMetrics.reduce((sum, m) => sum + safeNumber(m.error_count), 0);
    const totalWarnings = historicalMetrics.reduce((sum, m) => sum + safeNumber(m.warning_count), 0);
    
    // Status salute ultime 24h
    const healthStatuses = healthHistory.map(h => h.status);
    const healthyCount = healthStatuses.filter(s => s === 'HEALTHY').length;
    const degradedCount = healthStatuses.filter(s => s === 'DEGRADED').length;
    const unhealthyCount = healthStatuses.filter(s => s === 'UNHEALTHY').length;
    
    res.json({
      success: true,
      data: {
        current: {
          metrics: currentMetrics,
          health: systemHealth
        },
        last24h: {
          avgCpu: avgCpu.toFixed(2),
          avgMemory: Math.round(avgMemory / 1024 / 1024), // MB
          totalErrors,
          totalWarnings,
          healthStatus: {
            healthy: healthyCount,
            degraded: degradedCount,
            unhealthy: unhealthyCount,
            uptime: (healthStatuses.length > 0 ? ((healthyCount / healthStatuses.length) * 100) : 100).toFixed(2) + '%'
          }
        },
        trends: {
          cpuTrend: calculateTrend(historicalMetrics.map(m => m.cpu_usage)),
          memoryTrend: calculateTrend(historicalMetrics.map(m => m.memory_usage)),
          errorTrend: calculateTrend(historicalMetrics.map(m => m.error_count))
        }
      }
    });
  } catch (error) {
    console.error('❌ Errore riepilogo sistema:', error);
    res.status(500).json({
      success: false,
      error: 'Errore riepilogo sistema'
    });
  }
});

// POST /api/admin/monitoring/cleanup - Pulizia dati vecchi
router.post('/cleanup', auditMiddleware, async (req, res) => {
  try {
    const { retentionDays = 30 } = req.body;
    
    const performanceCleaned = await performanceMonitor.cleanupOldMetrics(retentionDays);
    const healthCleaned = await healthCheckService.cleanupHealthHistory(retentionDays);
    
    res.json({
      success: true,
      message: `Pulizia completata`,
      data: {
        performanceMetrics: performanceCleaned,
        healthChecks: healthCleaned,
        totalCleaned: performanceCleaned + healthCleaned
      }
    });
  } catch (error) {
    console.error('❌ Errore pulizia monitoraggio:', error);
    res.status(500).json({
      success: false,
      error: 'Errore pulizia monitoraggio'
    });
  }
});

// POST /api/admin/monitoring/start - Avvia monitoraggio
router.post('/start', auditMiddleware, async (req, res) => {
  try {
    const { intervalMs = 30000 } = req.body;
    
    performanceMonitor.start(intervalMs);
    
    res.json({
      success: true,
      message: `Monitoraggio avviato con intervallo ${intervalMs}ms`
    });
  } catch (error) {
    console.error('❌ Errore avvio monitoraggio:', error);
    res.status(500).json({
      success: false,
      error: 'Errore avvio monitoraggio'
    });
  }
});

// POST /api/admin/monitoring/stop - Ferma monitoraggio
router.post('/stop', auditMiddleware, async (req, res) => {
  try {
    performanceMonitor.stop();
    // Anche l'optimizer fa query al DB (es. utenti attivi, error-rate) e può continuare a bruciare compute.
    // Stopparlo insieme al monitoraggio evita che l'uso compute prosegua nonostante tu abbia fermato "Monitoring".
    performanceOptimizer.stop();
    
    res.json({
      success: true,
      message: 'Monitoraggio fermato'
    });
  } catch (error) {
    console.error('❌ Errore fermata monitoraggio:', error);
    res.status(500).json({
      success: false,
      error: 'Errore fermata monitoraggio'
    });
  }
});

// GET /api/admin/monitoring/status - Stato monitoraggio
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        isMonitoring: performanceMonitor.isMonitoring,
        currentMetrics: performanceMonitor.getCurrentMetrics(),
        systemHealth: performanceMonitor.getSystemHealth()
      }
    });
  } catch (error) {
    console.error('❌ Errore stato monitoraggio:', error);
    res.status(500).json({
      success: false,
      error: 'Errore stato monitoraggio'
    });
  }
});

// GET /api/admin/monitoring/database - Metriche database dettagliate
router.get('/database', async (req, res) => {
  try {
    const query = `
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    
    const connections = await pool.query(query);
    
    const sizeQuery = `
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        pg_database_size(current_database()) as database_size_bytes,
        pg_size_pretty(pg_total_relation_size('users')) as users_table_size,
        pg_total_relation_size('users') as users_table_size_bytes
    `;
    
    const size = await pool.query(sizeQuery);
    
    const slowQueriesQuery = `
      SELECT query, mean_exec_time, calls, total_exec_time
      FROM pg_stat_statements 
      WHERE mean_exec_time > 1000 
      ORDER BY mean_exec_time DESC 
      LIMIT 10
    `;
    
    let slowQueries = [];
    try {
      const slowQueriesResult = await pool.query(slowQueriesQuery);
      slowQueries = slowQueriesResult.rows;
    } catch (error) {
      // pg_stat_statements potrebbe non essere abilitato
    }
    
    res.json({
      success: true,
      data: {
        connections: connections.rows[0],
        size: size.rows[0],
        slowQueries: slowQueries
      }
    });
  } catch (error) {
    console.error('❌ Errore metriche database:', error);
    res.status(500).json({
      success: false,
      error: 'Errore metriche database'
    });
  }
});

// Funzione helper per calcolare trend
function calculateTrend(values) {
  if (!values || values.length < 2) return 'stable';
  const normalizedValues = values.map((v) => safeNumber(v));
  
  const firstHalf = normalizedValues.slice(0, Math.floor(normalizedValues.length / 2));
  const secondHalf = normalizedValues.slice(Math.floor(normalizedValues.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, val) => sum + (val || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + (val || 0), 0) / secondHalf.length;
  
  if (firstAvg === 0) {
    return secondAvg === 0 ? 'stable' : 'increasing';
  }
  const change = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (change > 10) return 'increasing';
  if (change < -10) return 'decreasing';
  return 'stable';
}

module.exports = router;
