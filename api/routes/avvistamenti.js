const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { verifyToken } = require('../middleware/auth');

/**
 * POST /api/avvistamenti/avvisa-vicini
 * Invia una notifica a tutti i cittadini dello stesso comune di residenza
 */
router.post('/avvisa-vicini', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tipo_avvistamento, titolo, testo } = req.body;

    if (!tipo_avvistamento || !titolo || !testo) {
      return res.status(400).json({
        success: false,
        error: 'Tipo avvistamento, titolo e testo sono obbligatori'
      });
    }

    // Recupera il comune di residenza dell'utente che invia la notifica
    const userResult = await pool.query(
      'SELECT comune_residenza FROM users WHERE id = $1',
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

    // Crea la notifica nella tabella notifiche_avvistamenti
    const insertResult = await pool.query(
      `INSERT INTO notifiche_avvistamenti 
       (id_utente, tipo_avvistamento, titolo, testo, comune_residenza, data, data_creazione)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, tipo_avvistamento, titolo, testo, comuneResidenza]
    );

    const notificaId = insertResult.rows[0].id;
    console.log(`✅ Notifica avvistamento creata con ID: ${notificaId}`);

    // Trova tutti gli utenti con lo stesso comune_residenza (escludendo chi ha inviato la notifica)
    const usersResult = await pool.query(
      `SELECT id, fcm_tokens, notifiche_preferenze 
       FROM users 
       WHERE comune_residenza = $1 
         AND id != $2 
         AND comune_residenza IS NOT NULL`,
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
    for (const targetUser of targetUsers) {
      // Verifica se l'utente ha attivato le notifiche per avvistamenti
      const preferenze = targetUser.notifiche_preferenze || {};
      const notificheAttive = preferenze.avvistamenti !== false; // Default: true se non specificato

      if (!notificheAttive) {
        console.log(`⏭️ Utente ${targetUser.id} ha disattivato le notifiche per avvistamenti`);
        continue;
      }

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
          if (!admin) {
            console.warn('⚠️ Firebase Admin non disponibile. Notifica push non inviata.');
            continue;
          }

          const message = {
            token: fcmToken.trim(),
            notification: {
              title: `Avvistamento ${tipo_avvistamento}`,
              body: testo.substring(0, 100) // Limita la lunghezza del body
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
          console.error(`❌ Errore invio push notification a utente ${targetUser.id}:`, error.message);
          
          // Se il token non è più valido, rimuovilo
          if (error.code === 'messaging/registration-token-not-registered' || 
              error.code === 'messaging/invalid-registration-token') {
            await pool.query(
              'UPDATE users SET fcm_tokens = array_remove(fcm_tokens, $1) WHERE id = $2',
              [fcmToken, targetUser.id]
            );
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

