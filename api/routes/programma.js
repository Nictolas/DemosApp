const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER PROGRAMMA =====

// GET /api/programma - Lista programmi
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM programmi ORDER BY data_creazione DESC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero programmi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/programma/:userId - Recupera programma di un utente specifico
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    const result = await pool.query(
      'SELECT proposta_1, proposta_2, proposta_3, proposta_4, proposta_5, url_1, url_2, url_3, url_4, url_5, created_at, updated_at FROM programmi WHERE utente_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Programma non trovato per questo utente'
      });
    }
    
    const programma = result.rows[0];
    
    const responseData = {
      success: true,
      data: {
        proposta1: programma.proposta_1 || '',
        proposta2: programma.proposta_2 || '',
        proposta3: programma.proposta_3 || '',
        proposta4: programma.proposta_4 || '',
        proposta5: programma.proposta_5 || '',
        url1: programma.url_1 || '',
        url2: programma.url_2 || '',
        url3: programma.url_3 || '',
        url4: programma.url_4 || '',
        url5: programma.url_5 || '',
        data_creazione: programma.created_at,
        data_modifica: programma.updated_at
      }
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Errore nel recupero programma utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/programma - Crea o aggiorna programma
router.post('/', async (req, res) => {
  try {
    const { 
      utente_id, 
      proposta_1, proposta_2, proposta_3, proposta_4, proposta_5,
      url_1, url_2, url_3, url_4, url_5
    } = req.body;
    
    if (!utente_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    // Usa UPSERT per creare o aggiornare il programma
    const result = await pool.query(`
      INSERT INTO programmi (
        utente_id, proposta_1, proposta_2, proposta_3, proposta_4, proposta_5,
        url_1, url_2, url_3, url_4, url_5, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (utente_id) 
      DO UPDATE SET 
        proposta_1 = EXCLUDED.proposta_1,
        proposta_2 = EXCLUDED.proposta_2,
        proposta_3 = EXCLUDED.proposta_3,
        proposta_4 = EXCLUDED.proposta_4,
        proposta_5 = EXCLUDED.proposta_5,
        url_1 = EXCLUDED.url_1,
        url_2 = EXCLUDED.url_2,
        url_3 = EXCLUDED.url_3,
        url_4 = EXCLUDED.url_4,
        url_5 = EXCLUDED.url_5,
        updated_at = NOW()
      RETURNING *
    `, [
      utente_id, 
      proposta_1 || '', proposta_2 || '', proposta_3 || '', proposta_4 || '', proposta_5 || '',
      url_1 || '', url_2 || '', url_3 || '', url_4 || '', url_5 || ''
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione/aggiornamento programma:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
