const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// POST /api/fcm-tokens - Salva o aggiorna token FCM per l'utente
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { token } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Token FCM richiesto'
      });
    }
    
    console.log(`📱 Salvataggio token FCM per utente: ${userId}`);
    console.log(`   Token: ${token.substring(0, 30)}...`);
    
    // Verifica se la colonna fcm_tokens esiste, altrimenti la crea
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'fcm_tokens'
          ) THEN
            ALTER TABLE users ADD COLUMN fcm_tokens TEXT[] DEFAULT ARRAY[]::TEXT[];
          END IF;
        END $$;
      `);
    } catch (alterError) {
      console.warn('⚠️ Errore nel verificare/creare colonna fcm_tokens:', alterError.message);
    }
    
    // Recupera i token esistenti
    const userResult = await pool.query(
      'SELECT fcm_tokens FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const existingTokens = userResult.rows[0].fcm_tokens || [];
    
    // Aggiungi il nuovo token se non è già presente
    let updatedTokens;
    if (existingTokens.includes(token)) {
      // Token già presente, non fare nulla
      updatedTokens = existingTokens;
      console.log('   ℹ️ Token già presente, nessuna modifica');
    } else {
      // Aggiungi il nuovo token
      updatedTokens = [...existingTokens, token];
      console.log(`   ✅ Token aggiunto. Totale token: ${updatedTokens.length}`);
    }
    
    // Salva i token aggiornati
    await pool.query(
      'UPDATE users SET fcm_tokens = $1, updated_at = NOW() WHERE id = $2',
      [updatedTokens, userId]
    );
    
    console.log(`✅ Token FCM salvato con successo per utente ${userId}`);
    
    res.json({
      success: true,
      message: 'Token FCM salvato con successo',
      data: {
        userId,
        tokenCount: updatedTokens.length
      }
    });
  } catch (error) {
    console.error('❌ Errore nel salvataggio token FCM:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// DELETE /api/fcm-tokens/:token - Rimuovi un token FCM specifico
router.delete('/:token', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { token } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    // Recupera i token esistenti
    const userResult = await pool.query(
      'SELECT fcm_tokens FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const existingTokens = userResult.rows[0].fcm_tokens || [];
    
    // Rimuovi il token
    const updatedTokens = existingTokens.filter(t => t !== token);
    
    // Salva i token aggiornati
    await pool.query(
      'UPDATE users SET fcm_tokens = $1, updated_at = NOW() WHERE id = $2',
      [updatedTokens, userId]
    );
    
    res.json({
      success: true,
      message: 'Token FCM rimosso con successo'
    });
  } catch (error) {
    console.error('❌ Errore nella rimozione token FCM:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;

