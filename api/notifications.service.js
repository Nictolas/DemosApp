const { adminAuth } = require('./firebase-config.cjs');
const { pool } = require('./config/db');

// VAPID KEY privata per firmare le notifiche
const VAPID_PRIVATE_KEY = '<REDACTED_API_KEY>';

/**
 * Salva il token FCM di un utente
 */
async function saveUserFCMToken(userId, fcmToken) {
  try {
    await pool.query(
      'UPDATE utenti SET fcm_tokens = $1 WHERE id = $2',
      [JSON.stringify([fcmToken]), userId]
    );
    console.log(`Token FCM (array) salvato per utente ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Errore salvataggio token FCM:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rimuove il token FCM di un utente
 */
async function removeUserFCMToken(userId) {
  try {
    await pool.query(
      'UPDATE utenti SET fcm_tokens = $1 WHERE id = $2',
      [JSON.stringify([]), userId]
    );
    console.log(`Token FCM (array) rimosso per utente ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Errore rimozione token FCM:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Invia notifica a un singolo utente
 */
async function sendNotificationToUser(userId, notification) {
  try {
    // Ottieni il token FCM dell'utente da PostgreSQL
    const userResult = await pool.query(
      'SELECT fcm_tokens FROM utenti WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return { success: false, error: 'Utente non trovato' };
    }

    const userData = userResult.rows[0];
    const fcmTokens = userData.fcm_tokens ? JSON.parse(userData.fcm_tokens) : [];
    
    if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
      return { success: false, error: 'Token FCM non trovato per questo utente' };
    }

    // Invia la notifica SOLO al primo token (o a tutti se vuoi)
    const message = {
      token: fcmTokens[0],
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      webpush: {
        headers: {
          'Urgency': 'high'
        },
        notification: {
          icon: '/icona.png',
          badge: '/icona.png',
          tag: 'demos-notification',
          requireInteraction: true,
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
        }
      }
    };

    const response = await adminAuth.app.messaging().send(message);
    console.log(`Notifica inviata a ${userId}:`, response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Errore invio notifica:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Invia notifica a più utenti
 */
async function sendNotificationToUsers(userIds, notification) {
  try {
    // Ottieni i token FCM degli utenti da PostgreSQL
    const usersResult = await pool.query(
      'SELECT id, fcm_tokens FROM utenti WHERE id = ANY($1)',
      [userIds]
    );
    
    const results = [];
    for (const user of usersResult.rows) {
      const fcmTokens = user.fcm_tokens ? JSON.parse(user.fcm_tokens) : [];
      if (fcmTokens.length > 0) {
        const result = await sendNotificationToUser(user.id, notification);
        results.push({ userId: user.id, ...result });
      }
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Errore invio notifiche multiple:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Invia notifica a tutti gli utenti attivi
 */
async function sendNotificationToAllUsers(notification) {
  try {
    // Ottieni tutti gli utenti attivi da PostgreSQL
    const usersResult = await pool.query(
      'SELECT id, fcm_tokens FROM utenti WHERE status = $1',
      ['active']
    );
    
    const results = [];
    for (const user of usersResult.rows) {
      const fcmTokens = user.fcm_tokens ? JSON.parse(user.fcm_tokens) : [];
      if (fcmTokens.length > 0) {
        const result = await sendNotificationToUser(user.id, notification);
        results.push({ userId: user.id, ...result });
      }
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Errore invio notifiche a tutti:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  saveUserFCMToken,
  removeUserFCMToken,
  sendNotificationToUser,
  sendNotificationToUsers,
  sendNotificationToAllUsers
}; 