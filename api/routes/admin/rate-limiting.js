// File: api/routes/admin/rate-limiting.js
const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const RateLimitService = require('../../services/rateLimitService');
const { auditMiddleware } = require('../../middleware/auditMiddleware');

const router = express.Router();

// Middleware per tutte le route
router.use(verifyToken, requireAdmin, auditMiddleware);

// Dashboard rate limiting
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = await RateLimitService.getDashboardData();
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('❌ Errore nel recupero dashboard rate limiting:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Statistiche rate limiting
router.get('/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const stats = await RateLimitService.getRateLimitStats(parseInt(days));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche rate limiting:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// IP sospetti
router.get('/suspicious-ips', async (req, res) => {
  try {
    const { days = 7, minViolations = 5 } = req.query;
    const suspiciousIPs = await RateLimitService.getSuspiciousIPs(
      parseInt(days), 
      parseInt(minViolations)
    );
    
    res.json({
      success: true,
      data: suspiciousIPs
    });
  } catch (error) {
    console.error('❌ Errore nel recupero IP sospetti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Statistiche per endpoint
router.get('/endpoint-stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const endpointStats = await RateLimitService.getEndpointStats(parseInt(days));
    
    res.json({
      success: true,
      data: endpointStats
    });
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Verifica se IP è bloccato
router.get('/check-ip/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const { hours = 24 } = req.query;
    
    const isBlocked = await RateLimitService.isIPBlocked(ip, parseInt(hours));
    
    res.json({
      success: true,
      data: {
        ip,
        isBlocked,
        checkedHours: parseInt(hours)
      }
    });
  } catch (error) {
    console.error('❌ Errore nella verifica blocco IP:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// RP-10 non approvata: non confermare falsi successi o cancellare eventi di sicurezza.
router.post('/cleanup', async (_req, res) => {
  return res.status(409).json({
    success: false,
    error: 'RETENTION_POLICY_NOT_APPROVED'
  });
});

module.exports = router;
