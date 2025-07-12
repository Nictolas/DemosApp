import express from 'express';
import { 
  saveUserFCMToken, 
  removeUserFCMToken, 
  sendNotificationToUser, 
  sendNotificationToUsers, 
  sendNotificationToAllUsers 
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

export default router; 