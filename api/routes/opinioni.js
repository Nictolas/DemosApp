const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/opinioni/profile - Ottieni opinioni per profilo utente
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Query per ottenere le domande delle opinioni dalla tabella opinioni
    const opinionQuery = `
      SELECT DISTINCT o.grado_opinione, o.text
      FROM opinioni o
      ORDER BY o.grado_opinione, o.text
    `;
    
    const opinionResult = await pool.query(opinionQuery);
    
    // Formatta le domande per il frontend
    const questions = opinionResult.rows.map(row => ({
      id: `${row.grado_opinione}_${row.text.replace(/\s+/g, '_')}`,
      text: `${row.grado_opinione}: ${row.text}`
    }));
    
    // Query per ottenere le risposte dell'utente dalla tabella utenti
    const userQuery = `
      SELECT energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
             carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const userAnswers = userResult.rows[0] || {};
    
    res.json({
      success: true,
      data: {
        questions: questions,
        userAnswers: userAnswers
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni'
    });
  }
});

// GET /api/opinioni - Ottieni tutte le opinioni (per gestione)
router.get('/', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT o.*, o.grado_opinione as categoria_nome
      FROM opinioni o
      ORDER BY o.grado_opinione, o.text
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      opinioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni'
    });
  }
});

// GET /api/opinioni-proposte - Ottieni opinioni proposte
router.get('/proposte', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM opinioni_proposte 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      opinioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni proposte:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni proposte'
    });
  }
});

// GET /api/opinioni-list - Ottieni opinioni per grado
router.get('/opinioni-list', verifyToken, async (req, res) => {
  try {
    const { grado } = req.query;
    const userId = req.userId;
    
    // Query per ottenere le opinioni dalla tabella opinioni usando il campo grado_opinione
    const query = `
      SELECT o.*, o.grado_opinione as categoria_nome
      FROM opinioni o
      WHERE o.grado_opinione = $1
      ORDER BY o.text
    `;
    
    const result = await pool.query(query, [grado]);
    
    // Query per ottenere le risposte dell'utente dalla tabella utenti
    const userQuery = `
      SELECT energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
             carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const userAnswers = userResult.rows[0] || {};
    
    // Mappa le opinioni con le risposte dell'utente
    const opinioniWithAnswers = result.rows.map(opinione => {
      // Cerca la risposta corrispondente nelle colonne opinioni dell'utente
      const opinioneKey = opinione.text?.toLowerCase().replace(/\s+/g, '_');
      let userAnswer = null;
      
      // Mappa le opinioni specifiche
      if (opinioneKey?.includes('energia_nucleare')) {
        userAnswer = userAnswers.energia_nucleare;
      } else if (opinioneKey?.includes('sperimentazione_animale')) {
        userAnswer = userAnswers.sperimentazione_animale;
      } else if (opinioneKey?.includes('legalizzazione_canapa')) {
        userAnswer = userAnswers.legalizzazione_canapa;
      } else if (opinioneKey?.includes('caccia')) {
        userAnswer = userAnswers.caccia;
      } else if (opinioneKey?.includes('eutanasia')) {
        userAnswer = userAnswers.eutanasia;
      } else if (opinioneKey?.includes('carne_coltivata')) {
        userAnswer = userAnswers.carne_coltivata;
      } else if (opinioneKey?.includes('cittadina_animale')) {
        userAnswer = userAnswers.cittadina_animale;
      } else if (opinioneKey?.includes('nato')) {
        userAnswer = userAnswers.nato;
      } else if (opinioneKey?.includes('matrimonio_gay')) {
        userAnswer = userAnswers.matrimonio_gay;
      } else if (opinioneKey?.includes('salario_minimo')) {
        userAnswer = userAnswers.salario_minimo;
      } else if (opinioneKey?.includes('case_chiuse')) {
        userAnswer = userAnswers.case_chiuse;
      } else if (opinioneKey?.includes('omobitransfobia')) {
        userAnswer = userAnswers.omobitransfobia;
      }
      
      return {
        ...opinione,
        userAnswer: userAnswer
      };
    });
    
    res.json({
      success: true,
      opinioni: opinioniWithAnswers
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni per grado:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni per grado'
    });
  }
});

// GET /api/opinioni/user-answers - Ottieni risposte utente per opinioni
router.get('/user-answers', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    const query = `
      SELECT energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
             carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia
      FROM users
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      userAnswers: result.rows[0] || {}
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare risposte utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare risposte utente'
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
