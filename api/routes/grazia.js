const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');

const router = express.Router();

// POST /api/grazia - Crea richiesta di grazia
router.post('/', verifyToken, validateInput(['nome_carcerato', 'motivo']), async (req, res) => {
  try {
    const { nome_carcerato, motivo } = req.body;
    const userId = req.userId;
    
    const query = `
      INSERT INTO richieste_grazia (utente_id, nome_carcerato, motivo, stato, created_at)
      VALUES ($1, $2, $3, 'in_attesa', NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, nome_carcerato, motivo]);
    
    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione richiesta grazia'
    });
  }
});

// GET /api/grazia - Ottieni richieste di grazia
router.get('/', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Chiamata endpoint /api/grazia');
    
    // Recupera userId se autenticato (opzionale)
    let userId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        console.log(`🔍 DEBUG: Utente autenticato: ${userId}`);
      } catch (authError) {
        console.log('⚠️ Token non valido o assente, continuando senza autenticazione');
      }
    }
    
    // SOLUZIONE: Uso solo voti_grazia senza JOIN problematico
    const query = `
      SELECT *
      FROM voti_grazia
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    console.log(`✅ Recuperati ${result.rows.length} record da voti_grazia`);
    
    // Creiamo una classifica Top 10 basata sul numero di voti per carcerato
    const classificaQuery = `
      SELECT nome, COUNT(*) as richieste
      FROM voti_grazia
      GROUP BY nome
      ORDER BY richieste DESC
      LIMIT 10
    `;
    
    const classificaResult = await pool.query(classificaQuery);
    console.log(`✅ Classifica creata con ${classificaResult.rows.length} carcerati`);
    
    // Recupera i voti dell'utente se autenticato
    let mieiVoti = [];
    if (userId) {
      try {
        const mieiVotiQuery = `
          SELECT nome
          FROM voti_grazia
          WHERE user_id = $1
          ORDER BY created_at DESC
        `;
        const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
        mieiVoti = mieiVotiResult.rows.map(row => row.nome);
        console.log(`✅ Recuperati ${mieiVoti.length} voti per utente ${userId}`);
      } catch (error) {
        console.error('⚠️ Errore nel recuperare voti utente:', error);
        // Continua senza voti utente
      }
    }
    
    res.json({
      success: true,
      classifica: classificaResult.rows,
      richieste: result.rows,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia',
      details: error.message
    });
  }
});

// GET /api/grazia/richieste - Ottieni richieste per gestione
router.get('/richieste', verifyToken, async (req, res) => {
  try {
    // SOLUZIONE: Uso solo voti_grazia senza JOIN problematico
    const query = `
      SELECT *
      FROM voti_grazia
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      richieste: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia'
    });
  }
});

// POST /api/grazia/vota - Salva voti grazia
router.post('/vota', verifyToken, validateInput(['voti']), async (req, res) => {
  try {
    const { voti } = req.body;
    // Usa req.userId con fallback a req.user.id per sicurezza
    const userId = req.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    if (!Array.isArray(voti)) {
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }
    
    // Limita a massimo 1 voto come da limite configurato
    if (voti.length > 1) {
      return res.status(400).json({
        success: false,
        error: 'Puoi selezionare al massimo 1 carcerato per Grazia'
      });
    }
    
    // Elimina i voti esistenti
    await pool.query('DELETE FROM voti_grazia WHERE user_id = $1', [userId]);
    
    // Inserisci i nuovi voti
    for (const nome of voti) {
      await pool.query(
        'INSERT INTO voti_grazia (user_id, nome, created_at) VALUES ($1, $2, NOW())',
        [userId, nome]
      );
    }
    
    res.json({ success: true, message: 'Voti grazia salvati' });
  } catch (error) {
    console.error('❌ Errore nel salvare voti grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voti grazia',
      details: error.message
    });
  }
});

// POST /api/grazia/richiesta/:id/:action - Gestisci richiesta grazia
router.post('/richiesta/:id/:action', verifyToken, async (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (action === 'approve') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['approvata', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['rifiutata', id]);
    }
    
    res.json({ success: true, message: `Richiesta ${action === 'approve' ? 'approvata' : 'rifiutata'}` });
  } catch (error) {
    console.error('❌ Errore nella gestione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella gestione richiesta grazia'
    });
  }
});

module.exports = router;
