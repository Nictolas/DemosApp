const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

// POST /api/test-add-opinione - Test aggiunta opinione
router.post('/', verifyToken, async (req, res) => {
  try {
    console.log('🧪 TEST - Aggiunta opinione di test');
    
    const { id, text, gradi_opinione } = req.body;
    
    // Usa dati di test se non forniti
    const testId = id || 'test_opinione_' + Date.now();
    const testText = text || 'Opinione di test';
    const testGradi = gradi_opinione || ['Nazionale'];
    
    console.log('🔍 Dati test:', { testId, testText, testGradi });
    
    const insertQuery = `
      INSERT INTO opinioni (id, text, gradi_opinione, approfondimento)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        gradi_opinione = EXCLUDED.gradi_opinione,
        approfondimento = EXCLUDED.approfondimento
    `;
    
    const approfondimento = `## Proposta ${testGradi.join(', ')}\n\n${testText}`;
    const result = await pool.query(insertQuery, [testId, testText, testGradi, approfondimento]);
    
    console.log('✅ Opinione di test creata/aggiornata:', testId);
    
    res.json({
      success: true,
      message: 'Opinione di test creata con successo',
      data: {
        id: testId,
        text: testText,
        gradi_opinione: testGradi,
        approfondimento: approfondimento
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel test aggiunta opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel test aggiunta opinione',
      message: error.message
    });
  }
});

module.exports = router;
