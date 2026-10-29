const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { getPoliticalConsentState } = require('../services/politicalConsentService');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { getPool } = require('../config/database');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// I candidati non piu' eleggibili non devono apparire nella classifica ne' ricevere nuovi voti.
// Il confronto normalizzato gestisce anche spazi Unicode come U+202F.
const normalizeCandidateName = (name) =>
  String(name || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const INELIGIBLE_CANDIDATE_NAMES = new Set(['emmabonino']);
const isIneligibleCandidate = (name) => INELIGIBLE_CANDIDATE_NAMES.has(normalizeCandidateName(name));

// ===== ENDPOINTS PER CAPO DI STATO =====

// GET /api/capo-stato - public aggregate plus the authenticated account's choice.
// The response can include personal political preferences: never cache it.
router.get('/', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
}, async (req, res) => {
  try {
    // The old schema uses userid; some deployments use a quoted userId.
    // Only allowlisted column names may be interpolated into SQL.
    const columns = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'voti_capo_stato'"
    );
    const available = new Set(columns.rows.map(row => row.column_name));
    const userColumn = ['userid', 'userId', 'user_id'].find(name => available.has(name));
    if (!userColumn) throw new Error('Unsupported head-of-state vote user column');
    const userRef = 'v."' + userColumn + '"';

    // A vote left over after consent revocation must not affect rankings.
    const classificaResult = await pool.query(`
      SELECT v.nome, COUNT(*) AS voti
      FROM voti_capo_stato v
      JOIN users u ON u.id::text = ${userRef}::text
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE COALESCE(
        uc.political_opinions_consent, u.political_opinions_consent, false
      ) IS TRUE
      GROUP BY v.nome
      ORDER BY voti DESC, v.nome ASC
    `);
    const classifica = classificaResult.rows
      .filter(candidate => !isIneligibleCandidate(candidate.nome))
      .map(candidate => ({ nome: candidate.nome, voti: Number(candidate.voti) }));

    let mieiVoti = [];
    let blocco = { isBlocked: false, unlockDate: null };
    if (req.headers.authorization) {
      let userId = null;
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId || decoded.sub || decoded.id || null;
      } catch (_error) {
        // Invalid authentication cannot expose personalized vote data.
      }
      if (userId) {
        // Consent and the personal vote are read in the SAME statement.
        const personalResult = await pool.query(`
          SELECT v.nome, v.timestamp AS changed_at, u.ruolo
          FROM voti_capo_stato v
          JOIN users u ON u.id::text = ${userRef}::text
          LEFT JOIN user_consents uc ON uc.user_id = u.id
          WHERE ${userRef} = $1
            AND COALESCE(
              uc.political_opinions_consent, u.political_opinions_consent, false
            ) IS TRUE
          ORDER BY v.timestamp DESC
        `, [userId]);
        mieiVoti = personalResult.rows.map(row => row.nome);
        const lastVote = personalResult.rows[0];
        if (lastVote && !['Admin', 'AD'].includes(lastVote.ruolo)) {
          const cooldown = await getPreferenceCooldown(pool, {
            userId,
            scope: 'capo-stato:preferenza',
            fallbackChangedAt: lastVote.changed_at || null
          });
          blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
        }
      }
    }
    return res.json({ success: true, classifica, mieiVoti, blocco });
  } catch (error) {
    console.error('Errore nel recupero classifica Capo di Stato:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Endpoint rimosso - duplicato, usa quello alla riga 265

// POST /api/capo-stato/test-vota - endpoint di test disattivato per sicurezza
router.post('/test-vota', (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Endpoint di test disattivato. Usa /api/capo-stato/vota.'
  });
});

