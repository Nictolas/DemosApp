// File: api/routes/admin/logging.js
const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const logger = require('../../services/centralizedLogger');
const { pool } = require('../../middleware/auth');
const { auditMiddleware } = require('../../middleware/auditMiddleware');
const { getCentralizedLogs, queryAxiom } = require('../../utils/axiomQueryHelper');

const router = express.Router();
router.use(verifyToken, requireAdmin);

// Funzioni helper per la ricerca (ora leggono da Axiom)
const searchByIP = async (ipAddress, hours = 24, limit = 100) => {
  try {
    // Se Axiom è abilitato, leggi da Axiom
    if (process.env.AXIOM_ENABLED === 'true') {
      const { getCentralizedLogs } = require('../../utils/axiomQueryHelper');
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const endTime = new Date();
      
      const logs = await getCentralizedLogs({
        ipAddress: ipAddress,
        startTime,
        endTime,
        limit: limit * 2
      });
      
      return logs
        .filter(log => log.ip_address === ipAddress)
        .sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0))
        .slice(0, limit);
    }
    
    // Fallback a PostgreSQL
    const query = `
      SELECT * FROM find_logs_by_ip($1)
      WHERE log_timestamp >= NOW() - INTERVAL '${hours} hours'
      ORDER BY log_timestamp DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [ipAddress, limit]);
    return result.rows;
  } catch (error) {
    console.error('❌ Errore ricerca per IP:', error);
    return [];
  }
};

const searchByUserAgent = async (userAgent, hours = 24, limit = 100) => {
  try {
    // NOTA: user_agent non è più disponibile su Axiom (rimosso per GDPR)
    // Questa funzione restituisce un array vuoto
    if (process.env.AXIOM_ENABLED === 'true') {
      return [];
    }
    
    // Fallback a PostgreSQL (solo se Axiom non è abilitato)
    const query = `
      SELECT * FROM find_logs_by_user_agent($1)
      WHERE log_timestamp >= NOW() - INTERVAL '${hours} hours'
      ORDER BY log_timestamp DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [userAgent, limit]);
    return result.rows;
  } catch (error) {
    console.error('❌ Errore ricerca per User Agent:', error);
    return [];
  }
};

