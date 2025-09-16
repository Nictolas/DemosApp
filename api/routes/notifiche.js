const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  // Usa sempre Neon per ora
  connectionString: 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
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
    
    // Recupera le comunicazioni con lo status specifico per l'utente
    const comunicazioniResult = await pool.query(`
      SELECT
        c.*,
        nu.status as user_status,
        nu.data_lettura
      FROM comunicazioni c
      LEFT JOIN notifiche_utente nu ON c.id = nu.comunicazione_id AND nu.utente_id = $1
      WHERE c.tipo = 'demos_notification'
      ORDER BY c.data_creazione DESC
      LIMIT 10
    `, [user_id]);
    
    const comunicazioni = comunicazioniResult.rows.map(c => ({
      id: c.id,
      titolo: c.titolo,
      messaggio: c.testo || c.commento || 'Nessun messaggio',
      data_creazione: c.data_creazione,
      tipo_notifica: 'demos_notification',
      status: c.user_status || 'non_letta', // Usa lo status specifico per l'utente
      priorita: 'alta',
      commento: c.commento,
      data_lettura: c.data_lettura
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

// PUT /api/notifiche/:id/read - Marca notifica come letta per l'utente specifico
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    console.log('📖 Marcatura notifica come letta per utente:', user_id, 'comunicazione:', id);
    
    // Aggiorna lo status della notifica per l'utente specifico
    const result = await pool.query(`
      UPDATE notifiche_utente 
      SET status = 'letta', data_lettura = NOW()
      WHERE comunicazione_id = $1 AND utente_id = $2
      RETURNING *
    `, [id, user_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notifica non trovata per questo utente'
      });
    }
    
    console.log('✅ Notifica marcata come letta per utente:', user_id);
    
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

// PUT /api/notifiche/mark-all-read - Marca tutte le notifiche come lette per l'utente specifico
router.put('/mark-all-read', async (req, res) => {
  try {
    const { notifica_ids, user_id } = req.body;
    
    if (!notifica_ids || !Array.isArray(notifica_ids) || notifica_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array di ID notifiche richiesto'
      });
    }
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    console.log('📖 Marcatura di', notifica_ids.length, 'notifiche come lette per utente:', user_id);
    
    // Aggiorna tutte le notifiche per l'utente specifico
    const result = await pool.query(`
      UPDATE notifiche_utente 
      SET status = 'letta', data_lettura = NOW()
      WHERE comunicazione_id = ANY($1) AND utente_id = $2
      RETURNING *
    `, [notifica_ids, user_id]);
    
    console.log('✅ Notifiche marcate come lette per utente:', result.rows.length);
    
    res.json({
      success: true,
      message: `${result.rows.length} notifiche marcate come lette`,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel marcare notifiche come lette:', error);
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
