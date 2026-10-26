const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { invalidateFailedFcmTokens } = require('../services/fcmTokenInvalidationService');
const {
  RECIPIENT_FCM_TOKENS_LATERAL_SQL,
  isRecipientFcmTokenCurrentlyActive,
} = require('../services/fcmRecipientTokenService');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

/**
 * POST /api/avvistamenti/avvisa-vicini
 * Invia una notifica a tutti i cittadini dello stesso comune di residenza
 */
router.post('/avvisa-vicini', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tipo_avvistamento } = req.body;

    if (!tipo_avvistamento) {
      return res.status(400).json({
        success: false,
        error: 'Tipo avvistamento è obbligatorio'
      });
    }

    // Recupera il comune di residenza dell'utente che invia la notifica
    const userResult = await pool.query(
      'SELECT comune_residenza FROM public.users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    const comuneResidenza = userResult.rows[0].comune_residenza;

    if (!comuneResidenza) {
      return res.status(400).json({
        success: false,
        error: 'Il tuo profilo non ha un comune di residenza impostato'
      });
    }

    // Verifica se la tabella esiste
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifiche_avvistamenti'
      )
    `);

    if (!tableExists.rows[0]?.exists) {
      return res.status(500).json({
        success: false,
        error: 'Tabella notifiche_avvistamenti non trovata. Esegui lo script SQL per crearla.'
      });
    }

    // Crea la notifica nella tabella notifiche_avvistamenti
    const insertResult = await pool.query(
      `INSERT INTO notifiche_avvistamenti 
       (id_utente, tipo_avvistamento, comune_residenza, data, data_creazione)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, tipo_avvistamento, comuneResidenza]
    );

    const notificaId = insertResult.rows[0].id;
    console.log(`✅ Notifica avvistamento creata con ID: ${notificaId}`);

    // Trova tutti gli utenti con lo stesso comune_residenza (escludendo chi ha inviato la notifica)
    // Filtra direttamente nella query per utenti con animali attivi (default true se non specificato)
    const usersResult = await pool.query(
      `SELECT
         u.id,
         COALESCE(tokens.tokens, ARRAY[]::text[]) as fcm_tokens,
         COALESCE(np.animali, true) as animali
       FROM public.users u
       LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
       ${RECIPIENT_FCM_TOKENS_LATERAL_SQL}
       WHERE u.comune_residenza = $1 
         AND u.id != $2 
         AND u.comune_residenza IS NOT NULL
         AND array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0
         AND (np.animali = true OR np.animali IS NULL)`,
      [comuneResidenza, userId]
    );

    const targetUsers = usersResult.rows;
    console.log(`📋 Utenti trovati con comune ${comuneResidenza}: ${targetUsers.length}`);

    // Inizializza Firebase Admin per le push notifications
    const { getFirebaseAdmin } = require('../services/firebaseAdmin');
    const admin = getFirebaseAdmin();

    let notificationsSent = 0;
    let errors = 0;

    // Invia push notification a tutti gli utenti target
    // (già filtrati nella query per avere avvistamenti = true)
    for (const targetUser of targetUsers) {

      // Ottieni i token FCM dell'utente
      const fcmTokens = targetUser.fcm_tokens || [];
      
      if (fcmTokens.length === 0) {
        console.log(`⏭️ Utente ${targetUser.id} non ha token FCM`);
        continue;
      }

      // Invia push notification a tutti i token dell'utente
      for (const fcmToken of fcmTokens) {
        if (!fcmToken || !fcmToken.trim()) continue;

        try {
          // Recipient lists can become stale during multi-user fan-out.
          // Never send to a revoked, transferred or unverifiable token.
          const eligible = await isRecipientFcmTokenCurrentlyActive(pool, {
            userId: targetUser.id, token: fcmToken
          });
          if (!eligible) continue;
          if (!admin) {
            console.warn('⚠️ Firebase Admin non disponibile. Notifica push non inviata.');
            continue;
          }

          const message = {
            token: fcmToken.trim(),
            notification: {
              title: `Avvistamento ${tipo_avvistamento}`,
              body: `Avvistamento segnalato nel comune di ${comuneResidenza}`
            },
            data: {
              type: 'avvistamento',
              notifica_id: notificaId,
              comune: comuneResidenza,
              click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            webpush: {
              headers: {
                'Urgency': 'high'
              },
              notification: {
                icon: '/icona.png',
                badge: '/icona.png',
                tag: 'avvistamento-notification',
                requireInteraction: true,
                data: {
                  url: '/notifiche',
                  link: 'https://www.demos.community/notifiche'
                },
                actions: [
                  {
                    action: 'open',
                    title: 'Apri'
                  },
                  {
                    action: 'close',
                    title: 'Chiudi'
                  }
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
                channelId: 'avvistamenti_notifications'
              }
            },
            apns: {
              headers: {
                'apns-priority': '10'
              },
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1
                }
              }
            }
          };

          await admin.messaging().send(message);
          notificationsSent++;
          console.log(`✅ Push notification inviata a utente ${targetUser.id}`);
        } catch (error) {
          errors++;
          console.error('Errore invio push avvistamento:', error?.code || 'internal_error');
          
          // Se il token non è più valido, rimuovilo
          if (error.code === 'messaging/registration-token-not-registered' || 
              error.code === 'messaging/invalid-registration-token') {
            await invalidateFailedFcmTokens(pool, {
              userId: targetUser.id, tokens: [fcmToken]
            });
            console.log(`🗑️ Token FCM non valido rimosso per utente ${targetUser.id}`);
          }
        }
      }
    }

    console.log(`📊 Notifiche inviate: ${notificationsSent} successi, ${errors} errori`);

    res.json({
      success: true,
      message: `Notifica inviata a ${targetUsers.length} cittadini del comune di ${comuneResidenza}`,
      notifica_id: notificaId,
      utenti_notificati: targetUsers.length,
      push_inviate: notificationsSent,
      errori: errors
    });

  } catch (error) {
    console.error('❌ Errore in avvisa-vicini:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

module.exports = router;

