const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== ENDPOINTS PER SOSTENITORI =====

// GET /api/sostenitori - Ottieni sostenitori di un utente
router.get('/', async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
      });
    }

    const result = await pool.query(`
      SELECT 
        s.*,
        u.nome,
        u.cognome,
        u.ruolo,
        u.email
      FROM sostenitori s
      JOIN utenti u ON s.utente_id = u.id
      WHERE s.sostenuto_id = $1 AND s.status = 'active'
      ORDER BY s.data_adesione DESC
    `, [sostenuto_id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero sostenitori:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/sostenitori - Aggiungi sostenitore
router.post('/', async (req, res) => {
  try {
    const { utente_id, sostenuto_id } = req.body;
    
    if (!utente_id || !sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente e ID sostenuto sono obbligatori'
      });
    }

    if (utente_id === sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'Non puoi sostenere te stesso'
      });
    }

    // Verifica se il sostenitore esiste già
    const existingSostenitore = await pool.query(
      'SELECT id FROM sostenitori WHERE utente_id = $1 AND sostenuto_id = $2',
      [utente_id, sostenuto_id]
    );

    if (existingSostenitore.rows.length > 0) {
      // Aggiorna lo status a active se era inactive
      await pool.query(
        'UPDATE sostenitori SET status = $1, data_adesione = NOW() WHERE utente_id = $2 AND sostenuto_id = $3',
        ['active', utente_id, sostenuto_id]
      );
      
      return res.json({
        success: true,
        message: 'Sostenitore riattivato'
      });
    }

    // Aggiungi nuovo sostenitore
    const result = await pool.query(
      'INSERT INTO sostenitori (id, utente_id, sostenuto_id, data_adesione, status) VALUES (gen_random_uuid()::text, $1, $2, NOW(), $3) RETURNING *',
      [utente_id, sostenuto_id, 'active']
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta sostenitore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// DELETE /api/sostenitori - Rimuovi sostenitore
router.delete('/', async (req, res) => {
  try {
    const { utente_id, sostenuto_id } = req.body;
    
    if (!utente_id || !sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente e ID sostenuto sono obbligatori'
      });
    }

    // Imposta status a inactive invece di cancellare
    const result = await pool.query(
      'UPDATE sostenitori SET status = $1 WHERE utente_id = $2 AND sostenuto_id = $3',
      ['inactive', utente_id, sostenuto_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sostenitore non trovato'
      });
    }

    res.json({
      success: true,
      message: 'Sostenitore rimosso'
    });
  } catch (error) {
    console.error('❌ Errore nella rimozione sostenitore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/sostenitori/check - Verifica se un utente sostiene un altro
router.get('/check', async (req, res) => {
  try {
    const { utente_id, sostenuto_id } = req.query;
    
    if (!utente_id || !sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente e ID sostenuto sono obbligatori'
      });
    }

    const result = await pool.query(
      'SELECT status FROM sostenitori WHERE utente_id = $1 AND sostenuto_id = $2',
      [utente_id, sostenuto_id]
    );

    res.json({
      success: true,
      data: {
        isSostenitore: result.rows.length > 0,
        status: result.rows.length > 0 ? result.rows[0].status : null
      }
    });
  } catch (error) {
    console.error('❌ Errore nel controllo sostenitore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;