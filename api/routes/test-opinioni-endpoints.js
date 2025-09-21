const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/test-opinioni-endpoints - Test endpoint per verificare opinioni
router.get('/', async (req, res) => {
  try {
    console.log('🧪 TEST - Verifica endpoint opinioni');
    
    // Test 1: Verifica tabella opinioni
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as count 
      FROM opinioni
    `);
    
    // Test 2: Verifica struttura tabella
    const structureCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      ORDER BY ordinal_position
    `);
    
    // Test 3: Esempio di opinioni
    const sampleOpinions = await pool.query(`
      SELECT id, text, gradi_opinione, approfondimento
      FROM opinioni 
      LIMIT 3
    `);
    
    res.json({
      success: true,
      message: 'Test endpoint opinioni completato',
      results: {
        tableExists: true,
        totalOpinions: tableCheck.rows[0].count,
        structure: structureCheck.rows,
        sampleOpinions: sampleOpinions.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel test opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel test opinioni',
      message: error.message
    });
  }
});

module.exports = router;
