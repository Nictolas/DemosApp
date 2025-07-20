import { adminDb, adminAuth } from './firebase-config.js';

// VAPID KEY privata per firmare le notifiche
const VAPID_PRIVATE_KEY = '<REDACTED_API_KEY>';

/**
 * Salva il token FCM di un utente
 */
export async function saveUserFCMToken(userId, fcmToken) {
  try {
    await adminDb.collection('utenti').doc(userId).update({
      fcmTokens: [fcmToken]
    });
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
export async function removeUserFCMToken(userId) {
  try {
    await adminDb.collection('utenti').doc(userId).update({
      fcmTokens: []
    });
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
export async function sendNotificationToUser(userId, notification) {
  try {
    // Ottieni il token FCM dell'utente
    const userDoc = await adminDb.collection('utenti').doc(userId).get();
    if (!userDoc.exists) {
      return { success: false, error: 'Utente non trovato' };
    }

    const userData = userDoc.data();
    if (!userData.fcmTokens || !Array.isArray(userData.fcmTokens) || userData.fcmTokens.length === 0) {
      return { success: false, error: 'Token FCM non trovato per questo utente' };
    }

    // Invia la notifica SOLO al primo token (o a tutti se vuoi)
    const message = {
      token: userData.fcmTokens[0],
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
export async function sendNotificationToUsers(userIds, notification) {
  try {
    // Ottieni i token FCM degli utenti
    const usersSnapshot = await adminDb.collection('utenti')
      .where(adminDb.FieldPath.documentId(), 'in', userIds)
      .get();

    const tokens = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmTokens && Array.isArray(userData.fcmTokens) && userData.fcmTokens.length > 0) {
        tokens.push(userData.fcmTokens[0]);
      }
    });

    if (tokens.length === 0) {
      return { success: false, error: 'Nessun token FCM trovato' };
    }

    // Invia notifiche in batch
    const message = {
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

    // Invia a tutti i token
    const response = await adminAuth.app.messaging().sendMulticast({
      tokens: tokens,
      ...message
    });

    console.log(`Notifiche inviate: ${response.successCount}/${tokens.length}`);
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses
    };
  } catch (error) {
    console.error('Errore invio notifiche multiple:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Invia notifica a tutti gli utenti
 */
export async function sendNotificationToAllUsers(notification) {
  try {
    // Ottieni tutti i token FCM (in batch per evitare timeout)
    const batchSize = 500;
    let allTokens = [];
    let lastDoc = null;

    while (true) {
      let query = adminDb.collection('utenti')
        .limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      
      if (snapshot.empty) break;

      snapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.fcmTokens && Array.isArray(userData.fcmTokens) && userData.fcmTokens.length > 0) {
          allTokens.push(userData.fcmTokens[0]);
        }
      });

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.docs.length < batchSize) break;
    }

    if (allTokens.length === 0) {
      return { success: false, error: 'Nessun token FCM trovato' };
    }

    // Invia notifiche in batch
    const message = {
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

    // Invia a tutti i token
    const response = await adminAuth.app.messaging().sendMulticast({
      tokens: allTokens,
      ...message
    });

    console.log(`Notifiche inviate a tutti: ${response.successCount}/${allTokens.length}`);
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses
    };
  } catch (error) {
    console.error('Errore invio notifiche a tutti:', error);
    return { success: false, error: error.message };
  }
} 

/**
 * Iscrive un token FCM a un topic FCM tramite REST API
 */
export async function subscribeTokenToTopic(token, topic) {
  try {
    const SERVER_KEY = process.env.FIREBASE_SERVER_KEY;
    if (!SERVER_KEY) {
      return { success: false, error: 'FIREBASE_SERVER_KEY non configurata nelle variabili d\'ambiente' };
    }
    const url = `https://iid.googleapis.com/iid/v1/${token}/rel/topics/${topic}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `key=${SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 200) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: `Errore FCM: ${response.status} - ${errorText}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
} 