// POST /api/capo-stato/vota - Preferenza politica, serializzata con la revoca.
// Set no-store BEFORE authentication, including validation and failure responses.
router.post('/vota', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
}, verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
  let client = null;
  let transactionStarted = false;
  try {
    const userId = req.userId || req.user?.id;
    const { voti } = req.body || {};
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Utente non autenticato' });
    }
    if (!Array.isArray(voti)) {
      return res.status(400).json({ success: false, error: 'I voti devono essere un array' });
    }
    if (voti.length > 1) {
      return res.status(400).json({
        success: false, error: 'Puoi selezionare al massimo 1 candidato per Capo di Stato'
      });
    }
    if (voti.length > 0 && (typeof voti[0] !== 'string' || voti[0].trim().length === 0)) {
      return res.status(400).json({ success: false, error: 'Candidato non valido' });
    }
    if (voti.some(isIneligibleCandidate)) {
      return res.status(422).json({
        success: false, error: 'Candidato non selezionabile',
        message: 'La persona indicata non e piu eleggibile per questa votazione'
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    // Revocation locks the same user row before deleting consent-scoped votes.
    // Recheck consent after acquiring that lock, on the SAME client.
    const lockedUser = await client.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]
    );
    if (lockedUser.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    const consentState = await getPoliticalConsentState(client, userId);
    if (!consentState.granted) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(403).json({
        success: false, error: 'Consenso richiesto',
        code: 'POLITICAL_CONSENT_REQUIRED', consent_required: true
      });
    }

    // Supported legacy schemas have different user column casing / ID types.
    // Only literal allowlisted identifiers are used in SQL interpolation.
    const schema = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE LOWER(table_name) = 'voti_capo_stato' ORDER BY ordinal_position"
    );
    const columns = new Set(schema.rows.map(row => row.column_name));
    const column = ['userid', 'userId', 'user_id'].find(name => columns.has(name));
    if (!column) throw new Error('Unsupported vote schema');
    const userColumn = '"' + column + '"';
    const idType = schema.rows.find(row => row.column_name === 'id')?.data_type || 'uuid';

    // Both the current vote and cooldown must be read AFTER the lock.
    const existingResult = await client.query(
      'SELECT nome, timestamp FROM voti_capo_stato WHERE ' + userColumn + ' = $1 ORDER BY timestamp DESC LIMIT 1',
      [userId]
    );
    const current = existingResult.rows[0] || null;
    const desiredVote = voti.length > 0 ? voti[0] : null;
    const currentVote = current?.nome == null ? null : String(current.nome);
    if (desiredVote === currentVote) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.json({ success: true, message: 'Preferenza già aggiornata', voti });
    }

    await assertPreferenceChangeAllowed(client, {
      userId, scope: 'capo-stato:preferenza',
      fallbackChangedAt: current?.timestamp || null,
      isAdmin: Boolean(req.user?.isAdmin)
    });
    await client.query('DELETE FROM voti_capo_stato WHERE ' + userColumn + ' = $1', [userId]);

    if (desiredVote !== null) {
      let voteId;
      if (idType === 'uuid') {
        voteId = (await client.query('SELECT gen_random_uuid() AS id')).rows[0].id;
      } else {
        voteId = 'voto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
      }
      await client.query(
        'INSERT INTO voti_capo_stato (id, ' + userColumn + ', nome, timestamp) VALUES ($1, $2, $3, NOW())',
        [voteId, userId, desiredVote]
      );
    }
    await recordPreferenceChange(client, { userId, scope: 'capo-stato:preferenza' });
    await client.query('COMMIT');
    transactionStarted = false;
    return res.json({ success: true, message: 'Voti salvati con successo', voti });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackError) {
        console.error('Rollback preferenza Capo di Stato non riuscito');
      }
    }
    if (sendCooldownError(res, error)) return;
    // Error details/stack traces could include political preferences or IDs.
    console.error('Errore interno durante il salvataggio preferenza Capo di Stato');
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  } finally {
    if (client) client.release();
  }
});

// POST /api/capo-stato - endpoint legacy disattivato: non accetta più userid dal client
router.post('/', (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Endpoint legacy disattivato. Usa /api/capo-stato/vota.'
  });
});

// ===== ENDPOINTS PER CONSENSO CAPO DI STATO =====

// This endpoint mixes public totals and personalized political preferences.
// Disable HTTP caching before authentication, including error responses.
const noStoreHeadOfStateConsent = (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
};

