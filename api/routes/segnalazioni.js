const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// POST /api/segnalazioni - Invia segnalazione agli admin
// L'identità dell'autore deriva esclusivamente dal token autenticato.
router.post('/', verifyToken, async (req, res) => {
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
      device
    } = req.body;

    const userId = req.user.id;

    // Validazione campi obbligatori
    if (!type || !title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Campi obbligatori mancanti: type, title, description'
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
        timestamp: new Date().toISOString()
      })
    ]);

    // 2. Trova gli amministratori secondo il ruolo usato dal middleware requireAdmin
    const adminQuery = await pool.query(
      "SELECT id, nome, cognome FROM users WHERE ruolo = 'AD'"
    );

    if (adminQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nessun utente admin trovato'
      });
    }

    console.log('✅ Segnalazione salvata con successo');
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

// GET /api/segnalazioni/admin/:adminId - Compatibilità endpoint admin legacy.
// L'adminId nel path non concede alcun privilegio: conta solo il token autenticato.
router.get('/admin/:adminId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const result = await pool.query(`
      SELECT
        s.*,
        u.nome as utente_nome,
        u.cognome as utente_cognome,
        u.email as utente_email
      FROM segnalazioni s
      LEFT JOIN users u ON s.utente_id::uuid = u.id
      ORDER BY s.data_creazione DESC
      LIMIT $1 OFFSET $2
    `, [safeLimit, safeOffset]);

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

// PUT /api/segnalazioni/:id/read - Marca segnalazione come letta (solo admin)
router.put('/:id/read', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE segnalazioni
      SET status = 'letta', data_aggiornamento = NOW()
      WHERE id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Segnalazione non trovata'
      });
    }

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

// DELETE /api/segnalazioni/:id - Cancella segnalazione (solo admin)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM segnalazioni WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Segnalazione non trovata'
      });
    }

    console.log(`✅ Segnalazione ${id} cancellata da admin ${req.user.id}`);

    res.json({
      success: true,
      message: 'Segnalazione cancellata con successo'
    });

  } catch (error) {
    console.error('❌ Errore nella cancellazione segnalazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
