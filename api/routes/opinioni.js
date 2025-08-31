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
    
    console.log('🔍 GET /api/opinioni-list - Richiesta opinioni per grado:', grado);
    console.log('👤 User ID:', userId);
    
    // Query per ottenere le opinioni dalla tabella opinioni usando il campo grado_opinione
    const query = `
      SELECT o.*, o.grado_opinione as categoria_nome
      FROM opinioni o
      WHERE o.grado_opinione = $1
      ORDER BY o.text
    `;
    
    console.log('📝 Query opinioni:', query);
    console.log('🔍 Parametro grado:', grado);
    
    const result = await pool.query(query, [grado]);
    
    console.log('📊 Risultati opinioni:', result.rows.length);
    if (result.rows.length === 0) {
      console.log('⚠️ Nessuna opinione trovata per grado:', grado);
      console.log('🔍 Verifico se esistono opinioni nella tabella...');
      
      // Query per vedere tutte le opinioni disponibili
      const allOpinionsQuery = 'SELECT DISTINCT grado_opinione, COUNT(*) as count FROM opinioni GROUP BY grado_opinione';
      const allOpinionsResult = await pool.query(allOpinionsQuery);
      console.log('📋 Tutte le opinioni disponibili:', allOpinionsResult.rows);
    } else {
      console.log('✅ Prime 3 opinioni trovate:', result.rows.slice(0, 3));
    }
    
    // Query per ottenere le risposte dell'utente dalla tabella utenti
    const userQuery = `
      SELECT energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
             carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia
      FROM users
      WHERE id = $1
    `;
    
    console.log('👤 Query utente:', userQuery);
    console.log('🔍 User ID per query:', userId);
    
    const userResult = await pool.query(userQuery, [userId]);
    const userAnswers = userResult.rows[0] || {};
    
    console.log('📊 Risposte utente trovate:', Object.keys(userAnswers).length);
    console.log('🔍 Esempi risposte:', Object.entries(userAnswers).slice(0, 3));
    
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
    
    console.log('📤 Invio risposta con', opinioniWithAnswers.length, 'opinioni');
    
    res.json({
      success: true,
      opinioni: opinioniWithAnswers
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni per grado:', error);
    console.error('📋 Stack trace completo:', error.stack);
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

// GET /api/opinioni/debug - Endpoint di debug per verificare struttura tabella
router.get('/debug', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG - Verifico struttura tabella opinioni...');
    
    // 1. Verifica esistenza tabella
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'opinioni'
      );
    `;
    
    const tableExistsResult = await pool.query(tableExistsQuery);
    const tableExists = tableExistsResult.rows[0].exists;
    
    console.log('📋 Tabella opinioni esiste:', tableExists);
    
    if (!tableExists) {
      return res.json({
        success: false,
        error: 'Tabella opinioni non trovata',
        message: 'La tabella opinioni non esiste nel database'
      });
    }
    
    // 2. Verifica struttura tabella
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      ORDER BY ordinal_position;
    `;
    
    const structureResult = await pool.query(structureQuery);
    
    // 3. Conta righe totali
    const countQuery = 'SELECT COUNT(*) as total FROM opinioni';
    const countResult = await pool.query(countQuery);
    const totalRows = countResult.rows[0].total;
    
    // 4. Verifica gradi disponibili
    const degreesQuery = 'SELECT DISTINCT grado_opinione, COUNT(*) as count FROM opinioni GROUP BY grado_opinione';
    const degreesResult = await pool.query(degreesQuery);
    
    // 5. Esempi di opinioni
    const examplesQuery = 'SELECT * FROM opinioni LIMIT 3';
    const examplesResult = await pool.query(examplesQuery);
    
    console.log('📊 DEBUG completato - Righe totali:', totalRows);
    
    res.json({
      success: true,
      debug: {
        tableExists,
        totalRows: parseInt(totalRows),
        structure: structureResult.rows,
        degrees: degreesResult.rows,
        examples: examplesResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore debug tabella opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante debug',
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
