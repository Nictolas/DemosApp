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
      // Aggiungi il nuovo token e mantieni solo i token validi
      updatedTokens = [...validExistingTokens, token];
      // Rimuovi duplicati
      updatedTokens = [...new Set(updatedTokens)];
      console.log(`   ✅ Token aggiunto. Totale token validi: ${updatedTokens.length}`);
      
      // Se abbiamo rimosso token vecchi, loggalo
      const removedCount = existingTokens.length - validExistingTokens.length;
      if (removedCount > 0) {
        console.log(`   🧹 Rimossi ${removedCount} token non validi o duplicati`);
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

// POST /api/fcm-tokens/test - Invia una notifica push di test all'utente corrente
router.post('/test', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }

    console.log(`🧪 Test notifica push per utente: ${userId}`);

    // Recupera i token FCM dell'utente
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

    const fcmTokens = userResult.rows[0].fcm_tokens || [];
    
    if (fcmTokens.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun token FCM registrato per questo utente',
        message: 'Assicurati di aver concesso i permessi per le notifiche push nel browser/app'
      });
    }

    // Inizializza Firebase Admin
    const { getFirebaseAdmin } = require('../services/firebaseAdmin');
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin non configurato'
      });
    }

    const testTitle = 'Notifica di Test - Demos';
    const testBody = 'Questa è una notifica di test. Se ricevi questa notifica, significa che le notifiche push funzionano correttamente!';
    
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    // Invia la notifica a tutti i token dell'utente
    for (const token of fcmTokens) {
      if (token && token.trim()) {
        try {
          const message = {
            token: token.trim(),
            notification: {
              title: testTitle,
              body: testBody
            },
            data: {
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              type: 'test_notification',
              url: '/notifiche',
              link: 'https://www.demos.community/notifiche'
            },
            webpush: {
              headers: { 'Urgency': 'high' },
              notification: {
                icon: '/icona.png',
                badge: '/icona.png',
                tag: 'test-notification',
                requireInteraction: true,
                data: {
                  url: '/notifiche',
                  link: 'https://www.demos.community/notifiche'
                },
                actions: [
                  { action: 'open', title: 'Apri' },
                  { action: 'close', title: 'Chiudi' }
                ]
              },
              fcmOptions: {
                link: 'https://www.demos.community/notifiche'
              }
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'demos_notifications'
              }
            },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1
                }
              }
            }
          };

          const response = await admin.messaging().send(message);
          console.log(`✅ Notifica di test inviata con successo. Message ID: ${response}`);
          successCount++;
        } catch (error) {
          console.error(`❌ Errore nell'invio notifica di test a token ${token.substring(0, 30)}...:`, error.message);
          failureCount++;
          errors.push({
            token: token.substring(0, 30) + '...',
            error: error.message,
            code: error.code
          });
        }
      }
    }

    if (successCount === 0) {
      return res.status(500).json({
        success: false,
        error: 'Tutte le notifiche di test sono fallite',
        details: errors
      });
    }

    res.json({
      success: true,
      message: `Notifica di test inviata con successo a ${successCount} dispositivo/i`,
      data: {
        successCount,
        failureCount,
        totalTokens: fcmTokens.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('❌ Errore nell\'invio notifica di test:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

module.exports = router;

