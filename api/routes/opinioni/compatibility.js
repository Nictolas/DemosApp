const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');

const { getOpinionsForGrade, getAllOpinions, sortOpinionsByText } = require('../../services/opinionCatalog');
const { normalizeOpinionScope } = require('../../services/politicalJurisdictionRegistryService');

const router = express.Router();

// GET /api/opinioni/opinioni-list - Endpoint per frontend (compatibilità)
router.get('/opinioni-list', verifyToken, async (req, res) => {
  try {
    const { grado } = req.query;
    const userId = req.userId;
    
    console.log('🔍 GET /api/opinioni/opinioni-list - Richiesta opinioni per grado:', grado);
    
    if (!grado) {
      return res.status(400).json({
        success: false,
        error: 'Grado richiesto',
        message: 'Il parametro grado è obbligatorio'
      });
    }
    
    const gradoCompleto = normalizeOpinionScope(String(grado)) || String(grado);
    const opinionResult = { rows: sortOpinionsByText(getOpinionsForGrade(gradoCompleto)) };

    if (opinionResult.rows.length === 0) {
      console.log(`⚠️ Nessuna opinione trovata per il grado: ${grado}`);
      return res.json({
        success: true,
        data: [],
        message: `Nessuna opinione trovata per il grado: ${grado}`
      });
    }
    
    // Read only the answer columns for this grade. These identifiers come
    // from the validated code catalog, never from client-provided text.
    const columns = opinionResult.rows.map(op => '"' + op.id + '"');
    const answersResult = await pool.query(
      `SELECT ${columns.join(', ')} FROM opinioni_risposte WHERE user_id = $1`,
      [userId]
    );
    const answers = answersResult.rows[0] || {};

    // Formatta le opinioni per il frontend
    const formattedOpinions = opinionResult.rows.map(opinion => {
      // The answer-column ID is the stable published ID. Never create an
      // alternate ID by normalizing UI text (including accent/apostrophe).
      const userAnswer = answers[opinion.id] ?? null;

      // Restituisci direttamente i valori compressi dal database
      let frontendAnswer = null;
      if (userAnswer === 'f' || userAnswer === 'c' || userAnswer === 'i') {
        frontendAnswer = userAnswer;
      } else if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
        frontendAnswer = null;
      }
      
      return {
        id: opinion.id,
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
router.get('/proposte', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni/proposte - Richiesta opinioni per gestione');
    
    const result = {rows: sortOpinionsByText(getAllOpinions())};
    // Debug: log dei primi 3 risultati per vedere la struttura
    console.log('🔍 DEBUG - Prime 3 opinioni con gradi_opinione:', result.rows.slice(0, 3).map(row => ({
      id: row.id,
      text: row.text,
      gradi_opinione: row.gradi_opinione
    })));
    
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
