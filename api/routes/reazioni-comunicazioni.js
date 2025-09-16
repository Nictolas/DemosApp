const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== ENDPOINTS PER REAZIONI COMUNICAZIONI =====

// POST /api/reazioni-comunicazioni - Aggiungi like/dislike
router.post('/', async (req, res) => {
  try {
    const { comunicazione_id, utente_id, tipo } = req.body;
    
    if (!comunicazione_id || !utente_id || !tipo) {
      return res.status(400).json({
        success: false,
        error: 'ID comunicazione, ID utente e tipo sono obbligatori'
      });
    }

    if (!['like', 'dislike'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo deve essere "like" o "dislike"'
      });
    }

    // Verifica se l'utente ha già reagito a questa comunicazione
    const existingReaction = await pool.query(
      'SELECT id, tipo FROM reazioni WHERE comunicazione_id = $1 AND utente_id = $2',
      [comunicazione_id, utente_id]
    );

    if (existingReaction.rows.length > 0) {
      const existingTipo = existingReaction.rows[0].tipo;
      
      if (existingTipo === tipo) {
        // Rimuovi la reazione se è la stessa
        await pool.query(
          'DELETE FROM reazioni WHERE comunicazione_id = $1 AND utente_id = $2',
          [comunicazione_id, utente_id]
        );
        
        return res.json({
          success: true,
          action: 'removed',
          message: 'Reazione rimossa'
        });
      } else {
        // Aggiorna il tipo di reazione
        await pool.query(
          'UPDATE reazioni SET tipo = $1, data_aggiornamento = NOW() WHERE comunicazione_id = $2 AND utente_id = $3',
          [tipo, comunicazione_id, utente_id]
        );
        
        return res.json({
          success: true,
          action: 'updated',
          message: 'Reazione aggiornata'
        });
      }
    } else {
      // Aggiungi nuova reazione
      const result = await pool.query(
        'INSERT INTO reazioni (id, comunicazione_id, utente_id, tipo, data_creazione, data_aggiornamento) VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW()) RETURNING *',
        [comunicazione_id, utente_id, tipo]
      );
      
      return res.json({
        success: true,
        action: 'added',
        data: result.rows[0],
        message: 'Reazione aggiunta'
      });
    }
  } catch (error) {
    console.error('❌ Errore nella gestione reazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/reazioni-comunicazioni/:comunicazione_id - Ottieni reazioni per una comunicazione
router.get('/:comunicazione_id', async (req, res) => {
  try {
    const { comunicazione_id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        tipo,
        COUNT(*) as count
      FROM reazioni 
      WHERE comunicazione_id = $1 
      GROUP BY tipo`,
      [comunicazione_id]
    );
    
    const reazioni = {
      likes: 0,
      dislikes: 0
    };
    
    result.rows.forEach(row => {
      if (row.tipo === 'like') {
        reazioni.likes = parseInt(row.count);
      } else if (row.tipo === 'dislike') {
        reazioni.dislikes = parseInt(row.count);
      }
    });
    
    res.json({
      success: true,
      data: reazioni
    });
  } catch (error) {
    console.error('❌ Errore nel recupero reazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/reazioni-comunicazioni/user/:utente_id/:comunicazione_id - Verifica reazione utente
router.get('/user/:utente_id/:comunicazione_id', async (req, res) => {
  try {
    const { utente_id, comunicazione_id } = req.params;
    
    const result = await pool.query(
      'SELECT tipo FROM reazioni WHERE utente_id = $1 AND comunicazione_id = $2',
      [utente_id, comunicazione_id]
    );
    
    res.json({
      success: true,
      data: result.rows.length > 0 ? result.rows[0].tipo : null
    });
  } catch (error) {
    console.error('❌ Errore nel recupero reazione utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;