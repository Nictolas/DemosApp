const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { auditLog } = require('../../services/auditService');
const db = require('../../config/db');

/**
 * @route GET /api/user/download-data
 * @desc Scarica i dati personali dell'utente
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    // Valida il tipo di dati richiesto
    const validTypes = ['profile', 'opinions', 'activity', 'complete'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo di dati non valido'
      });
    }

    let userData = {};

    // Carica i dati del profilo
    if (type === 'profile' || type === 'complete') {
      const profileQuery = `
        SELECT 
          id, email, nome, cognome, data_nascita, genere, 
          created_at, updated_at
        FROM users 
        WHERE id = $1
      `;
      const profileResult = await db.query(profileQuery, [userId]);
      userData.profile = profileResult.rows[0];
    }

    // Carica le opinioni
    if (type === 'opinions' || type === 'complete') {
      const opinionsQuery = `
        SELECT 
          id, categoria, domanda, risposta, grado_opinione,
          created_at, updated_at
        FROM opinioni_domande 
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      const opinionsResult = await db.query(opinionsQuery, [userId]);
      userData.opinions = opinionsResult.rows;
    }

    // Carica l'attività (voti, partecipazioni, etc.)
    if (type === 'activity' || type === 'complete') {
      const activityQuery = `
        SELECT 
          'voto_capo_stato' as tipo_attivita,
          candidato as dettaglio,
          created_at
        FROM voti_capo_stato 
        WHERE user_id = $1
        
        UNION ALL
        
        SELECT 
          'voto_ice' as tipo_attivita,
          candidato as dettaglio,
          created_at
        FROM voti_ice 
        WHERE user_id = $1
        
        UNION ALL
        
        SELECT 
          'voto_referendum' as tipo_attivita,
          referendum as dettaglio,
          created_at
        FROM voti_referendum_abrogativi 
        WHERE user_id = $1
        
        ORDER BY created_at DESC
      `;
      const activityResult = await db.query(activityQuery, [userId]);
      userData.activity = activityResult.rows;
    }

    // Aggiungi metadati
    userData.metadata = {
      exportDate: new Date().toISOString(),
      dataType: type,
      userId: userId,
      version: '1.0'
    };

    // Log dell'audit
    await auditLog({
      userId: userId,
      action: 'DATA_EXPORT',
      resource: 'user_data',
      details: {
        dataType: type,
        timestamp: new Date().toISOString()
      }
    });

    // Imposta gli header per il download
    const filename = `dati-${type}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Invia i dati
    res.json({
      success: true,
      data: userData,
      message: 'Dati esportati con successo'
    });

  } catch (error) {
    console.error('Errore durante l\'export dei dati:', error);
    
    // Log dell'errore
    await auditLog({
      userId: req.user?.id,
      action: 'DATA_EXPORT_ERROR',
      resource: 'user_data',
      details: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });

    res.status(500).json({
      success: false,
      message: 'Errore interno del server durante l\'export dei dati'
    });
  }
});

module.exports = router;