const searchByEndpoint = async (endpoint, hours = 24, limit = 100) => {
  try {
    // Se Axiom è abilitato, leggi da Axiom
    if (process.env.AXIOM_ENABLED === 'true') {
      const { getCentralizedLogs } = require('../../utils/axiomQueryHelper');
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const endTime = new Date();
      
      const logs = await getCentralizedLogs({
        endpoint: endpoint,
        startTime,
        endTime,
        limit: limit * 2
      });
      
      return logs
        .filter(log => log.endpoint && log.endpoint.includes(endpoint))
        .sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0))
        .slice(0, limit);
    }
    
    // Fallback a PostgreSQL
    const query = `
      SELECT * FROM find_logs_by_endpoint($1)
      WHERE log_timestamp >= NOW() - INTERVAL '${hours} hours'
      ORDER BY log_timestamp DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [endpoint, limit]);
    return result.rows;
  } catch (error) {
    console.error('❌ Errore ricerca per Endpoint:', error);
    return [];
  }
};

// GET /api/admin/logging/stats - Statistiche log
router.get('/stats', auditMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await logger.getLogStats(days);
    
    // Calcola statistiche aggregate
    const totalLogs = stats.reduce((sum, row) => sum + parseInt(row.count), 0);
    const levelCounts = stats.reduce((acc, row) => {
      acc[row.level] = (acc[row.level] || 0) + parseInt(row.count);
      return acc;
    }, {});
    
    // Statistiche per giorno
    const dailyStats = stats.reduce((acc, row) => {
      if (!acc[row.date]) {
        acc[row.date] = {};
      }
      acc[row.date][row.level] = parseInt(row.count);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        period: `${days} giorni`,
        totalLogs,
        levelCounts,
        dailyStats,
        stats
      }
    });
  } catch (error) {
    console.error('❌ Errore recupero statistiche log:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero statistiche log'
    });
  }
});

// GET /api/admin/logging/recent - Log recenti
router.get('/recent', auditMiddleware, async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'I log sono disponibili solo con Axiom abilitato'
      });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const level = req.query.level;
    const hours = parseInt(req.query.hours) || 24;
    
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const endTime = new Date();
    
    // Ottieni log da Axiom
    const logs = await getCentralizedLogs({
      level: level || null,
      startTime,
      endTime,
      limit: limit * 2 // Prendi più record per filtrare level lato server se necessario
    });
    
    // Filtra per level se specificato (se non già filtrato)
    let filteredLogs = logs;
    if (level) {
      filteredLogs = logs.filter(log => log.level === level);
    }
    
    // Limita e ordina
    const result = filteredLogs
      .sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0))
      .slice(0, limit);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Errore recupero log recenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero log recenti',
      message: error.message
    });
  }
});

// GET /api/admin/logging/search - Ricerca log
router.get('/search', auditMiddleware, async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'La ricerca log è disponibile solo con Axiom abilitato'
      });
    }
    
    const {
      level,
      message,
      userId,
      ipAddress,
      endpoint,
      startDate,
      endDate,
      limit = 100
    } = req.query;
    
    const startTime = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endTime = endDate ? new Date(endDate) : new Date();
    
    // Ottieni log da Axiom
    const logs = await getCentralizedLogs({
      userId: userId || null,
      level: level || null,
      endpoint: endpoint || null,
      startTime,
      endTime,
      limit: parseInt(limit) * 10 // Prendi più record per filtrare lato server
    });
    
    // Applica filtri lato server
    let filteredLogs = logs;
    
    if (ipAddress) {
      filteredLogs = filteredLogs.filter(log => log.ip_address === ipAddress);
    }
    
    if (message) {
      const messageLower = message.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        (log.message && log.message.toLowerCase().includes(messageLower))
      );
    }
    
    // Ordina e limita
    const result = filteredLogs
      .sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0))
      .slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error('❌ Errore ricerca log:', error);
    res.status(500).json({
      success: false,
      error: 'Errore ricerca log',
      message: error.message
    });
  }
});

// GET /api/admin/logging/export - Esporta log
router.get('/export', auditMiddleware, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      level,
      format = 'json'
    } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate e endDate sono richiesti'
      });
    }
    
    const logs = await logger.exportLogs(startDate, endDate, level);
    
    if (format === 'csv') {
      // Converti in CSV
      const csvHeader = 'timestamp,level,message,user_id,ip_address,endpoint\n';
      const csvRows = logs.map(log => 
        `"${log.timestamp}","${log.level}","${log.message}","${log.user_id || ''}","${log.ip_address || ''}","${log.endpoint || ''}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="logs-${startDate}-${endDate}.csv"`);
      res.send(csvHeader + csvRows);
    } else {
      // JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="logs-${startDate}-${endDate}.json"`);
      res.json({
        success: true,
        data: logs,
        count: logs.length,
        period: { startDate, endDate }
      });
    }
  } catch (error) {
    console.error('❌ Errore esportazione log:', error);
    res.status(500).json({
      success: false,
      error: 'Errore esportazione log'
    });
  }
});

// POST /api/admin/logging/cleanup - RP-10 not approved.
router.post('/cleanup', auditMiddleware, async (_req, res) => {
  // Axiom enabled is not evidence of a provider deletion or approved TTL.
  return res.status(409).json({
    success: false,
    error: 'LOG_RETENTION_POLICY_NOT_APPROVED'
  });
});

// GET /api/admin/logging/levels - Livelli di log disponibili
router.get('/levels', auditMiddleware, async (req, res) => {
  try {
    const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
    
    res.json({
      success: true,
      data: levels
    });
  } catch (error) {
    console.error('❌ Errore recupero livelli log:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero livelli log'
    });
  }
});

