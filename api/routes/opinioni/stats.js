const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');

const router = express.Router();

// GET /api/opinioni/test - Endpoint di test senza autenticazione
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 TEST - Endpoint opinioni raggiunto senza autenticazione');
    
    res.json({
      success: true,
      message: 'Endpoint opinioni raggiunto correttamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore endpoint test:', error);
    res.status(500).json({
      success: false,
      error: 'Errore endpoint test'
    });
  }
});

// GET /api/opinioni/debug - Debug completo opinioni
router.get('/debug', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG - Richiesta debug opinioni');
    
    // 1. Verifica struttura tabella opinioni
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(structureQuery);
    
    // 2. Conta opinioni totali
    const countQuery = 'SELECT COUNT(*) as total FROM opinioni';
    const countResult = await pool.query(countQuery);
    
    // 3. Verifica gradi opinioni
    const degreesQuery = `
      SELECT DISTINCT unnest(gradi_opinione) as grado
      FROM opinioni
      ORDER BY grado
    `;
    
    const degreesResult = await pool.query(degreesQuery);
    
    // 4. Esempio opinioni
    const sampleQuery = `
      SELECT id, text, gradi_opinione, created_at, updated_at
      FROM opinioni
      LIMIT 5
    `;
    
    const sampleResult = await pool.query(sampleQuery);
    
    res.json({
      success: true,
      debug: {
        timestamp: new Date().toISOString(),
        tableStructure: structureResult.rows,
        totalOpinions: countResult.rows[0].total,
        availableDegrees: degreesResult.rows.map(r => r.grado),
        sampleOpinions: sampleResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel debug opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel debug opinioni',
      message: error.message
    });
  }
});

// GET /api/opinioni/stats/:opinionId - Ottieni statistiche per opinione
router.get('/stats/:opinionId', verifyToken, async (req, res) => {
  try {
    const { opinionId } = req.params;
    
    // Query per ottenere le statistiche generali
    const statsQuery = `
      SELECT 
        COUNT(*) as total_votes,
        COUNT(CASE WHEN risposta = 'Sì' THEN 1 END) as si_votes,
        COUNT(CASE WHEN risposta = 'No' THEN 1 END) as no_votes,
        COUNT(CASE WHEN risposta = 'Indeciso' THEN 1 END) as indeciso_votes
      FROM voti_opinioni
      WHERE opinione_id = $1
    `;
    
    const statsResult = await pool.query(statsQuery, [opinionId]);
    const stats = statsResult.rows[0];
    
    // Calcola le percentuali
    const total = parseInt(stats.total_votes) || 0;
    const percentages = {
      si: total > 0 ? Math.round((parseInt(stats.si_votes) / total) * 100) : 0,
      no: total > 0 ? Math.round((parseInt(stats.no_votes) / total) * 100) : 0,
      indeciso: total > 0 ? Math.round((parseInt(stats.indeciso_votes) / total) * 100) : 0
    };
    
    res.json({
      success: true,
      stats: {
        total: total,
        si: parseInt(stats.si_votes) || 0,
        no: parseInt(stats.no_votes) || 0,
        indeciso: parseInt(stats.indeciso_votes) || 0,
        percentages: percentages
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche opinione'
    });
  }
});

module.exports = router;
