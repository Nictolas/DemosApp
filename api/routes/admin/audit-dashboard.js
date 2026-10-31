const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { validateInput } = require('../../middleware/validation');
const AuditService = require('../../services/auditService');
const { pool } = require('../../middleware/auth');
const { formatAuditLogDate, formatSecurityViolationDate } = require('../../utils/dateUtils');
const { getAuditLogs, queryAxiom } = require('../../utils/axiomQueryHelper');

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
    
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'Le statistiche audit sono disponibili solo con Axiom abilitato'
      });
    }
    
    const startTime = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const endTime = new Date();
    const dataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
    
    // Ottieni tutti gli audit logs per il periodo
    const allLogs = await getAuditLogs({
      startTime,
      endTime,
      limit: 100000 // Limite alto per statistiche
    });
    
    // Calcola statistiche generali
    const total_actions = allLogs.length;
    const successful_actions = allLogs.filter(log => log.success === true).length;
    const failed_actions = allLogs.filter(log => {
      if (log.success !== false) return false;
      const errorMsg = log.error_message || '';
      return !errorMsg.includes('HTTP 500') && 
             !errorMsg.includes('Errore nella registrazione') &&
             !errorMsg.includes('Internal Server Error') &&
             !errorMsg.includes('Database Error');
    }).length;
    const technical_errors = allLogs.filter(log => {
      if (log.success !== false) return false;
      const errorMsg = log.error_message || '';
      return errorMsg.includes('HTTP 500') || 
             errorMsg.includes('Errore nella registrazione') ||
             errorMsg.includes('Internal Server Error') ||
             errorMsg.includes('Database Error');
    }).length;
    
    const unique_users = new Set(allLogs.map(log => log.user_id).filter(Boolean)).size;
    const unique_actions = new Set(allLogs.map(log => log.action).filter(Boolean)).size;
    const unique_resources = new Set(allLogs.map(log => log.resource).filter(Boolean)).size;
    
    const stats = {
      total_actions,
      successful_actions,
      failed_actions,
      technical_errors,
      unique_users,
      unique_actions,
      unique_resources
    };
    
    // Top azioni
    const actionCounts = {};
    allLogs.forEach(log => {
      if (log.action) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      }
    });
    const top_actions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Top risorse
    const resourceCounts = {};
    allLogs.forEach(log => {
      if (log.resource) {
        resourceCounts[log.resource] = (resourceCounts[log.resource] || 0) + 1;
      }
    });
    const top_resources = Object.entries(resourceCounts)
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Top utenti
    const userCounts = {};
    allLogs.forEach(log => {
      if (log.user_id) {
        userCounts[log.user_id] = (userCounts[log.user_id] || 0) + 1;
      }
    });
    const top_users = Object.entries(userCounts)
      .map(([user_id, count]) => ({ user_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Attività per giorno
    const dailyActivity = {};
    allLogs.forEach(log => {
      if (log._time) {
        const date = new Date(log._time).toISOString().split('T')[0];
        if (!dailyActivity[date]) {
          dailyActivity[date] = { actions: 0, successful: 0, failed: 0 };
        }
        dailyActivity[date].actions++;
        if (log.success === true) {
          dailyActivity[date].successful++;
        } else if (log.success === false) {
          dailyActivity[date].failed++;
        }
      }
    });
    const daily_activity = Object.entries(dailyActivity)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => b.date.localeCompare(a.date));
    
    res.json({
      success: true,
      data: {
        period_days: parseInt(days),
        general_stats: stats,
        top_actions,
        top_resources,
        top_users,
        daily_activity
      }
    });
    
  } catch (error) {
    console.error('AUDIT_DASHBOARD_STATS_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i dati di audit.'
    });
  }
});

/**
 * GET /api/admin/audit-dashboard/logs
 * Ottiene i log di audit con filtri
 */
