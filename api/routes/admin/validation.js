// File: api/routes/admin/validation.js
const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');
const { auditMiddleware } = require('../../middleware/auditMiddleware');

const router = express.Router();

// Middleware per tutte le route
router.use(verifyToken, requireAdmin, auditMiddleware);

// Statistiche validazione
router.get('/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    // Query per statistiche generali
    const statsQuery = `
      SELECT 
        COUNT(*) as total_failures,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT endpoint) as unique_endpoints
      FROM validation_failures 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
    `;
    
    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];
    
    // Query per fallimenti per tipo di errore
    const errorsQuery = `
      SELECT 
        jsonb_array_elements_text(errors) as error_type,
        COUNT(*) as count
      FROM validation_failures 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY error_type
      ORDER BY count DESC
    `;
    
    const errorsResult = await pool.query(errorsQuery);
    const failures_by_type = {};
    errorsResult.rows.forEach(row => {
      failures_by_type[row.error_type] = parseInt(row.count);
    });
    
    // Query per fallimenti per endpoint
    const endpointQuery = `
      SELECT 
        endpoint,
        COUNT(*) as count
      FROM validation_failures 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY endpoint
      ORDER BY count DESC
    `;
    
    const endpointResult = await pool.query(endpointQuery);
    const failures_by_endpoint = {};
    endpointResult.rows.forEach(row => {
      failures_by_endpoint[row.endpoint] = parseInt(row.count);
    });
    
    // Query per fallimenti recenti
    const recentQuery = `
      SELECT 
        id,
        ip_address,
        user_agent,
        endpoint,
        errors,
        input_data,
        timestamp
      FROM validation_failures 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      ORDER BY timestamp DESC
      LIMIT 20
    `;
    
    const recentResult = await pool.query(recentQuery);
    const recent_failures = recentResult.rows.map(row => ({
      ...row,
      errors: JSON.parse(row.errors),
      input_data: JSON.parse(row.input_data || '{}')
    }));
    
    res.json({
      success: true,
      data: {
        total_failures: parseInt(stats.total_failures),
        unique_ips: parseInt(stats.unique_ips),
        unique_endpoints: parseInt(stats.unique_endpoints),
        failures_by_type,
        failures_by_endpoint,
        recent_failures
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche validazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Dettagli fallimento specifico
router.get('/failure/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        ip_address,
        user_agent,
        endpoint,
        errors,
        input_data,
        timestamp
      FROM validation_failures 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Fallimento non trovato'
      });
    }
    
    const failure = result.rows[0];
    failure.errors = JSON.parse(failure.errors);
    failure.input_data = JSON.parse(failure.input_data || '{}');
    
    res.json({
      success: true,
      data: failure
    });
  } catch (error) {
    console.error('❌ Errore nel recupero dettagli fallimento:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// RP-10 non approvata: nessuna cancellazione age-based degli eventi di validazione.
router.post('/cleanup', async (_req, res) => {
  return res.status(409).json({
    success: false,
    error: 'RETENTION_POLICY_NOT_APPROVED'
  });
});

// Fallimenti per IP specifico
router.get('/ip/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const { days = 7 } = req.query;
    
    const query = `
      SELECT 
        id,
        endpoint,
        errors,
        timestamp
      FROM validation_failures 
      WHERE ip_address = $1 
      AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      ORDER BY timestamp DESC
    `;
    
    const result = await pool.query(query, [ip]);
    const failures = result.rows.map(row => ({
      ...row,
      errors: JSON.parse(row.errors)
    }));
    
    res.json({
      success: true,
      data: failures
    });
  } catch (error) {
    console.error('❌ Errore nel recupero fallimenti IP:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Fallimenti per endpoint specifico
router.get('/endpoint/:endpoint', async (req, res) => {
  try {
    const { endpoint } = req.params;
    const { days = 7 } = req.query;
    
    const query = `
      SELECT 
        id,
        ip_address,
        errors,
        timestamp
      FROM validation_failures 
      WHERE endpoint = $1 
      AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      ORDER BY timestamp DESC
    `;
    
    const result = await pool.query(query, [endpoint]);
    const failures = result.rows.map(row => ({
      ...row,
      errors: JSON.parse(row.errors)
    }));
    
    res.json({
      success: true,
      data: failures
    });
  } catch (error) {
    console.error('❌ Errore nel recupero fallimenti endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
