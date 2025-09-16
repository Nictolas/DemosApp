const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  // Usa sempre Neon per ora
  connectionString: 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
}); // Usa la stessa configurazione degli altri endpoint

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
      status: c.status || 'non_letta', // Usa lo status dal database
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

// PUT /api/notifiche/:id/read - Marca notifica come letta
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📖 Marcatura notifica come letta:', id);
    
    // Aggiorna lo status della notifica a 'letta'
    const result = await pool.query(
      'UPDATE comunicazioni SET status = $1 WHERE id = $2 RETURNING *',
      ['letta', id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notifica non trovata'
      });
    }
    
    console.log('✅ Notifica marcata come letta:', id);
    
    res.json({
      success: true,
      message: 'Notifica marcata come letta',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel marcare notifica come letta:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
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
