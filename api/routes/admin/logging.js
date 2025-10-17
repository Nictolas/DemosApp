// File: api/routes/admin/logging.js
const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const logger = require('../../services/centralizedLogger');
const { pool } = require('../../middleware/auth');
const { auditMiddleware } = require('../../middleware/auditMiddleware');

const router = express.Router();
router.use(verifyToken, requireAdmin);

// Funzioni helper per la ricerca
const searchByIP = async (ipAddress, hours = 24, limit = 100) => {
  try {
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
    const limit = parseInt(req.query.limit) || 50;
    const level = req.query.level;
    const hours = parseInt(req.query.hours) || 24;
    
    let query = `
      SELECT * FROM centralized_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '${hours} hours'
    `;
    const params = [];
    
    if (level) {
      query += ' AND level = $1';
      params.push(level);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore recupero log recenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero log recenti'
    });
  }
});

// GET /api/admin/logging/search - Ricerca log
router.get('/search', auditMiddleware, async (req, res) => {
  try {
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
    
    let query = 'SELECT * FROM centralized_logs_decompressed WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (level) {
      paramCount++;
      query += ` AND level = $${paramCount}`;
      params.push(level);
    }
    
    if (message) {
      paramCount++;
      query += ` AND message ILIKE $${paramCount}`;
      params.push(`%${message}%`);
    }
    
    if (userId) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(userId);
    }
    
    if (ipAddress) {
      paramCount++;
      query += ` AND ip_address = $${paramCount}`;
      params.push(ipAddress);
    }
    
    if (endpoint) {
      paramCount++;
      query += ` AND endpoint ILIKE $${paramCount}`;
      params.push(`%${endpoint}%`);
    }
    
    if (startDate) {
      paramCount++;
      query += ` AND timestamp >= $${paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND timestamp <= $${paramCount}`;
      params.push(endDate);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('❌ Errore ricerca log:', error);
    res.status(500).json({
      success: false,
      error: 'Errore ricerca log'
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

// POST /api/admin/logging/cleanup - Pulizia log vecchi
router.post('/cleanup', auditMiddleware, async (req, res) => {
  try {
    const { retentionDays = 30 } = req.body;
    
    const deletedCount = await logger.cleanupOldLogs(retentionDays);
    
    res.json({
      success: true,
      message: `Puliti ${deletedCount} log vecchi`,
      deletedCount
    });
  } catch (error) {
    console.error('❌ Errore pulizia log:', error);
    res.status(500).json({
      success: false,
      error: 'Errore pulizia log'
    });
  }
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
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 100;
    
    const query = `
      SELECT * FROM centralized_logs_decompressed 
      WHERE level = 'ERROR' 
      AND timestamp >= NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('❌ Errore recupero errori:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero errori'
    });
  }
});

// GET /api/admin/logging/performance - Log di performance
router.get('/performance', auditMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 100;
    
    const query = `
      SELECT * FROM centralized_logs_decompressed 
      WHERE meta_data->>'performanceEvent' = 'true'
      AND timestamp >= NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('❌ Errore recupero performance log:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero performance log'
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
