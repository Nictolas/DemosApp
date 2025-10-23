const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');

const router = express.Router();

// GET /api/opinioni/opinioni-list - Endpoint per frontend (compatibilità)
router.get('/opinioni-list', verifyToken, async (req, res) => {
  try {
    const { grado } = req.query;
    const userId = req.userId;
    
    console.log('🔍 GET /api/opinioni/opinioni-list - Richiesta opinioni per grado:', grado);
    console.log('👤 User ID:', userId);
    
    if (!grado) {
      return res.status(400).json({
        success: false,
        error: 'Grado richiesto',
        message: 'Il parametro grado è obbligatorio'
      });
    }
    
    // Query per ottenere le opinioni del grado specificato
    // I gradi nel database sono già compressi, quindi usiamo direttamente il grado ricevuto
    const gradoCompleto = grado;
    
    const opinionQuery = `
      SELECT o.id, o.text, o.gradi_opinione
      FROM opinioni_domande o
      WHERE $1 = ANY(o.gradi_opinione)
      ORDER BY o.text
    `;
    
    const opinionResult = await pool.query(opinionQuery, [gradoCompleto]);
    
    console.log(`🔍 DEBUG - Query per grado ${grado} (${gradoCompleto}):`, opinionQuery);
    console.log(`🔍 DEBUG - Parametri query:`, [gradoCompleto]);
    console.log(`🔍 DEBUG - Risultati trovati:`, opinionResult.rows.length);
    console.log(`🔍 DEBUG - Prime 3 opinioni:`, opinionResult.rows.slice(0, 3).map(o => ({ text: o.text, gradi: o.gradi_opinione })));
    
    if (opinionResult.rows.length === 0) {
      console.log(`⚠️ Nessuna opinione trovata per il grado: ${grado}`);
      return res.json({
        success: true,
        data: [],
        message: `Nessuna opinione trovata per il grado: ${grado}`
      });
    }
    
    // Query per ottenere le risposte dell'utente dalla tabella opinioni_risposte
    const userQuery = `
      SELECT o.text, or.risposta
      FROM opinioni_domande o
      LEFT JOIN opinioni_risposte or ON o.id = or.opinione_id AND or.user_id = $1
      WHERE $2 = ANY(o.gradi_opinione)
    `;
    
    const userResult = await pool.query(userQuery, [userId, gradoCompleto]);
    const userAnswers = {};
    userResult.rows.forEach(row => {
      const opinionKey = row.text.replace(/\s+/g, '_').toLowerCase();
      userAnswers[opinionKey] = row.risposta;
    });
    
    console.log('🔍 DEBUG - User answers caricate:', Object.keys(userAnswers).length);
    console.log('🔍 DEBUG - User answers sample:', Object.keys(userAnswers).slice(0, 5).map(key => `${key}: ${userAnswers[key]}`));
    
    // Formatta le opinioni per il frontend
    const formattedOpinions = opinionResult.rows.map(opinion => {
      // Usa il testo dell'opinione per ottenere la risposta dell'utente
      const opinionKey = opinion.text.replace(/\s+/g, '_').toLowerCase();
      const userAnswer = userAnswers[opinionKey];
      
      console.log(`🔍 DEBUG - Mappatura opinione:`, {
        text: opinion.text,
        opinionKey: opinionKey,
        userAnswer: userAnswer
      });
      
      // Restituisci direttamente i valori compressi dal database
      let frontendAnswer = null;
      if (userAnswer === 'f' || userAnswer === 'c' || userAnswer === 'i') {
        frontendAnswer = userAnswer;
      } else if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
        frontendAnswer = null;
      }
      
      return {
        id: opinionKey,
        text: opinion.text,
        grado: opinion.gradi_opinione,
        userAnswer: frontendAnswer
      };
    });
    
    console.log(`✅ Trovate ${formattedOpinions.length} opinioni per grado: ${grado}`);
    
    res.json({
      success: true,
      data: formattedOpinions,
      grado: grado,
      total: formattedOpinions.length
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni per grado:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le opinioni'
    });
  }
});

// GET /api/opinioni/proposte - Ottieni tutte le opinioni (per gestione)
router.get('/proposte', async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni/proposte - Richiesta opinioni per gestione');
    console.log('🔍 Headers:', req.headers);
    console.log('🔍 Query params:', req.query);
    
    const query = `
      SELECT id, text, gradi_opinione, approfondimento
      FROM opinioni_domande
      ORDER BY text
    `;
    
    console.log('🔍 Esecuzione query:', query);
    const result = await pool.query(query);
    console.log('🔍 Query result:', result.rows.length, 'rows');
    
    console.log(`✅ Trovate ${result.rows.length} opinioni per gestione`);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le opinioni'
    });
  }
});

module.exports = router;
