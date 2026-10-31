const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const AuditService = require('../../services/auditService');
// Reuse the canonical verified-TLS pool; the former config/db module exported
// only { pool } and db.query was undefined.
const { getPool } = require('../../config/database');
const db = getPool();

/**
 * @route GET /api/user/privacy-settings
 * @desc Ottieni le impostazioni privacy dell'utente
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        email_notifications, push_notifications, data_analytics,
        updated_at
      FROM users 
      WHERE id = $1
    `;
    
    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utente non trovato'
      });
    }

    const user = result.rows[0];
    
    // Mappa i campi del database alle chiavi delle impostazioni
    const privacySettings = {
      email_notifications: user.email_notifications ?? true,
      push_notifications: user.push_notifications ?? true,
      data_analytics: user.data_analytics ?? true
    };

    res.json({
      success: true,
      data: privacySettings
    });

  } catch (error) {
    console.error('Errore durante il recupero delle impostazioni privacy:', error);
    
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
});

/**
 * @route PUT /api/user/privacy-settings
 * @desc Aggiorna le impostazioni privacy dell'utente
 * @access Private
 */
router.put('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = req.body;

    // Valida le impostazioni
    const validSettings = [
      'email_notifications', 'push_notifications', 'data_analytics'
    ];

    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(settings)) {
      if (validSettings.includes(key) && typeof value === 'boolean') {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nessuna impostazione valida fornita'
      });
    }

    // Aggiungi updated_at
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());
    paramCount++;

    // Aggiungi user_id per la clausola WHERE
    updateValues.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email_notifications, push_notifications, data_analytics, updated_at
    `;

    const result = await db.query(query, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utente non trovato'
      });
    }

    const updatedUser = result.rows[0];
    
    // Log dell'audit
    await AuditService.logAction({
      userId: userId,
      action: 'PRIVACY_SETTINGS_UPDATED',
      resource: 'user_privacy',
      details: {
        updatedSettings: settings,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: 'Impostazioni privacy aggiornate con successo',
      data: {
        email_notifications: updatedUser.email_notifications,
        push_notifications: updatedUser.push_notifications,
        data_analytics: updatedUser.data_analytics,
        updated_at: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('Errore durante l\'aggiornamento delle impostazioni privacy:', error);
    
    // Log dell'errore
    await AuditService.logAction({
      userId: req.user?.id,
      action: 'PRIVACY_SETTINGS_UPDATE_ERROR',
      resource: 'user_privacy',
      details: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });

    res.status(500).json({
      success: false,
      message: 'Errore interno del server durante l\'aggiornamento delle impostazioni'
    });
  }
});

module.exports = router;