router.get('/logs', async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'I log audit sono disponibili solo con Axiom abilitato'
      });
    }
    
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
    
    // Prepara filtri per Axiom
    const startTime = from_date ? new Date(from_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endTime = to_date ? new Date(to_date) : new Date();
    
    // Ottieni audit logs da Axiom
    const logs = await getAuditLogs({
      userId: user_id || null,
      action: action || null,
      resource: resource || null,
      success: success !== undefined ? (success === 'true') : null,
      startTime,
      endTime,
      limit: parseInt(limit) * 10, // Prendi più record per filtrare search lato server
      offset: 0
    });
    
    // Applica filtro search se presente
    let filteredLogs = logs;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = logs.filter(log => {
        return (log.message && log.message.toLowerCase().includes(searchLower)) ||
               (log.action && log.action.toLowerCase().includes(searchLower)) ||
               (log.resource && log.resource.toLowerCase().includes(searchLower)) ||
               (log.error_message && log.error_message.toLowerCase().includes(searchLower)) ||
               (log.user_id && log.user_id.toLowerCase().includes(searchLower));
      });
    }
    
    // Applica paginazione
    const paginatedLogs = filteredLogs.slice(offset, offset + parseInt(limit));
    
    // Ottieni nomi utenti se necessario (per compatibilità con frontend)
    const userIds = [...new Set(paginatedLogs.map(log => log.user_id).filter(Boolean))];
    const userNames = {};
    if (userIds.length > 0) {
      try {
        const usersResult = await pool.query(
          'SELECT id, nome, cognome FROM users WHERE id = ANY($1)',
          [userIds]
        );
        usersResult.rows.forEach(user => {
          userNames[user.id] = `${user.nome || ''} ${user.cognome || ''}`.trim() || 'Utente Sconosciuto';
        });
      } catch (error) {
        console.error('AUDIT_DASHBOARD_USER_LOOKUP_FAILED');
      }
    }
    
    // Formatta i log per il frontend
    const formattedLogs = paginatedLogs.map(log => ({
      id: log._time || Date.now().toString(), // Usa _time come ID se non c'è id
      user_id: log.user_id,
      action: log.action,
      resource: log.resource,
      resource_id: log.resource_id,
      details: log.details || null,
      ip_address: log.ip_address,
      user_agent: null, // Non più disponibile (rimosso per GDPR)
      timestamp: log._time || new Date().toISOString(),
      success: log.success,
      error_message: log.error_message,
      user_name: userNames[log.user_id] || 'Utente Sconosciuto'
    }));
    
    const total = filteredLogs.length;
    
    res.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          total_pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
    
  } catch (error) {
    console.error('AUDIT_DASHBOARD_LOGS_FAILED');
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
    console.error('AUDIT_DASHBOARD_USER_LOGS_FAILED');
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
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'Il rilevamento attività sospette è disponibile solo con Axiom abilitato'
      });
    }
    
    const { days = 7 } = req.query;
    const startTime = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const endTime = new Date();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Ottieni tutti gli audit logs per il periodo
    const allLogs = await getAuditLogs({
      startTime,
      endTime,
      limit: 100000 // Limite alto per analisi
    });
    
    // Trova utenti con molte azioni fallite
    const failedByUser = {};
    allLogs.forEach(log => {
      if (log.success === false && log.user_id) {
        failedByUser[log.user_id] = (failedByUser[log.user_id] || 0) + 1;
      }
    });
    const failed_actions = Object.entries(failedByUser)
      .filter(([_, count]) => count > 10)
      .map(([user_id, failed_count]) => ({ user_id, failed_count }))
      .sort((a, b) => b.failed_count - a.failed_count);
    
    // Trova utenti con molte azioni in poco tempo (ultima ora)
    const recentLogs = allLogs.filter(log => {
      const logTime = new Date(log._time || 0);
      return logTime >= oneHourAgo;
    });
    const rapidByUser = {};
    recentLogs.forEach(log => {
      if (log.user_id) {
        rapidByUser[log.user_id] = (rapidByUser[log.user_id] || 0) + 1;
      }
    });
    const rapid_actions = Object.entries(rapidByUser)
      .filter(([_, count]) => count > 50)
      .map(([user_id, action_count]) => ({ user_id, action_count }))
      .sort((a, b) => b.action_count - a.action_count);
    
    // Trova accessi da IP sospetti (molti utenti diversi)
    const ipStats = {};
    allLogs.forEach(log => {
      if (log.ip_address && log.user_id) {
        if (!ipStats[log.ip_address]) {
          ipStats[log.ip_address] = { users: new Set(), count: 0 };
        }
        ipStats[log.ip_address].users.add(log.user_id);
        ipStats[log.ip_address].count++;
      }
    });
    const suspicious_ips = Object.entries(ipStats)
      .filter(([_, stats]) => stats.users.size > 5)
      .map(([ip_address, stats]) => ({
        ip_address,
        unique_users: stats.users.size,
        total_actions: stats.count
      }))
      .sort((a, b) => b.unique_users - a.unique_users || b.total_actions - a.total_actions);
    
    // Trova tentativi di accesso a dati di altri utenti
    const unauthorizedAccess = {};
    allLogs.forEach(log => {
      if (log.action === 'DATA_ACCESS' && 
          log.resource === 'users' && 
          log.resource_id && 
          log.user_id &&
          log.resource_id !== log.user_id) {
        const key = `${log.user_id}-${log.resource_id}`;
        unauthorizedAccess[key] = (unauthorizedAccess[key] || 0) + 1;
      }
    });
    const unauthorized_access = Object.entries(unauthorizedAccess)
      .filter(([_, count]) => count > 3)
      .map(([key, access_count]) => {
        const [user_id, resource_id] = key.split('-');
        return { user_id, resource: 'users', resource_id, access_count };
      })
      .sort((a, b) => b.access_count - a.access_count);
    
    res.json({
      success: true,
      data: {
        period_days: parseInt(days),
        failed_actions,
        rapid_actions,
        suspicious_ips,
        unauthorized_access
      }
    });
    
  } catch (error) {
    console.error('AUDIT_DASHBOARD_SUSPICIOUS_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i dati di audit.'
    });
  }
});