// GET /api/admin/logging/health - Salute sistema di logging
router.get('/health', auditMiddleware, async (req, res) => {
  try {
    // Test connessione database
    const dbTest = await pool.query('SELECT 1');
    const dbHealthy = dbTest.rows.length > 0;
    
    // Test scrittura log
    const testMessage = `Health check - ${new Date().toISOString()}`;
    await logger.info(testMessage, { healthCheck: true });
    
    // Statistiche recenti
    const recentStats = await logger.getLogStats(1);
    const totalRecent = recentStats.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    res.json({
      success: true,
      data: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        logging: 'operational',
        recentLogs: totalRecent,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Errore health check logging:', error);
    res.status(500).json({
      success: false,
      error: 'Errore health check logging',
      data: {
        database: 'unhealthy',
        logging: 'error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// GET /api/admin/logging/errors - Solo errori recenti
router.get('/errors', auditMiddleware, async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'Gli errori sono disponibili solo con Axiom abilitato'
      });
    }
    
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 100;
    
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const endTime = new Date();
    
    // Ottieni log ERROR da Axiom
    const logs = await getCentralizedLogs({
      level: 'ERROR',
      startTime,
      endTime,
      limit: limit * 2 // Prendi più record per filtrare lato server
    });
    
    // Ordina e limita
    const result = logs
      .filter(log => log.level === 'ERROR')
      .sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0))
      .slice(0, limit);
    
    res.json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error('❌ Errore recupero errori:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero errori',
      message: error.message
    });
  }
});

// GET /api/admin/logging/performance - Log di performance
router.get('/performance', auditMiddleware, async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'I log di performance sono disponibili solo con Axiom abilitato'
      });
    }
    
    // NOTA: I log di performance non vengono più inviati ad Axiom (non GDPR-required)
    // Questo endpoint restituisce un array vuoto
    res.json({
      success: true,
      data: [],
      count: 0,
      message: 'I log di performance non sono più tracciati (non GDPR-required)'
    });
  } catch (error) {
    console.error('❌ Errore recupero performance log:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero performance log',
      message: error.message
    });
  }
});

// GET /api/admin/logging/by-ip/:ipAddress - Ricerca log per IP specifico
router.get('/by-ip/:ipAddress', auditMiddleware, async (req, res) => {
  try {
    const { ipAddress } = req.params;
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 100;
    
    const logs = await searchByIP(ipAddress, hours, limit);
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
      searchParams: {
        ipAddress,
        hours,
        limit
      }
    });
  } catch (error) {
    console.error('❌ Errore ricerca log per IP:', error);
    res.status(500).json({
      success: false,
      error: 'Errore ricerca log per IP'
    });
  }
});

// GET /api/admin/logging/by-user-agent - Ricerca log per User Agent
router.get('/by-user-agent', auditMiddleware, async (req, res) => {
  try {
    const { userAgent, hours = 24, limit = 100 } = req.query;
    
    if (!userAgent) {
      return res.status(400).json({
        success: false,
        error: 'userAgent è richiesto'
      });
    }
    
    const logs = await searchByUserAgent(userAgent, parseInt(hours), parseInt(limit));
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
      searchParams: {
        userAgent,
        hours: parseInt(hours),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ Errore ricerca log per User Agent:', error);
    res.status(500).json({
      success: false,
      error: 'Errore ricerca log per User Agent'
    });
  }
});

// GET /api/admin/logging/by-endpoint - Ricerca log per Endpoint
router.get('/by-endpoint', auditMiddleware, async (req, res) => {
  try {
    const { endpoint, hours = 24, limit = 100 } = req.query;
    
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'endpoint è richiesto'
      });
    }
    
    const logs = await searchByEndpoint(endpoint, parseInt(hours), parseInt(limit));
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
      searchParams: {
        endpoint,
        hours: parseInt(hours),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ Errore ricerca log per Endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Errore ricerca log per Endpoint'
    });
  }
});

module.exports = router;
