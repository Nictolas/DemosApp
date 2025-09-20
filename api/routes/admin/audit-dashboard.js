const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { validateInput } = require('../../middleware/validation');
const AuditService = require('../../services/auditService');
const { pool } = require('../../middleware/auth');
const { formatAuditLogDate, formatSecurityViolationDate } = require('../../utils/dateUtils');

const router = express.Router();

// Middleware per tutti gli endpoint
router.use(verifyToken);
router.use(requireAdmin);

/**
 * GET /api/admin/audit-dashboard/stats
 * Ottiene statistiche generali degli audit logs
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Statistiche generali
    const statsQuery = `
      SELECT 
        COUNT(*) as total_actions,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_actions,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT action) as unique_actions,
        COUNT(DISTINCT resource) as unique_resources
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
    `;
    
    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];
    
    // Top azioni
    const topActionsQuery = `
      SELECT action, COUNT(*) as count
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const topActionsResult = await pool.query(topActionsQuery);
    
    // Top risorse
    const topResourcesQuery = `
      SELECT resource, COUNT(*) as count
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY resource
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const topResourcesResult = await pool.query(topResourcesQuery);
    
    // Top utenti
    const topUsersQuery = `
      SELECT user_id, COUNT(*) as count
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const topUsersResult = await pool.query(topUsersQuery);
    
    // Attività per giorno
    const dailyActivityQuery = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as actions,
        COUNT(CASE WHEN success = true THEN 1 END) as successful,
        COUNT(CASE WHEN success = false THEN 1 END) as failed
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;
    
    const dailyActivityResult = await pool.query(dailyActivityQuery);
    
    res.json({
      success: true,
      data: {
        period_days: parseInt(days),
        general_stats: stats,
        top_actions: topActionsResult.rows,
        top_resources: topResourcesResult.rows,
        top_users: topUsersResult.rows,
        daily_activity: dailyActivityResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche audit:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/audit-dashboard/logs
 * Ottiene i log di audit con filtri
 */
