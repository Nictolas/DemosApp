const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');

const router = express.Router();

// Legacy data/schema migration through public HTTP is retired. A privileged
// SQL migration must be reviewed and executed outside request handling.
function retiredAmnestyMaintenance(_req, res) {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  return res.status(410).json({
    success: false,
    code: 'AMNISTIA_MAINTENANCE_RETIRED',
    error: 'Manutenzione schema disponibile solo tramite migrazione verificata'
  });
}

// GET /api/amnistia - Ottieni leggi per amnistia
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/amnistia chiamato');
    const userId = req.userId || req.user?.id;
    
    // Query per tutte le amnistie
    const amnistieQuery = `SELECT * FROM amnistia WHERE attiva = true ORDER BY legge`;
    const amnistieResult = await pool.query(amnistieQuery);
    console.log(`✅ Recuperate ${amnistieResult.rows.length} amnistie`);
    
    // Query per i voti dell'utente
    let mieiVoti = [];
    if (userId) {
      try {
        const votiQuery = `SELECT legge FROM voti_amnistia WHERE userid = $1`;
        const votiResult = await pool.query(votiQuery, [userId]);
        mieiVoti = votiResult.rows.map(row => row.legge);
        console.log(`✅ Recuperati ${mieiVoti.length} voti per l'utente`);
      } catch (votiError) {
        console.log('⚠️ Errore nel recuperare voti (probabilmente tabella non esiste):', votiError.message);
        mieiVoti = [];
      }
    }
    
    // Query per contare i voti per ogni amnistia
    const votiCountQuery = `
      SELECT legge, COUNT(*) as voti 
      FROM voti_amnistia 
      GROUP BY legge
    `;
    let votiCountMap = {};
    try {
      const votiCountResult = await pool.query(votiCountQuery);
      votiCountResult.rows.forEach(row => {
        votiCountMap[row.legge] = parseInt(row.voti);
      });
    } catch (error) {
      console.log('⚠️ Errore nel contare voti:', error.message);
    }
    
    // Crea classifica con voti reali
    const classificaResult = amnistieResult.rows.map(amnistia => ({
      id: amnistia.id,
      legge: amnistia.legge,
      articolo: amnistia.articolo || '',
      descrizione: amnistia.descrizione || '',
      fonte_url: amnistia.fonte_url || null,
      precedente_storico: amnistia.precedente_storico || null,
      voti: votiCountMap[amnistia.legge] || 0
    }));
    
    // Ordina la classifica per voti in ordine decrescente (più voti in alto)
    classificaResult.sort((a, b) => b.voti - a.voti);
    
    res.json({
      success: true,
      amnistie: amnistieResult.rows,
      classifica: classificaResult,
      mieiVoti: mieiVoti,
      blocco: await getPreferenceCooldown(pool, {
        userId,
        scope: 'amnistia:preferenza'
      }).then((cooldown) => ({ isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate }))
    });
  } catch (error) {
    if (sendCooldownError(res, error)) return;
    console.error('Amnesty catalogue read failed');
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare leggi amnistia'
    });
  }
});

// POST /api/amnistia/vota - Vota per amnistia
router.post('/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    // Usa req.userId con fallback a req.user.id per sicurezza
    const userId = req.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    if (!legge) {
      return res.status(400).json({
        success: false,
        error: 'Il campo legge è obbligatorio'
      });
    }
    
    // Prima trova l'ID di amnistia corrispondente alla legge
    const amnistiaResult = await pool.query(
      'SELECT id FROM amnistia WHERE legge = $1 AND attiva = true',
      [legge]
    );
    
    if (amnistiaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Amnistia non trovata'
      });
    }
    
    const amnistiaId = amnistiaResult.rows[0].id;
    
    const existingVote = await pool.query(
      'SELECT id, legge FROM voti_amnistia WHERE userid = $1 LIMIT 1',
      [userId]
    );
    const current = existingVote.rows[0] || null;
    if (current?.legge === legge) {
      return res.json({ success: true, message: 'Preferenza Amnistia già aggiornata' });
    }

    await assertPreferenceChangeAllowed(pool, {
      userId,
      scope: 'amnistia:preferenza',
      isAdmin: Boolean(req.user?.isAdmin)
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (current) {
        await client.query('DELETE FROM voti_amnistia WHERE userid = $1', [userId]);
      }
      await client.query(
        'INSERT INTO voti_amnistia (userid, amnistia_id, legge) VALUES ($1, $2, $3)',
        [userId, amnistiaId, legge]
      );
      await recordPreferenceChange(client, { userId, scope: 'amnistia:preferenza' });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Voto amnistia salvato' });
  } catch (error) {
    if (sendCooldownError(res, error)) return;
    console.error('Amnesty vote write failed');
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voto amnistia'
    });
  }
});

// DELETE /api/amnistia/vota - Rimuovi voto per amnistia
router.delete('/vota', verifyToken, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    const userId = req.userId;
    
    // I voti storici o per reati disattivati restano rimovibili.
    const existing = await pool.query(
      'SELECT id FROM voti_amnistia WHERE userid = $1 AND legge = $2 LIMIT 1',
      [userId, legge]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Voto non trovato' });
    }

    await assertPreferenceChangeAllowed(pool, {
      userId,
      scope: 'amnistia:preferenza',
      isAdmin: Boolean(req.user?.isAdmin)
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'DELETE FROM voti_amnistia WHERE userid = $1 AND legge = $2',
        [userId, legge]
      );
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Voto non trovato' });
      }
      await recordPreferenceChange(client, { userId, scope: 'amnistia:preferenza' });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Voto amnistia rimosso' });
  } catch (error) {
    if (sendCooldownError(res, error)) return;
    console.error('❌ Errore nel rimuovere voto amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel rimuovere voto amnistia'
    });
  }
});

// POST /api/amnistia - Non creare voci pubbliche senza una coda di approvazione.
// L'invio delle proposte verra' riattivato soltanto con la revisione Admin.
router.post('/', verifyToken, (_req, res) => {
  return res.status(409).json({
    success: false,
    code: 'MODERATION_REQUIRED',
    error: 'Le proposte di Amnistia sono sospese finché non sarà disponibile l’approvazione amministrativa.',
  });
});

// POST /api/amnistia/migrate - deprecated dangerous HTTP schema mutation
router.post('/migrate', verifyToken, requireAdmin, retiredAmnestyMaintenance);

// POST /api/amnistia/migrate-ids - deprecated dangerous HTTP schema mutation
router.post('/migrate-ids', verifyToken, requireAdmin, retiredAmnestyMaintenance);

// Introspection formerly available via Admin HTTP is retired: metadata and SQL
// troubleshooting belong in authorized, isolated maintenance tooling.
router.get('/test', verifyToken, requireAdmin, retiredAmnestyMaintenance);
router.get('/debug', verifyToken, requireAdmin, retiredAmnestyMaintenance);

// POST /api/amnistia/fix-primary-key - deprecated dangerous HTTP schema mutation
router.post('/fix-primary-key', verifyToken, requireAdmin, retiredAmnestyMaintenance);

module.exports = router;
