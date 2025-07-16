import { adminDb, adminAuth } from './firebase-config.js';

// VAPID KEY privata per firmare le notifiche
const VAPID_PRIVATE_KEY = '8QaQGdSubhZIOawTGmlWopxu6hRhhH3aGvcH9Jc9KeA';

/**
 * Salva il token FCM di un utente
 */
export async function saveUserFCMToken(userId, fcmToken) {
  try {
    await adminDb.collection('utenti').doc(userId).update({
      fcmToken: fcmToken,
      fcmTokenUpdatedAt: new Date()
    });
    console.log(`Token FCM salvato per utente ${userId}`);
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
      fcmToken: null,
      fcmTokenUpdatedAt: new Date()
    });
    console.log(`Token FCM rimosso per utente ${userId}`);
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
    if (!userData.fcmToken) {
      return { success: false, error: 'Token FCM non trovato per questo utente' };
    }

    // Invia la notifica
    const message = {
      token: userData.fcmToken,
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
      if (userData.fcmToken) {
        tokens.push(userData.fcmToken);
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
        .where('fcmToken', '!=', null)
        .limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      
      if (snapshot.empty) break;

      snapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.fcmToken) {
          allTokens.push(userData.fcmToken);
        }
      });

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.docs.length < batchSize) break;
    }

    if (allTokens.length === 0) {
      return { success: false, error: 'Nessun token FCM trovato' };
    }

    // Invia notifiche in batch di 500
    const batches = [];
    for (let i = 0; i < allTokens.length; i += 500) {
      batches.push(allTokens.slice(i, i + 500));
    }

    let totalSuccess = 0;
    let totalFailure = 0;

    for (const batch of batches) {
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

      const response = await adminAuth.app.messaging().sendMulticast({
        tokens: batch,
        ...message
      });

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }

    console.log(`Notifiche inviate a tutti: ${totalSuccess}/${allTokens.length}`);
    return { 
      success: true, 
      successCount: totalSuccess,
      failureCount: totalFailure,
      totalTokens: allTokens.length
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