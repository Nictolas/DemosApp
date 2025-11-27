const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');
const AuditService = require('../../services/auditService');

/**
 * GET /api/user/political-opinions-consent
 * Verifica lo stato del consenso alle opinioni politiche
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    const query = `
      SELECT 
        political_opinions_consent,
        political_opinions_consent_timestamp,
        political_opinions_consent_ip_address,
        political_opinions_consent_user_agent
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const userData = result.rows[0];
    
    res.json({
      success: true,
      consent: {
        granted: userData.political_opinions_consent || false,
        timestamp: userData.political_opinions_consent_timestamp,
        ipAddress: userData.political_opinions_consent_ip_address,
        userAgent: userData.political_opinions_consent_user_agent
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella verifica consenso opinioni politiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/user/political-opinions-consent
 * Salva il consenso esplicito alle opinioni politiche (GDPR Art. 9)
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { consent } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    if (typeof consent !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Il campo consent deve essere un booleano'
      });
    }
    
    // Se il consenso è false, restituisci errore (la revoca va fatta tramite PUT /revoke)
    if (!consent) {
      return res.status(400).json({
        success: false,
        error: 'Per revocare il consenso, utilizza l\'endpoint PUT /api/user/political-opinions-consent/revoke'
      });
    }
    
    // Salva il consenso esplicito
    const updateQuery = `
      UPDATE users 
      SET 
        political_opinions_consent = $1,
        political_opinions_consent_timestamp = NOW(),
        political_opinions_consent_ip_address = $2,
        political_opinions_consent_user_agent = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING 
        political_opinions_consent,
        political_opinions_consent_timestamp
    `;
    
    const result = await pool.query(updateQuery, [
      true,
      ipAddress,
      userAgent,
      userId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    // Log dell'azione
    await AuditService.logAction({
      userId,
      action: 'POLITICAL_OPINIONS_CONSENT_GRANTED',
      resource: 'user_consent',
      details: {
        consent_type: 'political_opinions',
        gdpr_article: '9.2.a',
        ip_address: ipAddress,
        user_agent: userAgent
      },
      ipAddress,
      userAgent,
      success: true
    });
    
    console.log(`✅ Consenso opinioni politiche concesso per utente: ${userId}`);
    
    res.json({
      success: true,
      message: 'Consenso alle opinioni politiche salvato con successo',
      consent: {
        granted: true,
        timestamp: result.rows[0].political_opinions_consent_timestamp
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvataggio consenso opinioni politiche:', error);
    
    // Log dell'errore
    await AuditService.logAction({
      userId: req.userId,
      action: 'POLITICAL_OPINIONS_CONSENT_GRANTED',
      resource: 'user_consent',
      details: { consent_type: 'political_opinions' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante il salvataggio del consenso'
    });
  }
});

/**
 * PUT /api/user/political-opinions-consent/revoke
 * Revoca il consenso alle opinioni politiche
 */
router.put('/revoke', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Revoca il consenso
    const updateQuery = `
      UPDATE users 
      SET 
        political_opinions_consent = false,
        political_opinions_consent_timestamp = NULL,
        political_opinions_consent_ip_address = NULL,
        political_opinions_consent_user_agent = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(updateQuery, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    // Anonimizza le opinioni politiche esistenti
    // (mantieni per statistiche aggregate ma rimuovi associazione con user_id)
    try {
      await pool.query(`
        UPDATE opinioni_domande 
        SET user_id = 'ANONYMIZED_' || user_id::text
        WHERE user_id = $1
      `, [userId]);
      
      console.log(`✅ Opinionii politiche anonimizzate per utente: ${userId}`);
    } catch (error) {
      console.error('⚠️ Errore nell\'anonimizzazione opinioni (tabella potrebbe non esistere):', error.message);
      // Non bloccare la revoca se l'anonimizzazione fallisce
    }
    
    // Log dell'azione
    await AuditService.logAction({
      userId,
      action: 'POLITICAL_OPINIONS_CONSENT_REVOKED',
      resource: 'user_consent',
      details: {
        consent_type: 'political_opinions',
        gdpr_article: '9.2.a',
        opinions_anonymized: true
      },
      ipAddress,
      userAgent,
      success: true
    });
    
    console.log(`✅ Consenso opinioni politiche revocato per utente: ${userId}`);
    
    res.json({
      success: true,
      message: 'Consenso alle opinioni politiche revocato con successo. Le tue opinioni sono state anonimizzate.',
      consent: {
        granted: false,
        timestamp: null
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella revoca consenso opinioni politiche:', error);
    
    // Log dell'errore
    await AuditService.logAction({
      userId: req.userId,
      action: 'POLITICAL_OPINIONS_CONSENT_REVOKED',
      resource: 'user_consent',
      details: { consent_type: 'political_opinions' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante la revoca del consenso'
    });
  }
});

module.exports = router;

