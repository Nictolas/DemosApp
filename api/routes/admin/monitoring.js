// File: api/routes/admin/monitoring.js
const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const performanceMonitor = require('../../services/performanceMonitor');
const performanceOptimizer = require('../../services/performanceOptimizer');
const healthCheckService = require('../../services/healthCheckService');
const { pool } = require('../../middleware/auth');
const { auditMiddleware } = require('../../middleware/auditMiddleware');
const { getCentralizedLogs } = require('../../utils/axiomQueryHelper');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execFileAsync = promisify(execFile);
const redisCache = require('../../services/redisCache');

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

function bytesToHuman(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = safeNumber(bytes);
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(2)} ${units[i]}`;
}

function collectNumericValuesByKey(input, targetKey, out = []) {
  if (!input || typeof input !== 'object') return out;
  if (Array.isArray(input)) {
    input.forEach((item) => collectNumericValuesByKey(item, targetKey, out));
    return out;
  }
  for (const [key, value] of Object.entries(input)) {
    if (key === targetKey) {
      const n = Number(value);
      if (Number.isFinite(n)) out.push(n);
    }
    if (value && typeof value === 'object') {
      collectNumericValuesByKey(value, targetKey, out);
    }
  }
  return out;
}

function collectNumericValuesByKeys(input, keys) {
  const out = [];
  for (const k of keys) collectNumericValuesByKey(input, k, out);
  return out;
}

function collectNeonMetricValues(payload, metricName, out = []) {
  if (!payload || typeof payload !== 'object') return out;
  if (Array.isArray(payload)) {
    payload.forEach((item) => collectNeonMetricValues(item, metricName, out));
    return out;
  }

  // Neon consumption API schema uses: { metric_name: string, value: number }
  if (payload.metric_name === metricName) {
    const n = Number(payload.value);
    if (Number.isFinite(n)) out.push(n);
  }

  for (const value of Object.values(payload)) {
    if (value && typeof value === 'object') collectNeonMetricValues(value, metricName, out);
  }
  return out;
}

function toRfc3339(value) {
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch (_e) {
    return null;
  }
}

function subtractDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d;
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

// GET /api/admin/monitoring/disk-breakdown - Top cartelle più pesanti su server app
router.get('/disk-breakdown', async (req, res) => {
  try {
    // Root di analisi limitato per sicurezza
    const defaultRoot = process.env.DISK_BREAKDOWN_ROOT || '/opt/render/project/src';
    const requestedTarget = String(req.query.target || defaultRoot);
    const maxEntries = Math.min(Math.max(parseInt(String(req.query.maxEntries || '15'), 10), 5), 50);
    const root = path.resolve(defaultRoot);
    const target = path.resolve(requestedTarget);

    if (!target.startsWith(root)) {
      return res.status(400).json({
        success: false,
        error: `target non consentito: ${target}`,
        message: `Usa un path sotto ${root}`
      });
    }

    let stdout;
    try {
      // du -k -d 1 <target> => dimensioni immediate figli + target totale
      const result = await withTimeout(
        execFileAsync('du', ['-k', '-d', '1', target]),
        MONITORING_TIMEOUT_MS,
        'disk breakdown'
      );
      stdout = result.stdout;
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Impossibile leggere uso disco sul server applicativo',
        message: error.message,
        hint: 'Comando du non disponibile o timeout'
      });
    }

    const rows = String(stdout || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\s+/);
        const sizeKb = safeNumber(parts[0]);
        const p = parts.slice(1).join(' ');
        return { path: p, sizeBytes: sizeKb * 1024 };
      })
      .filter((r) => r.path);

    const totalRow = rows.find((r) => path.resolve(r.path) === target);
    const totalBytes = totalRow ? totalRow.sizeBytes : rows.reduce((sum, r) => sum + r.sizeBytes, 0);

    const children = rows
      .filter((r) => path.resolve(r.path) !== target)
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, maxEntries)
      .map((r) => ({
        path: r.path,
        name: path.basename(r.path) || r.path,
        sizeBytes: r.sizeBytes,
        sizeHuman: bytesToHuman(r.sizeBytes),
        percentOfTarget: totalBytes > 0 ? Number(((r.sizeBytes / totalBytes) * 100).toFixed(2)) : 0
      }));

    res.json({
      success: true,
      data: {
        source: 'render-app-server',
        sourceLabel: 'Filesystem server applicativo (Render) - NON Neon',
        root,
        target,
        totalBytes,
        totalHuman: bytesToHuman(totalBytes),
        entries: children
      }
    });
  } catch (error) {
    console.error('❌ Errore disk breakdown:', error);
    res.status(500).json({
      success: false,
      error: 'Errore disk breakdown',
      message: error.message
    });
  }
});

// GET /api/admin/monitoring/platform-usage - Parametri piattaforme (live dove possibile)
router.get('/platform-usage', async (req, res) => {
  try {
    const generatedAt = new Date().toISOString();
    const diagnostics = {
      neon: []
    };

    // Limiti/budget Neon da env (per progress % reali)
    const neonComputeUnitSecondsLimit30d = process.env.NEON_COMPUTE_UNIT_SECONDS_LIMIT_30D
      ? safeNumber(process.env.NEON_COMPUTE_UNIT_SECONDS_LIMIT_30D)
      : null;
    const neonDbStorageBudgetBytes = process.env.NEON_DB_STORAGE_BUDGET_BYTES
      ? safeNumber(process.env.NEON_DB_STORAGE_BUDGET_BYTES)
      : null;
    const neonDataTransferBudgetBytes = process.env.NEON_DATA_TRANSFER_BUDGET_BYTES
      ? safeNumber(process.env.NEON_DATA_TRANSFER_BUDGET_BYTES)
      : null;
    const neonActiveConnectionsLimit = process.env.NEON_ACTIVE_CONNECTIONS_LIMIT
      ? safeNumber(process.env.NEON_ACTIVE_CONNECTIONS_LIMIT)
      : null;

    // Render: usa check disco reale (df) con fallback stimato
    const diskCheck = await withTimeout(
      healthCheckService.checkDiskSpace(),
      MONITORING_TIMEOUT_MS,
      'platform usage disk check'
    );

    // Neon: dimensione DB + connessioni attive (live)
    let neonDbSizeBytes = null;
    let neonActiveConnections = null;
    let neonProjectCount = null;
    let neonComputeUnitSeconds30d = null;
    let neonDataTransferBytes30d = null;
    try {
      const neonResult = await withTimeout(
        pool.query(`
          SELECT
            pg_database_size(current_database())::bigint as database_size_bytes,
            (
              SELECT count(*)
              FROM pg_stat_activity
              WHERE datname = current_database() AND state = 'active'
            )::int as active_connections
        `),
        MONITORING_TIMEOUT_MS,
        'platform usage neon metrics'
      );
      neonDbSizeBytes = safeNumber(neonResult?.rows?.[0]?.database_size_bytes);
      neonActiveConnections = safeNumber(neonResult?.rows?.[0]?.active_connections);
    } catch (_error) {
      // Non bloccare la risposta se una metrica Neon non è disponibile
    }

    // Neon account-level API: project count + consumo compute (se disponibile per piano/API key)
    if (process.env.NEON_API_KEY) {
      const neonHeaders = {
        Authorization: `Bearer ${process.env.NEON_API_KEY}`,
        Accept: 'application/json'
      };
      const configuredProjectId = process.env.NEON_PROJECT_ID || null;
      const configuredOrgId = process.env.NEON_ORG_ID || null;
      if (configuredProjectId) {
        // Con chiave project-scoped il list potrebbe non funzionare: almeno sappiamo che 1 progetto è configurato.
        neonProjectCount = 1;
      }

      // Numero progetti accessibili
      try {
        const projectsUrl = configuredOrgId
          ? `https://console.neon.tech/api/v2/projects?org_id=${encodeURIComponent(configuredOrgId)}`
          : 'https://console.neon.tech/api/v2/projects';
        const projectsResp = await withTimeout(
          fetch(projectsUrl, { headers: neonHeaders }),
          MONITORING_TIMEOUT_MS,
          'neon list projects'
        );
        if (projectsResp.ok) {
          const projectsJson = await projectsResp.json();
          const projectsArray = Array.isArray(projectsJson?.projects) ? projectsJson.projects : [];
          neonProjectCount = projectsArray.length;
        } else {
          diagnostics.neon.push(`list projects HTTP ${projectsResp.status}`);
        }
      } catch (_error) {
        diagnostics.neon.push('list projects non disponibile con questa chiave/scope');
      }

      // Consumo compute: somma compute_unit_seconds dagli ultimi risultati disponibili
      try {
        if (!configuredOrgId) {
          diagnostics.neon.push('NEON_ORG_ID non configurata: richiesta per consumption history (evita HTTP 400)');
          throw new Error('missing NEON_ORG_ID for consumption history');
        }

        const now = new Date();
        const from = toRfc3339(subtractDays(now, 30));
        const to = toRfc3339(now);
        const granularity = 'daily';

        const base = 'https://console.neon.tech/api/v2/consumption_history/v2/projects';
        const commonParams = new URLSearchParams({
          org_id: configuredOrgId,
          from,
          to,
          granularity,
          // Chiediamo solo le metriche che ci interessano
          metrics: [
            'compute_unit_seconds',
            'public_network_transfer_bytes',
            'private_network_transfer_bytes'
          ].join(',')
        });

        // NOTE: secondo docs Neon, il filtro e' project_ids (array / csv), non project_id.
        const candidateUrls = [
          configuredProjectId ? `${base}?${new URLSearchParams({ ...Object.fromEntries(commonParams), project_ids: configuredProjectId }).toString()}` : null,
          `${base}?${commonParams.toString()}`
        ].filter(Boolean);

        for (const url of candidateUrls) {
          const consumptionResp = await withTimeout(
            fetch(url, { headers: neonHeaders }),
            MONITORING_TIMEOUT_MS,
            'neon consumption history'
          );
          if (!consumptionResp.ok) {
            diagnostics.neon.push(`consumption history HTTP ${consumptionResp.status} (${url})`);
            continue;
          }
          const consumptionJson = await consumptionResp.json();
          const cuSeconds = collectNeonMetricValues(consumptionJson, 'compute_unit_seconds');
          const publicTransfer = collectNeonMetricValues(consumptionJson, 'public_network_transfer_bytes');
          const privateTransfer = collectNeonMetricValues(consumptionJson, 'private_network_transfer_bytes');
          const dataTransferBytes = [...publicTransfer, ...privateTransfer];

          if (cuSeconds.length > 0 && neonComputeUnitSeconds30d === null) {
            neonComputeUnitSeconds30d = cuSeconds.reduce((sum, v) => sum + v, 0);
          }
          if (dataTransferBytes.length > 0 && neonDataTransferBytes30d === null) {
            neonDataTransferBytes30d = dataTransferBytes.reduce((sum, v) => sum + v, 0);
          }

          if (cuSeconds.length === 0 && neonComputeUnitSeconds30d === null) {
            diagnostics.neon.push('consumption history: campo compute_unit_seconds non trovato nella risposta');
          }
          if (dataTransferBytes.length === 0 && neonDataTransferBytes30d === null) {
            diagnostics.neon.push('consumption history: campi public/private_network_transfer_bytes non trovati nella risposta');
          }

          // Se abbiamo già trovato almeno un valore, non continuiamo a ciclare candidateUrls.
          if (neonComputeUnitSeconds30d !== null || neonDataTransferBytes30d !== null) break;
        }
      } catch (_error) {
        if (!diagnostics.neon.some((m) => String(m).includes('consumption history'))) {
          diagnostics.neon.push('consumption history non disponibile con questa chiave/scope');
        }
      }
    } else {
      diagnostics.neon.push('NEON_API_KEY non configurata');
    }

    // Axiom: stato integrazione live da env + dati minimi diagnostici
    const axiomEnabled = process.env.AXIOM_ENABLED === 'true';
    const hasAxiomToken = Boolean(process.env.AXIOM_API_TOKEN);
    const hasAxiomOrg = Boolean(process.env.AXIOM_ORG_ID);
    const firebaseConfigured = Boolean(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    );
    const resendConfigured = Boolean(process.env.RESEND_API_KEY);
    const cieConfigured = Boolean(
      (process.env.OIDC_ISSUER_URL || process.env.CIE_ISSUER_URL) &&
      (process.env.OIDC_CLIENT_ID || process.env.CIE_CLIENT_ID) &&
      (process.env.OIDC_CLIENT_SECRET || process.env.CIE_CLIENT_SECRET) &&
      (process.env.OIDC_REDIRECT_URI || process.env.CIE_REDIRECT_URI)
    );
    const playAdminConfigured = Boolean(
      process.env.PLAY_REVIEW_ADMIN_EMAIL && process.env.PLAY_REVIEW_ADMIN_PASSWORD
    );

    // Cloudflare: presenza CF-Ray sulla richiesta corrente = traffico passato dal proxy orange-cloud
    const cfRayHeader = req.headers['cf-ray'] || req.headers['CF-Ray'];
    const requestViaCloudflareEdge = Boolean(cfRayHeader);

    const upstashEnvConfigured = Boolean(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    );
    let upstashPingOk = null;
    if (upstashEnvConfigured) {
      try {
        const pingResult = await withTimeout(
          redisCache.ping(),
          Math.min(MONITORING_TIMEOUT_MS, 5000),
          'upstash redis ping'
        );
        upstashPingOk = pingResult?.ok === true;
      } catch (_e) {
        upstashPingOk = false;
      }
    }

    res.json({
      success: true,
      data: {
        generatedAt,
        sources: {
          neon: 'PostgreSQL runtime queries',
          render: 'Server filesystem check (df)',
          axiom: 'Runtime environment configuration',
          firebase: 'Runtime environment configuration',
          resend: 'Runtime environment configuration',
          cie: 'Runtime environment configuration',
          play: 'Runtime environment configuration',
          upstash: 'Runtime environment + REST PING',
          cloudflare: 'HTTP header CF-Ray sulla richiesta a platform-usage'
        },
        platforms: {
          neon: {
            updatedAt: generatedAt,
            metrics: {
              databaseSizeBytes: neonDbSizeBytes,
              activeConnections: neonActiveConnections,
              projectCount: neonProjectCount,
              computeUnitSeconds30d: neonComputeUnitSeconds30d,
              dataTransferBytes30d: neonDataTransferBytes30d
            },
            limits: {
              computeUnitSecondsLimit30d: neonComputeUnitSecondsLimit30d,
              databaseStorageBudgetBytes: neonDbStorageBudgetBytes,
              dataTransferBudgetBytes: neonDataTransferBudgetBytes,
              activeConnectionsLimit: neonActiveConnectionsLimit
            }
          },
          render: {
            updatedAt: diskCheck?.timestamp || generatedAt,
            metrics: {
              diskUsedBytes: safeNumber(diskCheck?.usedBytes),
              diskTotalBytes: safeNumber(diskCheck?.totalBytes),
              diskPercent: safeNumber(diskCheck?.diskPercent),
              diskIsEstimated: !!diskCheck?.isEstimated
            }
          },
          axiom: {
            updatedAt: generatedAt,
            metrics: {
              integrationEnabled: axiomEnabled,
              hasToken: hasAxiomToken,
              hasOrg: hasAxiomOrg
            }
          },
          firebase: {
            updatedAt: generatedAt,
            metrics: {
              configured: firebaseConfigured
            }
          },
          resend: {
            updatedAt: generatedAt,
            metrics: {
              configured: resendConfigured
            }
          },
          cie: {
            updatedAt: generatedAt,
            metrics: {
              configured: cieConfigured
            }
          },
          play: {
            updatedAt: generatedAt,
            metrics: {
              configured: playAdminConfigured
            }
          },
          upstash: {
            updatedAt: generatedAt,
            metrics: {
              envConfigured: upstashEnvConfigured,
              pingOk: upstashPingOk
            }
          },
          cloudflare: {
            updatedAt: generatedAt,
            metrics: {
              edgeRequestDetected: requestViaCloudflareEdge
            }
          }
        },
        diagnostics
      }
    });
  } catch (error) {
    console.error('❌ Errore recupero platform usage:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero parametri piattaforme',
      message: error.message
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