// GET /api/capo-stato/consenso - Ottieni i dati di consenso
router.get('/consenso', noStoreHeadOfStateConsent, async (req, res) => {
  try {
    let mioConsenso = null;
    let blocco = { isBlocked: false, unlockDate: null };

    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.email;

        // Consent is checked by the same SQL statement that reads the answer:
        // a residual row after revocation must not be returned to the client.
        const consensoResult = await pool.query(
          [
            'SELECT cc.risposta, cc.timestamp',
            'FROM consenso_capo_stato cc',
            'JOIN users u ON u.id::text = cc.userid::text',
            'LEFT JOIN user_consents uc ON uc.user_id = u.id',
            'WHERE cc.userid = $1',
            'AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE',
            'ORDER BY cc.timestamp DESC LIMIT 1'
          ].join(' '),
          [userId]
        );

        if (consensoResult.rows.length > 0) {
          mioConsenso = {
            risposta: consensoResult.rows[0].risposta,
            timestamp: consensoResult.rows[0].timestamp
          };
          const cooldown = await getPreferenceCooldown(pool, {
            userId,
            scope: 'capo-stato:consenso',
            fallbackChangedAt: consensoResult.rows[0]?.timestamp || null
          });
          blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
        }
      } catch (error) {
        console.warn('Token non valido per consenso Capo di Stato');
      }
    }

    // Exclude residual votes of users whose Art. 9 consent is revoked.
    const statsResult = await pool.query(
      [
        'SELECT cc.risposta, COUNT(*) AS conteggio',
        'FROM consenso_capo_stato cc',
        'JOIN users u ON u.id::text = cc.userid::text',
        'LEFT JOIN user_consents uc ON uc.user_id = u.id',
        'WHERE COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE',
        'GROUP BY cc.risposta ORDER BY cc.risposta'
      ].join(' ')
    );

    const statistiche = { 'Sì': 0, 'Non so': 0, 'No': 0, totale: 0 };
    statsResult.rows.forEach((row) => {
      const count = parseInt(row.conteggio, 10);
      statistiche[row.risposta] = count;
      statistiche.totale += count;
    });

    return res.json({ success: true, data: { mioConsenso, statistiche, blocco } });
  } catch (error) {
    console.error('Errore nel recupero dati consenso Capo di Stato:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// POST /api/capo-stato/consenso - Salva il voto di consenso
router.post('/consenso', noStoreHeadOfStateConsent, verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
  let client = null;
  let transactionStarted = false;
  try {
    const { risposta } = req.body || {};
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Utente non autenticato' });
    }
    if (!['Sì', 'Non so', 'No'].includes(risposta)) {
      return res.status(400).json({
        success: false,
        error: 'Risposta non valida. Deve essere "Sì", "Non so" o "No"'
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    // Revocation updates users before erasing political choices. Lock the
    // same row, then recheck consent *after* acquiring the lock.
    const lockedUser = await client.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (lockedUser.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    const consentState = await getPoliticalConsentState(client, userId);
    if (!consentState.granted) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(403).json({
        success: false,
        error: 'Consenso richiesto',
        code: 'POLITICAL_CONSENT_REQUIRED',
        consent_required: true
      });
    }

    const currentResult = await client.query(
      'SELECT risposta, timestamp FROM consenso_capo_stato WHERE userid = $1 ORDER BY timestamp DESC LIMIT 1',
      [userId]
    );
    const current = currentResult.rows[0] || null;
    if (current?.risposta === risposta) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.json({ success: true, message: 'Consenso già aggiornato', data: current });
    }

    await assertPreferenceChangeAllowed(client, {
      userId,
      scope: 'capo-stato:consenso',
      fallbackChangedAt: current?.timestamp || null,
      isAdmin: Boolean(req.user?.isAdmin)
    });

    await client.query('DELETE FROM consenso_capo_stato WHERE userid = $1', [userId]);
    const votoId = 'consenso_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    await client.query(
      [
        'INSERT INTO consenso_capo_stato (',
        'id, userid, risposta, timestamp, created_at, updated_at',
        ') VALUES ($1, $2, $3, NOW(), NOW(), NOW())'
      ].join(' '),
      [votoId, userId, risposta]
    );
    await recordPreferenceChange(client, { userId, scope: 'capo-stato:consenso' });
    await client.query('COMMIT');
    transactionStarted = false;

    return res.json({
      success: true,
      message: 'Voto di consenso salvato con successo',
      data: { risposta, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Errore rollback consenso Capo di Stato:', rollbackError);
      }
    }
    if (sendCooldownError(res, error)) return;
    console.error('Errore nel salvataggio consenso Capo di Stato:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
