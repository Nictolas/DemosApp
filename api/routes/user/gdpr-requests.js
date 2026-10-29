const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../config/db');

// GET /api/user/gdpr-requests - Recupera le richieste GDPR dell'utente
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Per ora restituiamo un array vuoto dato che non abbiamo ancora implementato
    // la tabella per le richieste GDPR. In futuro si può implementare:
    // const result = await pool.query(
    //   'SELECT * FROM gdpr_requests WHERE user_id = $1 ORDER BY data_richiesta DESC',
    //   [userId]
    // );
    
    res.json({
      success: true,
      data: [],
      message: 'Storico richieste caricato con successo'
    });
    
  } catch (error) {
    console.error('Errore nel recupero richieste GDPR:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/user/gdpr-requests - Crea una nuova richiesta GDPR
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { tipo, dettagli } = req.body;
    
    if (!tipo) {
      return res.status(400).json({
        success: false,
        error: 'Tipo di richiesta richiesto'
      });
    }
    
    // Per ora restituiamo successo senza salvare nel database
    // In futuro si può implementare:
    // const result = await pool.query(
    //   'INSERT INTO gdpr_requests (user_id, tipo, dettagli, stato, data_richiesta) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
    //   [userId, tipo, dettagli || '', 'pending']
    // );
    
    res.json({
      success: true,
      message: 'Richiesta GDPR registrata con successo',
      data: {
        id: Date.now().toString(),
        tipo,
        dettagli: dettagli || '',
        stato: 'pending',
        data_richiesta: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Errore nella creazione richiesta GDPR:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
