import express from 'express';
import { 
  saveUserFCMToken, 
  removeUserFCMToken, 
  sendNotificationToUser, 
  sendNotificationToUsers, 
  sendNotificationToAllUsers, 
  subscribeTokenToTopic 
} from './notifications.service.js';

const router = express.Router();

/**
 * POST /api/notifications/token
 * Salva il token FCM di un utente
 */
router.post('/token', async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;
    
    if (!userId || !fcmToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId e fcmToken sono richiesti' 
      });
    }

    const result = await saveUserFCMToken(userId, fcmToken);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Errore endpoint salvataggio token:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

/**
 * DELETE /api/notifications/token/:userId
 * Rimuove il token FCM di un utente
 */
router.delete('/token/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId è richiesto' 
      });
    }

    const result = await removeUserFCMToken(userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Errore endpoint rimozione token:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

/**
 * POST /api/notifications/send/user
 * Invia notifica a un singolo utente
 */
router.post('/send/user', async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;
    
    if (!userId || !title || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId, title e body sono richiesti' 
      });
    }

    const notification = {
      title,
      body,
      data: data || {}
    };

    const result = await sendNotificationToUser(userId, notification);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Errore endpoint invio notifica singola:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

/**
 * POST /api/notifications/send/users
 * Invia notifica a più utenti
 */
router.post('/send/users', async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'userIds (array), title e body sono richiesti' 
      });
    }

    const notification = {
      title,
      body,
      data: data || {}
    };

    const result = await sendNotificationToUsers(userIds, notification);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Errore endpoint invio notifiche multiple:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

/**
 * POST /api/notifications/send/all
 * Invia notifica a tutti gli utenti
 */
router.post('/send/all', async (req, res) => {
  try {
    const { title, body, data } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'title e body sono richiesti' 
      });
    }

    const notification = {
      title,
      body,
      data: data || {}
    };

    const result = await sendNotificationToAllUsers(notification);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Errore endpoint invio notifiche a tutti:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

/**
 * POST /api/notifications/subscribe-topic
 * Iscrive un token FCM a un topic FCM (solo via backend)
 */
router.post('/subscribe-topic', async (req, res) => {
  try {
    const { token, topic } = req.body;
    if (!token || !topic) {
      return res.status(400).json({
        success: false,
        error: 'token e topic sono richiesti'
      });
    }
    const result = await subscribeTokenToTopic(token, topic);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Errore endpoint subscribe-topic:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/notifications/tokens
 * Lista tutti i token FCM salvati (solo per debug)
 */
router.get('/tokens', async (req, res) => {
  try {
    const { adminDb } = await import('../api/firebase-config.js');
    
    if (!adminDb) {
      return res.status(500).json({ 
        success: false, 
        error: 'Admin SDK non configurato' 
      });
    }

    const usersSnapshot = await adminDb.collection('utenti').get();
    const tokens = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken) {
        tokens.push({
          userId: doc.id,
          email: userData.email,
          fcmToken: userData.fcmToken.substring(0, 20) + '...',
          updatedAt: userData.fcmTokenUpdatedAt
        });
      }
    });

    res.json({ 
      success: true, 
      count: tokens.length,
      tokens 
    });
  } catch (error) {
    console.error('Errore endpoint lista token:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

export default router; 