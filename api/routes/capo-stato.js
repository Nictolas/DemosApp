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

// POST /api/capo-stato/vota - Endpoint principale per voti (con autenticazione)
router.post('/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('🚨🚨🚨 POST /api/capo-stato/vota - RICHIESTA RICEVUTA 🚨🚨🚨');
  console.log('🚨🚨🚨 Request ID:', requestId);
  console.log('🚨🚨🚨 Timestamp:', new Date().toISOString());
  console.log('🚨🚨🚨 Method:', req.method);
  console.log('🚨🚨🚨 URL:', req.url);

  let client = null;
  try {
    console.log('🔍 DEBUG /api/capo-stato/vota - Richiesta ricevuta');

    const { voti } = req.body;
    // Usa req.userId con fallback a req.user.id per sicurezza
    const userId = req.userId || req.user?.id;

    if (!userId) {
      console.log('❌ DEBUG - User ID non trovato');
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }


    if (!Array.isArray(voti)) {
      console.log('❌ DEBUG - Voti non è un array:', typeof voti);
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }

    if (voti.some(isIneligibleCandidate)) {
      return res.status(422).json({
        success: false,
        error: 'Candidato non selezionabile',
        message: 'La persona indicata non e piu eleggibile per questa votazione'
      });
    }

    // Controlla il limite di 1 voto massimo per Capo di Stato
    if (voti.length > 1) {
      console.log('❌ DEBUG - Troppi voti:', voti.length);
      return res.status(400).json({
        success: false,
        error: 'Puoi selezionare al massimo 1 candidato per Capo di Stato'
      });
    }

    const isAdmin = Boolean(req.user?.isAdmin);
    let userIdColumn = 'userid';
    let idType = 'uuid';

    try {
      const tableInfo = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE LOWER(table_name) = 'voti_capo_stato'
        ORDER BY ordinal_position
      `);
      const columns = tableInfo.rows.map((row) => row.column_name);
      if (!columns.includes('userid') && columns.includes('userId')) {
        // Compatibilità schema legacy: il nome viene usato solo in query interpolate da questa allowlist.
        // eslint-disable-next-line no-unused-vars
        userIdColumn = 'userId';
      }
      const idColumn = tableInfo.rows.find((row) => row.column_name === 'id');
      if (idColumn) idType = idColumn.data_type;
    } catch (tableInfoError) {
      console.warn('Impossibile rilevare struttura voti_capo_stato, uso schema canonico:', tableInfoError.message);
    }

    const existingResult = await pool.query(
      `SELECT nome, timestamp FROM voti_capo_stato WHERE ${userIdColumn} = $1 ORDER BY timestamp DESC LIMIT 1`,
      [userId]
    );
    const existingVote = existingResult.rows[0] || null;
    const requestedVote = voti.length > 0 ? String(voti[0]) : null;
    const currentVote = existingVote?.nome ? String(existingVote.nome) : null;
    const preferenceChanged = requestedVote !== currentVote;

    if (!preferenceChanged) {
      return res.json({ success: true, message: 'Preferenza già aggiornata', voti });
    }

    await assertPreferenceChangeAllowed(pool, {
      userId,
      scope: 'capo-stato:preferenza',
      fallbackChangedAt: existingVote?.timestamp || null,
      isAdmin
    });

    // Inizia una transazione
    console.log('🔍 DEBUG - Inizio transazione');
    client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Prima elimina tutti i voti esistenti dell'utente
      console.log('🔍 DEBUG - Eliminazione voti esistenti per user:', userId);
      const deleteQuery = `DELETE FROM voti_capo_stato WHERE ${userIdColumn} = $1`;
      const deleteResult = await client.query(deleteQuery, [userId]);
      console.log('🔍 DEBUG - Voti eliminati:', deleteResult.rowCount);

      // Poi inserisce i nuovi voti
      if (voti.length > 0) {
        console.log('🔍 DEBUG - Inserimento nuovi voti:', voti.length);

        for (const nome of voti) {
          // Genera ID in base al tipo della colonna
          let votoId;
          if (idType === 'uuid') {
            // Se la colonna è UUID, genera un UUID
            const uuidResult = await client.query('SELECT gen_random_uuid() as id');
            votoId = uuidResult.rows[0].id;
          } else {
            // Se è VARCHAR o TEXT, usa una stringa
            votoId = `voto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }


          // Inserisci il voto
          const insertQuery = `
            INSERT INTO voti_capo_stato (id, ${userIdColumn}, nome, timestamp)
            VALUES ($1, $2, $3, NOW())
          `;
          const insertParams = [votoId, userId, nome];

          await client.query(insertQuery, insertParams);
          console.log('✅ DEBUG - Voto inserito con successo');
        }

        console.log('🔍 DEBUG - Tutti i voti inseriti con successo');
      }

      // Conferma la transazione
      console.log('🔍 DEBUG - Commit transazione');
      await recordPreferenceChange(client, { userId, scope: 'capo-stato:preferenza' });

      await client.query('COMMIT');

      console.log('✅ DEBUG - Voti salvati con successo');
      res.json({
        success: true,
        message: 'Voti salvati con successo',
        voti: voti
      });
    } catch (error) {
      // Rollback in caso di errore
      console.error('❌ DEBUG - Errore nella transazione, rollback:', error.message);
      console.error('❌ DEBUG - Stack trace:', error.stack);
      console.error('❌ DEBUG - Error code:', error.code);
      console.error('❌ DEBUG - Error detail:', error.detail);
      console.error('❌ DEBUG - Error hint:', error.hint);
      console.error('❌ DEBUG - Error name:', error.name);
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ DEBUG - Errore durante rollback:', rollbackError.message);
      }
      throw error;
    } finally {
      if (client) {
        client.release();
        client = null;
        console.log('🔍 DEBUG - Client rilasciato');
      }
    }
  } catch (error) {
    if (sendCooldownError(res, error)) return;
    console.error('❌❌❌ ERRORE CRITICO nel salvataggio voti capo di stato ❌❌❌');
    console.error('❌ Request ID:', requestId);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error detail:', error.detail);
    console.error('❌ Error hint:', error.hint);
    console.error('❌ Error stack:', error.stack);

    // Rilascia il client se non è stato rilasciato
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Errore nel rilasciare client:', releaseError.message);
      }
    }

    // Assicurati che la risposta non sia già stata inviata
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Errore interno del server',
        details: error.message,
        code: error.code,
        requestId: requestId
      });
    } else {
      console.error('❌ Risposta già inviata, impossibile inviare errore');
    }
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
