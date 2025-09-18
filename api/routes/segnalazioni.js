const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const router = express.Router();

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// POST /api/segnalazioni - Invia segnalazione agli admin
router.post('/', async (req, res) => {
  try {
    const {
      type,
      title,
      description,
      priority,
      steps,
      expected,
      actual,
      browser,
      device,
      userId,
      userEmail
    } = req.body;

    // Validazione campi obbligatori
    if (!type || !title || !description || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Campi obbligatori mancanti: type, title, description, userId'
      });
    }

    // Genera ID univoco per la segnalazione
    const segnalazioneId = crypto.randomUUID();

    // 1. Salva la segnalazione nella tabella segnalazioni
    await pool.query(`
      INSERT INTO segnalazioni (
        id, utente_id, tipo, titolo, descrizione, priorita, passaggi, 
        comportamento_atteso, comportamento_effettivo, browser, dispositivo, 
        status, data_creazione, data_aggiornamento, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      segnalazioneId,
      userId,
      type,
      title,
      description,
      priority || 'medium',
      steps || '',
      expected || '',
      actual || '',
      browser || '',
      device || '',
      'aperta',
      new Date(),
      new Date(),
      JSON.stringify({
        userEmail: userEmail || '',
        timestamp: new Date().toISOString()
      })
    ]);

    // 2. Trova tutti gli utenti admin
    const adminQuery = await pool.query(
      'SELECT id, email, nome, cognome FROM utenti WHERE is_admin = true'
    );

    if (adminQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nessun utente admin trovato'
      });
    }

    console.log(`✅ Segnalazione salvata con successo`);
    console.log('📋 Segnalazione ID:', segnalazioneId);
    console.log(`👥 Admin che riceveranno la notifica: ${adminQuery.rows.length}`);

    res.json({
      success: true,
      message: 'Segnalazione inviata con successo',
      segnalazioneId,
      adminCount: adminQuery.rows.length
    });

  } catch (error) {
    console.error('❌ Errore nell\'invio segnalazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/segnalazioni/admin/:adminId - Ottieni segnalazioni per un admin specifico
router.get('/admin/:adminId', async (req, res) => {
  try {
    const { adminId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT 
        s.*,
        u.nome as utente_nome,
        u.cognome as utente_cognome,
        u.email as utente_email
      FROM segnalazioni s
      LEFT JOIN utenti u ON s.utente_id = u.id
      ORDER BY s.data_creazione DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      segnalazioni: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Errore nel recupero segnalazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// PUT /api/segnalazioni/:id/read - Marca segnalazione come letta
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE segnalazioni 
      SET status = 'letta', data_aggiornamento = NOW()
      WHERE id = $1
    `, [id]);

    res.json({
      success: true,
      message: 'Segnalazione marcata come letta'
    });

  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento segnalazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
