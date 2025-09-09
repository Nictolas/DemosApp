const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/test/disponibili - Ottieni candidati disponibili per grado_candidatura
router.get('/disponibili', verifyToken, async (req, res) => {
  try {
    const { grado_candidatura } = req.query;
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/test/disponibili - Richiesta ricevuta:', { grado_candidatura, userId });
    
    if (!grado_candidatura) {
      return res.status(400).json({
        success: false,
        error: 'Parametro grado_candidatura richiesto'
      });
    }
    
    // Query per ottenere utenti con ruolo "Candidato" o "Candidato Politico" 
    // e grado_candidatura corrispondente, limitato a massimo 4 risultati
    const candidatiQuery = `
      SELECT 
        id,
        nome,
        cognome,
        email,
        ruolo,
        status,
        avatar_config,
        grado_candidatura
      FROM users
      WHERE ruolo IN ('Candidato', 'Candidato Politico')
        AND grado_candidatura = $1
        AND status = 'attivo'
      ORDER BY nome, cognome
      LIMIT 4
    `;
    
    console.log('🔍 DEBUG - Query candidati:', candidatiQuery);
    console.log('🔍 DEBUG - Parametri:', [grado_candidatura]);
    
    const candidatiResult = await pool.query(candidatiQuery, [grado_candidatura]);
    const candidati = candidatiResult.rows;
    
    console.log('🔍 DEBUG - Candidati trovati:', candidati.length);
    candidati.forEach((candidato, index) => {
      console.log(`  ${index + 1}. ${candidato.nome} ${candidato.cognome} (${candidato.ruolo})`);
    });
    
    res.json({
      success: true,
      data: candidati,
      count: candidati.length,
      message: `Trovati ${candidati.length} candidati per grado_candidatura: ${grado_candidatura}`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati test:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i candidati'
    });
  }
});

module.exports = router;