router.get('/logs', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      user_id, 
      action, 
      resource, 
      success, 
      from_date, 
      to_date,
      search 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        al.id, 
        al.user_id, 
        al.action, 
        al.resource, 
        al.resource_id, 
        al.details, 
        al.ip_address, 
        al.user_agent, 
        al.timestamp, 
        al.success, 
        al.error_message,
        COALESCE(u.nome || ' ' || u.cognome, 'Utente Sconosciuto') as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const values = [];
    let paramCount = 0;
    
    // Aggiungi filtri
    if (user_id) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      values.push(user_id);
    }
    
    if (action) {
      paramCount++;
      query += ` AND action = $${paramCount}`;
      values.push(action);
    }
    
    if (resource) {
      paramCount++;
      query += ` AND resource = $${paramCount}`;
      values.push(resource);
    }
    
    if (success !== undefined) {
      paramCount++;
      query += ` AND success = $${paramCount}`;
      values.push(success === 'true');
    }
    
    if (from_date) {
      paramCount++;
      query += ` AND timestamp >= $${paramCount}`;
      values.push(from_date);
    }
    
    if (to_date) {
      paramCount++;
      query += ` AND timestamp <= $${paramCount}`;
      values.push(to_date);
    }
    
    if (search) {
      paramCount++;
      query += ` AND (user_id ILIKE $${paramCount} OR action ILIKE $${paramCount} OR resource ILIKE $${paramCount} OR error_message ILIKE $${paramCount})`;
      values.push(`%${search}%`);
    }
    
    // Conteggio totale per paginazione
    const countQuery = query.replace(
      'SELECT \n        al.id, \n        al.user_id, \n        al.action, \n        al.resource, \n        al.resource_id, \n        al.details, \n        al.ip_address, \n        al.user_agent, \n        al.timestamp, \n        al.success, \n        al.error_message,\n        COALESCE(u.nome || \' \' || u.cognome, \'Utente Sconosciuto\') as user_name',
      'SELECT COUNT(*)'
    );
    
    const countResult = await pool.query(countQuery, values);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Query principale con paginazione
    query += ` ORDER BY timestamp DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(parseInt(limit), offset);
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: {
        logs: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero log audit:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/audit-dashboard/user/:userId
 * Ottiene i log di audit per un utente specifico
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    const logs = await AuditService.getUserAuditLogs(userId, {
      fromDate: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000),
      limit: 100
    });
    
    const stats = await AuditService.getUserAuditStats(userId);
    
    res.json({
      success: true,
      data: {
        user_id: userId,
        period_days: parseInt(days),
        logs,
        stats
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero log utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/audit-dashboard/suspicious
 * Rileva attività sospette
 */
router.get('/suspicious', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    // Trova utenti con molte azioni fallite
    const failedActionsQuery = `
      SELECT user_id, COUNT(*) as failed_count
      FROM audit_logs 
      WHERE success = false 
        AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY user_id
      HAVING COUNT(*) > 10
      ORDER BY failed_count DESC
    `;
    
    const failedActionsResult = await pool.query(failedActionsQuery);
    
    // Trova utenti con molte azioni in poco tempo
    const rapidActionsQuery = `
      SELECT user_id, COUNT(*) as action_count
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '1 hour'
      GROUP BY user_id
      HAVING COUNT(*) > 50
      ORDER BY action_count DESC
    `;
    
    const rapidActionsResult = await pool.query(rapidActionsQuery);
    
    // Trova accessi da IP sospetti (molti utenti diversi)
    const suspiciousIPsQuery = `
      SELECT ip_address, COUNT(DISTINCT user_id) as unique_users, COUNT(*) as total_actions
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
        AND ip_address IS NOT NULL
      GROUP BY ip_address
      HAVING COUNT(DISTINCT user_id) > 5
      ORDER BY unique_users DESC, total_actions DESC
    `;
    
    const suspiciousIPsResult = await pool.query(suspiciousIPsQuery);
    
    // Trova tentativi di accesso a dati di altri utenti
    const unauthorizedAccessQuery = `
      SELECT user_id, resource, resource_id, COUNT(*) as access_count
      FROM audit_logs 
      WHERE action = 'DATA_ACCESS' 
        AND resource = 'users'
        AND resource_id IS NOT NULL
        AND resource_id != user_id
        AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY user_id, resource, resource_id
      HAVING COUNT(*) > 3
      ORDER BY access_count DESC
    `;
    
    const unauthorizedAccessResult = await pool.query(unauthorizedAccessQuery);
    
    res.json({
      success: true,
      data: {
        period_days: parseInt(days),
        failed_actions: failedActionsResult.rows,
        rapid_actions: rapidActionsResult.rows,
        suspicious_ips: suspiciousIPsResult.rows,
        unauthorized_access: unauthorizedAccessResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel rilevamento attività sospette:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/audit-dashboard/violations
 * Ottiene violazioni di sicurezza recenti
 */
router.get('/violations', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    // Violazioni di sicurezza
    const violationsQuery = `
      SELECT 
        al.id,
        al.user_id,
        al.action,
        al.resource,
        al.details,
        al.timestamp,
        COALESCE(u.nome || ' ' || u.cognome, 'Utente Sconosciuto') as user_name,
        CASE 
          WHEN al.action LIKE '%FAILED%' OR al.action LIKE '%ERROR%' THEN 'Critical'
          WHEN al.action LIKE '%WARNING%' THEN 'High'
          ELSE 'Medium'
        END as severity
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.success = false 
        AND al.timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
        AND (al.action LIKE '%SECURITY%' OR al.action LIKE '%AUTH%' OR al.action LIKE '%PERMISSION%')
      ORDER BY al.timestamp DESC
      LIMIT 20
    `;
    
    const violationsResult = await pool.query(violationsQuery);
    
    // Conteggio violazioni per tipo
    const violationStatsQuery = `
      SELECT 
        COUNT(*) as total_violations,
        COUNT(CASE WHEN action LIKE '%FAILED%' OR action LIKE '%ERROR%' THEN 1 END) as critical_issues,
        COUNT(CASE WHEN action LIKE '%WARNING%' THEN 1 END) as high_issues,
        COUNT(CASE WHEN action LIKE '%SECURITY%' THEN 1 END) as security_violations
      FROM audit_logs 
      WHERE success = false 
        AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
    `;
    
    const statsResult = await pool.query(violationStatsQuery);
    
    res.json({
      success: true,
      data: {
        violations: violationsResult.rows.map(v => ({
          id: v.id,
          type: v.action,
          user: v.user_name,
          timestamp: formatSecurityViolationDate(v.timestamp),
          severity: v.severity
        })),
        stats: statsResult.rows[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero violazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/audit-dashboard/performance
 * Ottiene metriche di performance del sistema
 */
router.get('/performance', async (req, res) => {
  try {
    // Per ora restituiamo un array vuoto - in futuro si potrebbero integrare monitoring tools reali
    const performanceData = [];
    
    // Statistiche di logging
    const loggingStatsQuery = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_logs,
        COUNT(CASE WHEN success = false THEN 1 END) as error_logs,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '1 day' THEN 1 END) as today_logs
      FROM audit_logs
    `;
    
    const loggingResult = await pool.query(loggingStatsQuery);
    
    res.json({
      success: true,
      data: {
        performance: performanceData,
        logging: loggingResult.rows[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero performance:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/audit-dashboard/cleanup
 * Pulisce i log di audit vecchi
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { daysToKeep = 365 } = req.body;
    
    const deletedCount = await AuditService.cleanupOldLogs(parseInt(daysToKeep));
    
    res.json({
      success: true,
      message: `Puliti ${deletedCount} log di audit più vecchi di ${daysToKeep} giorni`,
      deleted_count: deletedCount
    });
    
  } catch (error) {
    console.error('❌ Errore nella pulizia log audit:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
