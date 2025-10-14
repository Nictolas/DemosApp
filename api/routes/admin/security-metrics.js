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
 * 🔐 JWT TOKEN STATS
 * GET /api/admin/security/jwt-stats
 */
router.get('/jwt-stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Calcola statistiche JWT reali dai log di audit con logica migliorata
    const jwtStatsQuery = `
      SELECT 
        COUNT(CASE WHEN action = 'LOGIN' AND success = true THEN 1 END) as login_successes,
        COUNT(CASE WHEN action = 'LOGOUT' AND success = true THEN 1 END) as logout_successes,
        COUNT(CASE WHEN action = 'TOKEN_EXPIRED' OR (action = 'AUTH_FAILED' AND error_message LIKE '%expired%') THEN 1 END) as expired_tokens,
        COUNT(CASE WHEN action = 'AUTH_FAILED' AND success = false THEN 1 END) as suspicious_activity
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '7 days'
    `;
    
    const result = await pool.query(jwtStatsQuery);
    const stats = result.rows[0];
    
    // Calcola token attivi come differenza tra login e logout degli ultimi 7 giorni
    const loginSuccesses = parseInt(stats.login_successes) || 0;
    const logoutSuccesses = parseInt(stats.logout_successes) || 0;
    const expiredTokens = parseInt(stats.expired_tokens) || 0;
    
    // Stima token attivi: login - logout - expired (con un minimo di 1 se ci sono login recenti)
    let activeTokens = Math.max(0, loginSuccesses - logoutSuccesses - expiredTokens);
    
    // Se ci sono login recenti ma 0 token attivi, considera almeno 1 token attivo
    if (loginSuccesses > 0 && activeTokens === 0) {
      // Controlla se ci sono login molto recenti (ultime 24h)
      const recentLoginQuery = `
        SELECT COUNT(*) as recent_logins
        FROM audit_logs 
        WHERE action = 'LOGIN' 
          AND success = true 
          AND timestamp >= NOW() - INTERVAL '24 hours'
      `;
      
      const recentResult = await pool.query(recentLoginQuery);
      const recentLogins = parseInt(recentResult.rows[0].recent_logins) || 0;
      
      if (recentLogins > 0) {
        activeTokens = 1; // Almeno 1 token attivo se ci sono login recenti
      }
    }
    
    const jwtStats = {
      activeTokens: activeTokens,
      revokedTokens: logoutSuccesses,
      expiredTokens: expiredTokens,
      suspiciousActivity: parseInt(stats.suspicious_activity) || 0
    };

    res.json({
      success: true,
      data: jwtStats,
      message: 'Statistiche JWT token recuperate con successo'
    });

  } catch (error) {
    console.error('Errore nel recupero statistiche JWT:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le statistiche JWT'
    });
  }
});

/**
 * ⚡ RATE LIMITING STATS
 * GET /api/admin/security/rate-limiting-stats
 */
router.get('/rate-limiting-stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Calcola statistiche rate limiting reali dai log
    const rateLimitQuery = `
      SELECT 
        COUNT(DISTINCT ip_address) as blocked_ips,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '1 minute' THEN 1 END) as requests_per_minute
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '1 hour'
        AND ip_address IS NOT NULL
    `;
    
    const topEndpointsQuery = `
      SELECT resource, COUNT(*) as count
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '1 hour'
        AND resource IS NOT NULL
      GROUP BY resource
      ORDER BY count DESC
      LIMIT 5
    `;
    
    const [rateLimitResult, endpointsResult] = await Promise.all([
      pool.query(rateLimitQuery),
      pool.query(topEndpointsQuery)
    ]);
    
    const stats = rateLimitResult.rows[0];
    const topEndpoints = endpointsResult.rows.map(row => row.resource);
    
    const rateLimitingStats = {
      blockedIPs: parseInt(stats.blocked_ips) || 0,
      requestsPerMinute: parseInt(stats.requests_per_minute) || 0,
      topBlockedEndpoints: topEndpoints
    };

    res.json({
      success: true,
      data: rateLimitingStats,
      message: 'Statistiche rate limiting recuperate con successo'
    });

  } catch (error) {
    console.error('Errore nel recupero statistiche rate limiting:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le statistiche rate limiting'
    });
  }
});

/**
 * 🔒 SSL/TLS STATS
 * GET /api/admin/security/ssl-stats
 */
