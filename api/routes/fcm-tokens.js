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
    
    // Filtra i token validi (solo quelli che sono token FCM reali, non device ID fittizi)
    const validExistingTokens = existingTokens.filter(t => 
      t && t.length > 100 && !t.startsWith('web_')
    );
    
    // Aggiungi il nuovo token se non è già presente
    let updatedTokens;
    if (validExistingTokens.includes(token)) {
      // Token già presente, mantieni solo i token validi
      updatedTokens = validExistingTokens;
      console.log('   ℹ️ Token già presente, nessuna modifica');
    } else {
      // TOKEN SOLO PER MOBILE: Mantieni sempre solo 1 token (il più recente)
      // Quando viene aggiunto un nuovo token, rimuovi tutti i vecchi
      // Questo garantisce che ci sia sempre solo il token mobile più recente
      updatedTokens = [token]; // Solo il nuovo token, rimuovi tutti i vecchi
      
      if (validExistingTokens.length > 0) {
        console.log(`   🧹 Rimossi ${validExistingTokens.length} token vecchi (manteniamo solo 1 token mobile)`);
        console.log(`   📋 Token rimossi: ${validExistingTokens.map(t => t.substring(0, 30) + '...').join(', ')}`);
      }
      
      console.log(`   ✅ Token mobile aggiunto. Totale token: 1 (solo mobile)`);
      
      // Se abbiamo rimosso token vecchi non validi, loggalo
      const removedInvalidCount = existingTokens.length - validExistingTokens.length;
      if (removedInvalidCount > 0) {
        console.log(`   🧹 Rimossi ${removedInvalidCount} token non validi o duplicati`);
      }
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

// POST /api/fcm-tokens/cleanup - Rimuovi token duplicati, mantieni solo l'ultimo (mobile)
router.post('/cleanup', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    console.log(`🧹 Pulizia token FCM duplicati per utente: ${userId}`);
    
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
    
    // Filtra i token validi
    const validTokens = existingTokens.filter(t => 
      t && t.length > 100 && !t.startsWith('web_')
    );
    
    // Mantieni solo l'ultimo token (più recente)
    const cleanedTokens = validTokens.length > 0 ? [validTokens[validTokens.length - 1]] : [];
    
    if (validTokens.length > 1) {
      const removedCount = validTokens.length - 1;
      console.log(`   🧹 Rimossi ${removedCount} token duplicati`);
      console.log(`   📋 Token rimossi: ${validTokens.slice(0, -1).map(t => t.substring(0, 30) + '...').join(', ')}`);
      console.log(`   ✅ Mantenuto solo l'ultimo token: ${cleanedTokens[0].substring(0, 30)}...`);
    } else {
      console.log(`   ℹ️ Nessun token duplicato trovato (${validTokens.length} token presente)`);
    }
    
    // Salva i token puliti
    await pool.query(
      'UPDATE users SET fcm_tokens = $1, updated_at = NOW() WHERE id = $2',
      [cleanedTokens, userId]
    );
    
    res.json({
      success: true,
      message: 'Token FCM puliti con successo',
      data: {
        userId,
        tokenCountBefore: validTokens.length,
        tokenCountAfter: cleanedTokens.length,
        removedCount: validTokens.length - cleanedTokens.length
      }
    });
  } catch (error) {
    console.error('❌ Errore nella pulizia token FCM:', error);
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