/**
 * GET /api/admin/audit-dashboard/violations
 * Ottiene violazioni di sicurezza recenti
 */
router.get('/violations', async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'Le violazioni di sicurezza sono disponibili solo con Axiom abilitato'
      });
    }
    
    const { days = 7 } = req.query;
    const startTime = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const endTime = new Date();
    
    // Ottieni tutti gli audit logs falliti per il periodo
    const allLogs = await getAuditLogs({
      success: false,
      startTime,
      endTime,
      limit: 10000 // Limite alto per analisi violazioni
    });
    
    // Filtra violazioni di sicurezza (escludendo errori tecnici HTTP 500)
    const violations = allLogs.filter(log => {
      const errorMsg = (log.error_message || '').toLowerCase();
      const action = (log.action || '').toUpperCase();
      
      // Escludi errori tecnici
      if (errorMsg.includes('http 500') || 
          errorMsg.includes('errore nella registrazione') ||
          errorMsg.includes('internal server error') ||
          errorMsg.includes('database error')) {
        return false;
      }
      
      // Includi solo violazioni di sicurezza
      return action.includes('SECURITY') || 
             action.includes('AUTH') || 
             action.includes('PERMISSION') ||
             errorMsg.includes('unauthorized') ||
             errorMsg.includes('forbidden') ||
             errorMsg.includes('invalid credentials') ||
             errorMsg.includes('access denied') ||
             errorMsg.includes('token expired') ||
             errorMsg.includes('invalid token');
    });
    
    // Ordina per timestamp e limita a 20
    const sortedViolations = violations
      .sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0))
      .slice(0, 20);
    
    // Ottieni nomi utenti
    const userIds = [...new Set(sortedViolations.map(v => v.user_id).filter(Boolean))];
    const userNames = {};
    if (userIds.length > 0) {
      try {
        const usersResult = await pool.query(
          'SELECT id, nome, cognome FROM users WHERE id = ANY($1)',
          [userIds]
        );
        usersResult.rows.forEach(user => {
          userNames[user.id] = `${user.nome || ''} ${user.cognome || ''}`.trim() || 'Utente Sconosciuto';
        });
      } catch (error) {
        console.error('AUDIT_DASHBOARD_USER_LOOKUP_FAILED');
      }
    }
    
    // Formatta violazioni
    const formattedViolations = sortedViolations.map(v => {
      const action = (v.action || '').toUpperCase();
      let severity = 'Medium';
      if (action.includes('FAILED') || action.includes('ERROR')) {
        severity = 'Critical';
      } else if (action.includes('WARNING')) {
        severity = 'High';
      }
      
      return {
        id: v._time || Date.now().toString(),
        type: v.action,
        user: userNames[v.user_id] || 'Utente Sconosciuto',
        timestamp: formatSecurityViolationDate(v._time || new Date().toISOString()),
        severity
      };
    });
    
    // Calcola statistiche
    const total_violations = violations.length;
    const critical_issues = violations.filter(v => {
      const action = (v.action || '').toUpperCase();
      return action.includes('FAILED') || action.includes('ERROR');
    }).length;
    const high_issues = violations.filter(v => {
      const action = (v.action || '').toUpperCase();
      return action.includes('WARNING');
    }).length;
    const security_violations = violations.filter(v => {
      const action = (v.action || '').toUpperCase();
      return action.includes('SECURITY');
    }).length;
    
    res.json({
      success: true,
      data: {
        violations: formattedViolations,
        stats: {
          total_violations,
          critical_issues,
          high_issues,
          security_violations
        }
      }
    });
    
  } catch (error) {
    console.error('AUDIT_DASHBOARD_VIOLATIONS_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i dati di audit.'
    });
  }
});