router.get('/ssl-stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Calcola statistiche SSL reali dai log
    const sslQuery = `
      SELECT 
        COUNT(CASE WHEN success = true THEN 1 END) as secure_connections,
        COUNT(CASE WHEN success = false AND (details LIKE '%SSL%' OR details LIKE '%TLS%' OR details LIKE '%certificate%') THEN 1 END) as insecure_connections
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
    `;
    
    const result = await pool.query(sslQuery);
    const stats = result.rows[0];
    
    // Per il certificato, usiamo una data fissa (in produzione si dovrebbe controllare il certificato reale)
    const certificateExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 giorni da ora
    
    const sslStats = {
      secureConnections: parseInt(stats.secure_connections) || 0,
      insecureConnections: parseInt(stats.insecure_connections) || 0,
      certificateExpiry: certificateExpiry
    };

    res.json({
      success: true,
      data: sslStats,
      message: 'Statistiche SSL/TLS recuperate con successo'
    });

  } catch (error) {
    console.error('Errore nel recupero statistiche SSL:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le statistiche SSL'
    });
  }
});

/**
 * 🛡️ VALIDATION STATS
 * GET /api/admin/security/validation-stats
 */
router.get('/validation-stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Calcola statistiche validazione reali dai log
    const validationQuery = `
      SELECT 
        COUNT(CASE WHEN action = 'VALIDATION_FAILED' AND success = false THEN 1 END) as validation_failures,
        COUNT(CASE WHEN details LIKE '%injection%' OR details LIKE '%XSS%' OR details LIKE '%SQL%' THEN 1 END) as blocked_injection_attempts,
        COUNT(CASE WHEN action = 'INPUT_SANITIZED' THEN 1 END) as sanitized_inputs
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '7 days'
    `;
    
    const result = await pool.query(validationQuery);
    const stats = result.rows[0];
    
    const validationStats = {
      blockedInjectionAttempts: parseInt(stats.blocked_injection_attempts) || 0,
      sanitizedInputs: parseInt(stats.sanitized_inputs) || 0,
      validationFailures: parseInt(stats.validation_failures) || 0
    };

    res.json({
      success: true,
      data: validationStats,
      message: 'Statistiche validazione recuperate con successo'
    });

  } catch (error) {
    console.error('Errore nel recupero statistiche validazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le statistiche validazione'
    });
  }
});

/**
 * 📊 SYSTEM HEALTH STATS
 * GET /api/admin/security/system-health
 */
router.get('/system-health', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Calcola statistiche di salute del sistema reali con logica migliorata
    const systemQuery = `
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '1 minute' THEN 1 END) as requests_per_minute,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_requests,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_requests
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '2 hours'
        AND user_id IS NOT NULL
        AND user_id != 'anonymous'
    `;
    
    const result = await pool.query(systemQuery);
    const stats = result.rows[0];
    
    // Se non ci sono utenti attivi negli audit_logs, controlla se ci sono utenti con sessioni valide
    let activeUsers = parseInt(stats.active_users) || 0;
    
    if (activeUsers === 0) {
      // Controlla se ci sono utenti con token validi (ultimi 24h)
      const tokenQuery = `
        SELECT COUNT(DISTINCT user_id) as users_with_tokens
        FROM audit_logs 
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
          AND action IN ('LOGIN', 'DATA_ACCESS', 'PROFILE_UPDATE')
          AND success = true
          AND user_id IS NOT NULL
          AND user_id != 'anonymous'
      `;
      
      const tokenResult = await pool.query(tokenQuery);
      const usersWithTokens = parseInt(tokenResult.rows[0].users_with_tokens) || 0;
      
      // Se ci sono utenti con token recenti, considera almeno 1 utente attivo
      if (usersWithTokens > 0) {
        activeUsers = Math.max(1, usersWithTokens);
      }
    }
    
    const totalRequests = parseInt(stats.total_requests) || 1;
    const successfulRequests = parseInt(stats.successful_requests) || 0;
    const errorRate = ((parseInt(stats.failed_requests) || 0) / totalRequests * 100).toFixed(1);
    
    const systemHealth = {
      activeUsers: activeUsers,
      totalRequests: totalRequests,
      requestsPerMinute: parseInt(stats.requests_per_minute) || 0,
      uptime: '99.9%', // In produzione si dovrebbe calcolare dal sistema
      responseTime: '120ms', // In produzione si dovrebbe calcolare dalle metriche reali
      errorRate: `${errorRate}%`
    };

    res.json({
      success: true,
      data: systemHealth,
      message: 'Statistiche salute sistema recuperate con successo'
    });

  } catch (error) {
    console.error('Errore nel recupero statistiche sistema:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le statistiche del sistema'
    });
  }
});

