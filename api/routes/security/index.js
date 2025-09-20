const express = require('express');
const { Pool } = require('pg');
const { verifyToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

/**
 * 📊 STATISTICHE SICUREZZA
 * GET /api/security/stats
 */
router.get('/stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // Calcola timestamp in base al range
    let timeCondition = '';
    switch (timeRange) {
      case '1h':
        timeCondition = "created_at >= NOW() - INTERVAL '1 hour'";
        break;
      case '24h':
        timeCondition = "created_at >= NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        timeCondition = "created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "created_at >= NOW() - INTERVAL '30 days'";
        break;
      default:
        timeCondition = "created_at >= NOW() - INTERVAL '24 hours'";
    }

    // Query per statistiche
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM security_events WHERE ${timeCondition}) as total_events,
        (SELECT COUNT(*) FROM security_alerts WHERE severity = 'critical' AND resolved = false) as critical_alerts,
        (SELECT COUNT(*) FROM suspicious_ips WHERE is_blocked = true) as blocked_ips,
        (SELECT COUNT(*) FROM security_events WHERE type = 'failed_login' AND ${timeCondition}) as failed_logins,
        (SELECT COUNT(*) FROM security_events WHERE type = 'suspicious_request' AND ${timeCondition}) as suspicious_requests,
        (SELECT COUNT(*) FROM security_events WHERE type = 'admin_access' AND ${timeCondition}) as admin_accesses
    `;

    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];

    res.json({
      success: true,
      stats: {
        totalEvents: parseInt(stats.total_events),
        criticalAlerts: parseInt(stats.critical_alerts),
        blockedIPs: parseInt(stats.blocked_ips),
        failedLogins: parseInt(stats.failed_logins),
        suspiciousRequests: parseInt(stats.suspicious_requests),
        adminAccesses: parseInt(stats.admin_accesses)
      }
    });

  } catch (error) {
    console.error('❌ Errore recupero statistiche sicurezza:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le statistiche di sicurezza'
    });
  }
});

/**
 * 📋 EVENTI DI SICUREZZA
 * GET /api/security/events
 */
router.get('/events', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { 
      timeRange = '24h', 
      severity, 
      type, 
      page = 1, 
      limit = 50 
    } = req.query;

    // Calcola timestamp in base al range
    let timeCondition = '';
    switch (timeRange) {
      case '1h':
        timeCondition = "created_at >= NOW() - INTERVAL '1 hour'";
        break;
      case '24h':
        timeCondition = "created_at >= NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        timeCondition = "created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "created_at >= NOW() - INTERVAL '30 days'";
        break;
      default:
        timeCondition = "created_at >= NOW() - INTERVAL '24 hours'";
    }

    // Costruisci query con filtri
    let whereConditions = [timeCondition];
    let queryParams = [];
    let paramCount = 0;

    if (severity) {
      paramCount++;
      whereConditions.push(`severity = $${paramCount}`);
      queryParams.push(severity);
    }

    if (type) {
      paramCount++;
      whereConditions.push(`type = $${paramCount}`);
      queryParams.push(type);
    }

    const whereClause = whereConditions.join(' AND ');
    const offset = (page - 1) * limit;

    const eventsQuery = `
      SELECT id, type, ip_address, user_id, user_email, user_agent,
             severity, details, created_at
      FROM security_events 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(parseInt(limit), offset);

    const eventsResult = await pool.query(eventsQuery, queryParams);

    // Conta totale per paginazione
    const countQuery = `
      SELECT COUNT(*) as total
      FROM security_events 
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      events: eventsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Errore recupero eventi sicurezza:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare gli eventi di sicurezza'
    });
  }
});

/**
 * 🚨 ALERT DI SICUREZZA
 * GET /api/security/alerts
 */
router.get('/alerts', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { 
      resolved = 'false', 
      severity, 
      page = 1, 
      limit = 50 
    } = req.query;

    // Costruisci query con filtri
    let whereConditions = [`resolved = ${resolved === 'true'}`];
    let queryParams = [];
    let paramCount = 0;

    if (severity) {
      paramCount++;
      whereConditions.push(`severity = $${paramCount}`);
      queryParams.push(severity);
    }

    const whereClause = whereConditions.join(' AND ');
    const offset = (page - 1) * limit;

    const alertsQuery = `
      SELECT id, type, data, severity, resolved, resolved_at, 
             resolved_by, created_at
      FROM security_alerts 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(parseInt(limit), offset);

    const alertsResult = await pool.query(alertsQuery, queryParams);

    // Conta totale per paginazione
    const countQuery = `
      SELECT COUNT(*) as total
      FROM security_alerts 
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      alerts: alertsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Errore recupero alert sicurezza:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare gli alert di sicurezza'
    });
  }
});

/**
 * 🔒 RISOLVI ALERT
 * POST /api/security/alerts/:id/resolve
 */
router.post('/alerts/:id/resolve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved_by } = req.body;

    const resolveQuery = `
      UPDATE security_alerts 
      SET resolved = true, resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(resolveQuery, [resolved_by, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert non trovato'
      });
    }

    res.json({
      success: true,
      message: 'Alert risolto con successo',
      alert: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Errore risoluzione alert:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile risolvere l\'alert'
    });
  }
});

/**
 * 🚫 BLOCCA IP
 * POST /api/security/block-ip
 */
router.post('/block-ip', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { ip_address, duration_hours = 24, reason } = req.body;

    if (!ip_address) {
      return res.status(400).json({
        success: false,
        error: 'Indirizzo IP richiesto'
      });
    }

    const blockUntil = new Date();
    blockUntil.setHours(blockUntil.getHours() + duration_hours);

    const blockQuery = `
      INSERT INTO suspicious_ips (ip_address, is_blocked, blocked_until, details)
      VALUES ($1, true, $2, $3)
      ON CONFLICT (ip_address) 
      DO UPDATE SET 
        is_blocked = true, 
        blocked_until = $2, 
        details = $3,
        last_seen = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(blockQuery, [
      ip_address, 
      blockUntil, 
      JSON.stringify({ reason, blocked_by: req.userId })
    ]);

    res.json({
      success: true,
      message: 'IP bloccato con successo',
      ip: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Errore blocco IP:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile bloccare l\'IP'
    });
  }
});

/**
 * 🔓 SBLOCCA IP
 * POST /api/security/unblock-ip
 */
router.post('/unblock-ip', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { ip_address } = req.body;

    if (!ip_address) {
      return res.status(400).json({
        success: false,
        error: 'Indirizzo IP richiesto'
      });
    }

    const unblockQuery = `
      UPDATE suspicious_ips 
      SET is_blocked = false, blocked_until = NULL
      WHERE ip_address = $1
      RETURNING *
    `;

    const result = await pool.query(unblockQuery, [ip_address]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'IP non trovato'
      });
    }

    res.json({
      success: true,
      message: 'IP sbloccato con successo',
      ip: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Errore sblocco IP:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile sbloccare l\'IP'
    });
  }
});

module.exports = router;