/**
 * GET /api/admin/audit-dashboard/performance
 * Ottiene metriche di performance del sistema
 */
router.get('/performance', async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'Le metriche di performance sono disponibili solo con Axiom abilitato'
      });
    }
    
    // Per ora restituiamo un array vuoto - in futuro si potrebbero integrare monitoring tools reali
    const performanceData = [];
    
    // Statistiche di logging da Axiom
    const startTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Ultimo anno
    const endTime = new Date();
    const todayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const allLogs = await getAuditLogs({
      startTime,
      endTime,
      limit: 100000 // Limite alto per statistiche
    });
    
    const todayLogs = allLogs.filter(log => {
      const logTime = new Date(log._time || 0);
      return logTime >= todayStart;
    });
    
    const total_logs = allLogs.length;
    const successful_logs = allLogs.filter(log => log.success === true).length;
    const error_logs = allLogs.filter(log => log.success === false).length;
    const today_logs = todayLogs.length;
    
    res.json({
      success: true,
      data: {
        performance: performanceData,
        logging: {
          total_logs,
          successful_logs,
          error_logs,
          today_logs
        }
      }
    });
    
  } catch (error) {
    console.error('AUDIT_DASHBOARD_PERFORMANCE_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i dati di audit.'
    });
  }
});

/**
 * POST /api/admin/audit-dashboard/cleanup
 * Pulisce i log di audit vecchi
 */
router.post('/cleanup', async (req, res) => {
  try {
    // Axiom applies its own dataset retention, but this endpoint cannot erase
    // external Axiom records or immutable B2 archive versions. Never report
    // cleanup success without provider-specific evidence and RP-10 approval.
    if (process.env.AXIOM_ENABLED === 'true') {
      return res.status(409).json({
        success: false,
        error: 'AUDIT_RETENTION_PROVIDER_REVIEW_REQUIRED',
        message: 'Nessuna pulizia eseguita. Verificare separatamente la conservazione su Axiom e B2.',
        deleted_count: 0
      });
    }
    
    const { daysToKeep = 365 } = req.body;
    
    const deletedCount = await AuditService.cleanupOldLogs(parseInt(daysToKeep));
    
    res.json({
      success: true,
      message: `Puliti ${deletedCount} log di audit più vecchi di ${daysToKeep} giorni`,
      deleted_count: deletedCount
    });
    
  } catch (error) {
    const policyPending = error?.code === 'AUDIT_RETENTION_POLICY_NOT_APPROVED';
    // Never disclose raw SQL/provider exceptions to the Admin HTTP client or
    // unminimized logs; diagnostics use controlled, stable codes only.
    console.error(policyPending ? 'AUDIT_CLEANUP_POLICY_NOT_APPROVED' : 'AUDIT_CLEANUP_FAILED');
    return res.status(policyPending ? 409 : 500).json({
      success: false,
      error: policyPending ? 'AUDIT_RETENTION_POLICY_NOT_APPROVED' : 'AUDIT_CLEANUP_FAILED',
      message: policyPending
        ? 'La politica di conservazione dei log non è ancora approvata.'
        : 'Impossibile completare la pulizia dei log.'
    });
  }
});

module.exports = router;
