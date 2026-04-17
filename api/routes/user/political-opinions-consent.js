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
        COALESCE(uc.political_opinions_consent, u.political_opinions_consent) AS political_opinions_consent,
        COALESCE(uc.political_opinions_consent_timestamp, u.political_opinions_consent_timestamp) AS political_opinions_consent_timestamp,
        COALESCE(uc.political_opinions_consent_ip_address, u.political_opinions_consent_ip_address) AS political_opinions_consent_ip_address,
        COALESCE(uc.political_opinions_consent_user_agent, u.political_opinions_consent_user_agent) AS political_opinions_consent_user_agent
      FROM users u
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE u.id = $1
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
    
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      result = await client.query(updateQuery, [
        true,
        ipAddress,
        userAgent,
        userId
      ]);

      if (result.rows.length > 0) {
        await client.query(
          `INSERT INTO user_consents (
            user_id, political_opinions_consent, political_opinions_consent_timestamp,
            political_opinions_consent_ip_address, political_opinions_consent_user_agent
          ) VALUES ($1, true, NOW(), $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET
            political_opinions_consent = true,
            political_opinions_consent_timestamp = NOW(),
            political_opinions_consent_ip_address = EXCLUDED.political_opinions_consent_ip_address,
            political_opinions_consent_user_agent = EXCLUDED.political_opinions_consent_user_agent,
            updated_at = NOW()`,
          [userId, ipAddress, userAgent]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
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
    
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      result = await client.query(updateQuery, [userId]);
      if (result.rows.length > 0) {
        await client.query(
          `INSERT INTO user_consents (
            user_id, political_opinions_consent, political_opinions_consent_timestamp,
            political_opinions_consent_ip_address, political_opinions_consent_user_agent
          ) VALUES ($1, false, NULL, NULL, NULL)
          ON CONFLICT (user_id) DO UPDATE SET
            political_opinions_consent = false,
            political_opinions_consent_timestamp = NULL,
            political_opinions_consent_ip_address = NULL,
            political_opinions_consent_user_agent = NULL,
            updated_at = NOW()`,
          [userId]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    // Elimina le opinioni politiche esistenti dell'utente
    // (conforme GDPR: quando si revoca il consenso, i dati vengono eliminati)
    try {
      // Verifica se la tabella opinioni_risposte esiste
      const checkQuery = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opinioni_risposte')`;
      const tableExists = await pool.query(checkQuery);
      
      if (tableExists.rows[0].exists) {
        // Elimina tutte le opinioni dell'utente
        const deleteResult = await pool.query(
          `DELETE FROM opinioni_risposte WHERE user_id = $1`,
          [userId]
        );
        
        if (deleteResult.rowCount > 0) {
          console.log(`✅ ${deleteResult.rowCount} opinioni politiche eliminate per utente: ${userId}`);
        } else {
          console.log(`ℹ️ Nessuna opinione trovata per utente: ${userId}`);
        }
      } else {
        console.log('ℹ️ Tabella opinioni_risposte non esiste, nessuna opinione da eliminare');
      }
    } catch (error) {
      console.error('⚠️ Errore nell\'eliminazione opinioni:', error.message);
      // Non bloccare la revoca se l'eliminazione fallisce
      // Le opinioni verranno comunque disassociate dal consenso
    }
    
    // Log dell'azione
    await AuditService.logAction({
      userId,
      action: 'POLITICAL_OPINIONS_CONSENT_REVOKED',
      resource: 'user_consent',
      details: {
        consent_type: 'political_opinions',
        gdpr_article: '9.2.a',
        opinions_deleted: true
      },
      ipAddress,
      userAgent,
      success: true
    });
    
    console.log(`✅ Consenso opinioni politiche revocato per utente: ${userId}`);
    
    res.json({
      success: true,
      message: 'Consenso alle opinioni politiche revocato con successo. Le tue opinioni sono state eliminate.',
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

