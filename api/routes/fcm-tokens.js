const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

function isValidFcmToken(token) {
  return !!(token && token.trim() && token.length > 100 && !token.startsWith('web_'));
}

async function getLegacyTokens(userId) {
  const userResult = await pool.query(
    'SELECT COALESCE(fcm_tokens, ARRAY[]::text[]) AS fcm_tokens FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) return null;
  return userResult.rows[0].fcm_tokens || [];
}

async function upsertUserDeviceToken(userId, token) {
  await pool.query(
    `INSERT INTO user_devices (user_id, fcm_token, is_active, last_seen_at, created_at, updated_at)
     VALUES ($1, $2, TRUE, NOW(), NOW(), NOW())
     ON CONFLICT (fcm_token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       is_active = TRUE,
       last_seen_at = NOW(),
       updated_at = NOW()`,
    [userId, token]
  );
}

async function deactivateOtherUserDeviceTokens(userId, tokenToKeep) {
  await pool.query(
    `UPDATE user_devices
     SET is_active = FALSE, updated_at = NOW()
     WHERE user_id = $1
       AND fcm_token <> $2`,
    [userId, tokenToKeep]
  );
}

async function deactivateUserDeviceToken(userId, token) {
  await pool.query(
    `UPDATE user_devices
     SET is_active = FALSE, updated_at = NOW()
     WHERE user_id = $1 AND fcm_token = $2`,
    [userId, token]
  );
}

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
    
    // Verifica se la richiesta viene da un dispositivo mobile
    // TOKEN SOLO PER MOBILE: Ignora i token da desktop/browser
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    console.log(`   📱 User-Agent: ${userAgent.substring(0, 100)}...`);
    console.log(`   📱 Dispositivo rilevato: ${isMobile ? 'Mobile ✅' : 'Desktop ❌ (ignorato)'}`);
    
    // Se non è mobile, ignora il token (non salvarlo)
    if (!isMobile) {
      console.log(`   ⚠️ Token da desktop ignorato. Solo token mobile vengono salvati.`);
      return res.json({
        success: true,
        message: 'Token desktop ignorato (solo token mobile vengono salvati)',
        data: {
          userId,
          tokenCount: 0,
          ignored: true,
          reason: 'desktop_device'
        }
      });
    }
    
    const existingTokens = await getLegacyTokens(userId);
    if (existingTokens === null) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Filtra i token validi (solo quelli che sono token FCM reali, non device ID fittizi)
    const validExistingTokens = existingTokens.filter(t => 
      isValidFcmToken(t)
    );
    
    // TOKEN SOLO PER MOBILE: Mantieni sempre solo 1 token (il più recente)
    // Quando viene aggiunto un nuovo token mobile, rimuovi tutti i vecchi
    // Questo garantisce che ci sia sempre solo il token mobile più recente
    let updatedTokens;
    if (validExistingTokens.includes(token)) {
      // Token già presente, mantieni solo questo token (rimuovi eventuali altri)
      updatedTokens = [token];
      if (validExistingTokens.length > 1) {
        console.log(`   🧹 Rimossi ${validExistingTokens.length - 1} token extra (manteniamo solo questo token mobile)`);
        console.log(`   📋 Token rimossi: ${validExistingTokens.filter(t => t !== token).map(t => t.substring(0, 30) + '...').join(', ')}`);
      } else {
        console.log('   ℹ️ Token già presente, nessuna modifica');
      }
    } else {
      // Nuovo token mobile: rimuovi tutti i vecchi
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
    
    // Salva su storage legacy (transitorio)
    await pool.query(
      'UPDATE users SET fcm_tokens = $1, updated_at = NOW() WHERE id = $2',
      [updatedTokens, userId]
    );

    // Salva su nuovo storage (user_devices): mantieni un solo token attivo per utente
    await upsertUserDeviceToken(userId, token);
    await deactivateOtherUserDeviceTokens(userId, token);
    
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
    
    const existingTokens = await getLegacyTokens(userId);
    if (existingTokens === null) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Filtra i token validi
    const validTokens = existingTokens.filter(t => 
      isValidFcmToken(t)
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
    
    // Salva i token puliti su storage legacy (transitorio)
    await pool.query(
      'UPDATE users SET fcm_tokens = $1, updated_at = NOW() WHERE id = $2',
      [cleanedTokens, userId]
    );

    // Allinea nuovo storage: disattiva tutti i token user, poi attiva solo il più recente (se presente)
    await pool.query(
      `UPDATE user_devices SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
    if (cleanedTokens.length > 0) {
      await upsertUserDeviceToken(userId, cleanedTokens[0]);
    }
    
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
    
    const existingTokens = await getLegacyTokens(userId);
    if (existingTokens === null) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Rimuovi il token
    const updatedTokens = existingTokens.filter(t => t !== token);
    
    // Salva i token aggiornati
    await pool.query(
      'UPDATE users SET fcm_tokens = $1, updated_at = NOW() WHERE id = $2',
      [updatedTokens, userId]
    );

    // Nuovo storage: disattiva token specifico
    await deactivateUserDeviceToken(userId, token);
    
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