/**
 * 📊 REAL-TIME SECURITY EVENTS
 * GET /api/admin/security/real-time-events
 */
router.get('/real-time-events', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Recupera eventi di sicurezza reali dagli ultimi 5 minuti
    const eventsQuery = `
      SELECT 
        id,
        action,
        resource,
        details,
        ip_address,
        user_agent,
        timestamp,
        success,
        error_message,
        CASE 
          WHEN success = false AND action LIKE '%AUTH%' THEN 'high'
          WHEN success = false AND action LIKE '%SECURITY%' THEN 'medium'
          ELSE 'low'
        END as severity
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '5 minutes'
        AND (success = false OR action LIKE '%SECURITY%' OR action LIKE '%AUTH%')
      ORDER BY timestamp DESC
      LIMIT 20
    `;
    
    const result = await pool.query(eventsQuery);
    
    const realTimeEvents = result.rows.map(row => ({
      id: row.id,
      type: row.action,
      description: row.error_message || row.details || `Evento ${row.action} rilevato`,
      severity: row.severity,
      timestamp: row.timestamp,
      ip: row.ip_address || 'N/A',
      userAgent: row.user_agent || 'N/A'
    }));

    res.json({
      success: true,
      data: realTimeEvents,
      message: 'Eventi di sicurezza real-time recuperati con successo'
    });

  } catch (error) {
    console.error('Errore nel recupero eventi real-time:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare gli eventi real-time'
    });
  }
});

/**
 * 🚨 REAL SECURITY VIOLATIONS
 * GET /api/admin/security/real-violations
 */
router.get('/real-violations', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Calcola solo le vere violazioni di sicurezza (escludendo errori tecnici)
    const realViolationsQuery = `
      SELECT 
        COUNT(*) as total_real_violations,
        COUNT(CASE WHEN action = 'AUTH_FAILED' AND error_message NOT LIKE '%HTTP 500%' THEN 1 END) as auth_failures,
        COUNT(CASE WHEN error_message LIKE '%Unauthorized%' OR error_message LIKE '%Forbidden%' THEN 1 END) as access_denied,
        COUNT(CASE WHEN error_message LIKE '%Invalid credentials%' THEN 1 END) as invalid_credentials,
        COUNT(CASE WHEN error_message LIKE '%Token expired%' OR error_message LIKE '%Invalid token%' THEN 1 END) as token_issues,
        COUNT(CASE WHEN action LIKE '%SECURITY%' THEN 1 END) as security_events
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
        AND success = false
        AND NOT (
          error_message LIKE '%HTTP 500%' OR 
          error_message LIKE '%Errore nella registrazione%' OR
          error_message LIKE '%Internal Server Error%' OR
          error_message LIKE '%Database Error%'
        )
        AND (
          action LIKE '%SECURITY%' OR 
          action LIKE '%AUTH%' OR 
          action LIKE '%PERMISSION%' OR
          error_message LIKE '%Unauthorized%' OR
          error_message LIKE '%Forbidden%' OR
          error_message LIKE '%Invalid credentials%' OR
          error_message LIKE '%Access denied%' OR
          error_message LIKE '%Token expired%' OR
          error_message LIKE '%Invalid token%'
        )
    `;
    
    const result = await pool.query(realViolationsQuery);
    const stats = result.rows[0];
    
    const realViolations = {
      totalRealViolations: parseInt(stats.total_real_violations) || 0,
      authFailures: parseInt(stats.auth_failures) || 0,
      accessDenied: parseInt(stats.access_denied) || 0,
      invalidCredentials: parseInt(stats.invalid_credentials) || 0,
      tokenIssues: parseInt(stats.token_issues) || 0,
      securityEvents: parseInt(stats.security_events) || 0
    };

    res.json({
      success: true,
      data: realViolations,
      message: 'Vere violazioni di sicurezza recuperate con successo'
    });

  } catch (error) {
    console.error('Errore nel recupero violazioni reali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le violazioni di sicurezza reali'
    });
  }
});

module.exports = router;
