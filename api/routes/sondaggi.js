const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/sondaggi - Ottieni tutti i sondaggi (opinioni aggregate)
router.get('/', verifyToken, async (req, res) => {
  try {
    // 1. Prima recupera le domande dalla tabella opinioni
    const questionsQuery = `
      SELECT id, text
      FROM opinioni 
      ORDER BY text
      LIMIT 10
    `;
    
    const questionsResult = await pool.query(questionsQuery);
    const opinioni = questionsResult.rows;
    
    // 2. Poi genera statistiche aggregate dalle risposte degli utenti
    const stats = {};
    const questions = [];
    
    for (const opinione of opinioni) {
      const questionId = opinione.id;
      const questionText = opinione.text;
      
      // Mappa l'ID dell'opinione alla colonna corretta nella tabella users
      let columnName;
      switch (questionId) {
        case 'energia_nucleare':
          columnName = 'energia_nucleare';
          break;
        case 'sperimentazione_animale':
          columnName = 'sperimentazione_animale';
          break;
        case 'legalizzazione_canapa':
          columnName = 'legalizzazione_canapa';
          break;
        case 'caccia':
          columnName = 'caccia';
          break;
        case 'eutanasia':
          columnName = 'eutanasia';
          break;
        case 'carne_coltivata':
          columnName = 'carne_coltivata';
          break;
        case 'cittadina_animale':
          columnName = 'cittadina_animale';
          break;
        case 'nato':
          columnName = 'nato';
          break;
        case 'matrimonio_gay':
          columnName = 'matrimonio_gay';
          break;
        case 'salario_minimo':
          columnName = 'salario_minimo';
          break;
        case 'case_chiuse':
          columnName = 'case_chiuse';
          break;
        case 'omobitransfobia':
          columnName = 'omobitransfobia';
          break;
        default:
          console.log(`⚠️ DEBUG: ID opinione non mappato: ${questionId}`);
          continue; // Salta questa opinione se non è mappata
      }
      
      // Query per contare le risposte per questa opinione
      const statsQuery = `
        SELECT 
          COUNT(*) as totale_voti,
          COUNT(CASE WHEN ${columnName} = 'Favorevole' THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${columnName} = 'Contrario' THEN 1 END) as contrario,
          COUNT(CASE WHEN ${columnName} = 'Indeciso' THEN 1 END) as indeciso,
          COUNT(CASE WHEN ${columnName} = 'Astenuto' THEN 1 END) as astenuto
        FROM users 
        WHERE ${columnName} IS NOT NULL
      `;
      
      try {
        const statsResult = await pool.query(statsQuery);
        const row = statsResult.rows[0];
        
        stats[questionId] = {
          favorevole: parseInt(row.favorevole) || 0,
          contrario: parseInt(row.contrario) || 0,
          indeciso: parseInt(row.indeciso) || 0,
          astenuto: parseInt(row.astenuto) || 0
        };
        
        questions.push({
          id: questionId,
          text: questionText
        });
      } catch (statsError) {
        console.log(`⚠️ Errore nel recuperare statistiche per opinione ${questionId}:`, statsError.message);
        // Se la colonna non esiste, salta questa opinione
        continue;
      }
    }
    
    res.json({
      success: true,
      data: {
        stats,
        questions
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi'
    });
  }
});

// GET /api/sondaggi/stats - Statistiche generali
router.get('/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as totale_utenti,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as utenti_attivi,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as utenti_in_attesa
      FROM users
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche sondaggi'
    });
  }
});

// GET /api/sondaggi/genere - Statistiche per genere
router.get('/genere', async (req, res) => {
  try {
    const query = `
      SELECT 
        genere,
        COUNT(*) as totale
      FROM users 
      WHERE genere IS NOT NULL
      GROUP BY genere
      ORDER BY totale DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      stats: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere'
    });
  }
});

module.exports = router;
