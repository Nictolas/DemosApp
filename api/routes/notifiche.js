const express = require('express');
const router = express.Router();
const { pool } = require('../config/db'); // Usa la stessa configurazione degli altri endpoint

// ===== ENDPOINTS PER NOTIFICHE =====

// GET /api/notifiche - Lista notifiche per utente (include comunicazioni)
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    console.log('🔍 DEBUG: Recupero notifiche per user_id:', user_id);
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    // Versione di test: restituisce solo le comunicazioni Demos
    const comunicazioniResult = await pool.query(`
      SELECT
        c.*
      FROM comunicazioni c
      WHERE c.tipo = 'demos_notification'
      ORDER BY c.data_creazione DESC
      LIMIT 10
    `);
    
    const comunicazioni = comunicazioniResult.rows.map(c => ({
      id: c.id,
      titolo: c.titolo,
      messaggio: c.testo || c.commento || 'Nessun messaggio',
      data_creazione: c.data_creazione,
      tipo_notifica: 'demos_notification',
      status: 'non_letta',
      priorita: 'alta',
      commento: c.commento
    }));
    
    console.log('🔍 DEBUG: Comunicazioni Demos trovate:', comunicazioni.length);
    
    res.json({
      success: true,
      notifiche: comunicazioni
    });
  } catch (error) {
    console.error('❌ Errore nel recupero notifiche:', error);
    
    // Se è un errore di connessione database, restituisci un messaggio più specifico
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(500).json({
        success: false,
        error: 'Errore connessione database',
        details: 'Il server non riesce a connettersi al database. Controllare la configurazione DATABASE_URL su Render.',
        debug: {
          code: error.code,
          message: error.message,
          database_url_present: !!process.env.DATABASE_URL,
          db_host: process.env.DB_HOST
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// POST /api/notifiche - Crea nuova notifica
router.post('/', async (req, res) => {
  try {
    const { user_id, titolo, messaggio, tipo } = req.body;
    
    if (!user_id || !titolo || !messaggio) {
      return res.status(400).json({
        success: false,
        error: 'ID utente, titolo e messaggio sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO notifiche (user_id, titolo, messaggio, tipo, data_creazione) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [user_id, titolo, messaggio, tipo]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione notifica:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
