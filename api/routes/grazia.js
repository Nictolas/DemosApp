const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { getPoliticalConsentState } = require('../services/politicalConsentService');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');

const router = express.Router();

// POST /api/grazia - Crea richiesta di grazia
router.post('/', verifyToken, validateInput(['nome_carcerato', 'motivo']), async (req, res) => {
  try {
    const { nome_carcerato, motivo } = req.body;
    const userId = req.userId;

    const query = `
      INSERT INTO richieste_grazia (utente_id, nome_carcerato, motivo, stato, created_at)
      VALUES ($1, $2, $3, 'in_attesa', NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [userId, nome_carcerato, motivo]);

    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione richiesta grazia'
    });
  }
});

// GET /api/grazia - public catalog, never raw individual political ballots.
router.get('/', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
}, async (req, res) => {
  try {
    // Legacy schemas use different column names; interpolate only allowlisted identifiers.
    const columnsResult = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'voti_grazia'
    `);
    const columnNames = new Set(columnsResult.rows.map(row => row.column_name));
    const userIdColumn = ['userid', 'user_id', 'userId'].find(name => columnNames.has(name));
    if (!userIdColumn) throw new Error('Unsupported grace vote user column');
    const timeColumn = ['timestamp', 'data_voto', 'created_at'].find(name => columnNames.has(name));
    const ownerColumn = 'vg."' + userIdColumn + '"';

    let userId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId || decoded.sub || null;
      } catch (_error) {
        // Invalid tokens get only the public catalog, without personal data.
      }
    }

    // A revoked account cannot contribute residual ballots to public totals.
    const classificaResult = await pool.query(`
      WITH voti_per_nome AS (
        SELECT BTRIM(vg.nome) AS nome, COUNT(*)::bigint AS richieste
        FROM voti_grazia vg
        JOIN users u ON u.id::text = ${ownerColumn}::text
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE vg.nome IS NOT NULL AND LENGTH(BTRIM(vg.nome)) > 0
          AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
        GROUP BY BTRIM(vg.nome)
      ), classificati AS (
        SELECT v.nome, v.richieste
        FROM voti_per_nome v
        WHERE NOT EXISTS (
          SELECT 1 FROM grazia_carcerati c
          WHERE LOWER(BTRIM(c.nome)) = LOWER(v.nome) AND c.attivo = false
        )
        UNION ALL
        SELECT nome, 0::bigint AS richieste FROM grazia_carcerati WHERE attivo = true
      )
      SELECT nome, SUM(richieste)::integer AS richieste
      FROM classificati GROUP BY nome ORDER BY richieste DESC, nome ASC
    `);

    let mieiVoti = [];
    let blocco = { isBlocked: false, unlockDate: null };
    if (userId) {
      // Read each personal ballot and Art. 9 consent in one SQL statement.
      const mieiVotiResult = await pool.query(`
        SELECT vg.nome, ${timeColumn ? 'vg."' + timeColumn + '" AS changed_at' : 'NULL::timestamptz AS changed_at'}
        FROM voti_grazia vg
        JOIN users u ON u.id::text = ${ownerColumn}::text
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE ${ownerColumn} = $1
          AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
        ${timeColumn ? 'ORDER BY vg."' + timeColumn + '" DESC' : ''}
      `, [userId]);
      mieiVoti = mieiVotiResult.rows.map(row => row.nome);
      if (mieiVotiResult.rows.length > 0) {
        const cooldown = await getPreferenceCooldown(pool, {
          userId, scope: 'grazia:preferenza',
          fallbackChangedAt: mieiVotiResult.rows[0].changed_at || null
        });
        blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
      }
    }

    // Preserve the response key for old clients, but never return raw vote records.
    return res.json({ success: true, classifica: classificaResult.rows,
      richieste: [], mieiVoti, blocco });
  } catch (error) {
    console.error('Errore nel recupero catalogo Grazia:', error);
    return res.status(500).json({ success: false, error: 'Errore nel recuperare richieste grazia' });
  }
});

// GET /api/grazia/richieste - Ottieni richieste per gestione
router.get('/richieste', verifyToken, requireAdmin, async (req, res) => {
  try {
    // SOLUZIONE: Uso solo voti_grazia senza JOIN problematico
    const query = `
      SELECT *
      FROM voti_grazia
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      richieste: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia'
    });
  }
});

// POST /api/grazia/vota - Preferenza politica serializzata con la revoca.
// No-store applies even to authentication, validation and error responses.
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
        success: false, error: 'Puoi selezionare al massimo 1 carcerato per Grazia'
      });
    }
    if (voti.length > 0 && (typeof voti[0] !== 'string' || voti[0].trim().length === 0)) {
      return res.status(400).json({ success: false, error: 'Preferenza Grazia non valida' });
    }
    const requestedVote = voti.length > 0 ? voti[0].trim() : null;

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    // Consent revocation locks this same users row before erasing votes.
    // The check after obtaining the lock is authoritative; middleware alone is not.
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
        success: false, error: 'Consenso richiesto',
        code: 'POLITICAL_CONSENT_REQUIRED',
        consent_required: true
      });
    }

    // Legacy column names are selected only from hardcoded allowlists.
    // Schema probing, previous-vote read and cooldown use the locked client.
    const schema = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'voti_grazia' ORDER BY ordinal_position"
    );
    const columns = new Set(schema.rows.map(row => row.column_name));
    const userIdColumn = ['userid', 'user_id', 'userId'].find(name => columns.has(name));
    const timestampColumn = ['timestamp', 'data_voto', 'created_at'].find(name => columns.has(name));
    if (!userIdColumn || !timestampColumn) throw new Error('Unsupported Grazia vote schema');
    const quotedUserColumn = '"' + userIdColumn + '"';
    const quotedTimestamp = '"' + timestampColumn + '"';
    const idType = schema.rows.find(row => row.column_name === 'id')?.data_type || 'uuid';

    const existingResult = await client.query(
      'SELECT nome, ' + quotedTimestamp + ' AS changed_at FROM voti_grazia WHERE ' +
        quotedUserColumn + ' = $1 ORDER BY ' + quotedTimestamp + ' DESC LIMIT 1',
      [userId]
    );
    const previousVote = existingResult.rows[0] || null;
    const currentVote = previousVote?.nome == null ? null : String(previousVote.nome).trim();
    if (requestedVote === currentVote) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.json({ success: true, message: 'Preferenza Grazia già aggiornata' });
    }

    await assertPreferenceChangeAllowed(client, {
      userId,
      scope: 'grazia:preferenza',
      fallbackChangedAt: previousVote?.changed_at || null,
      isAdmin: Boolean(req.user?.isAdmin)
    });

    await client.query(
      'DELETE FROM voti_grazia WHERE ' + quotedUserColumn + ' = $1',
      [userId]
    );
    if (requestedVote !== null) {
      let voteId;
      if (idType === 'uuid') {
        voteId = (await client.query('SELECT gen_random_uuid() AS id')).rows[0].id;
      } else {
        voteId = 'voto_grazia_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
      }
      await client.query(
        'INSERT INTO voti_grazia (id, ' + quotedUserColumn + ', nome, ' +
          quotedTimestamp + ') VALUES ($1, $2, $3, NOW())',
        [voteId, userId, requestedVote]
      );
    }

    await recordPreferenceChange(client, { userId, scope: 'grazia:preferenza' });
    await client.query('COMMIT');
    transactionStarted = false;
    return res.json({ success: true, message: 'Voti grazia salvati' });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackError) {
        console.error('Rollback preferenza Grazia non riuscito');
      }
    }
    if (sendCooldownError(res, error)) return;
    // No vote values, user IDs, SQL details or stack traces in HTTP/logs.
    console.error('Errore interno durante il salvataggio preferenza Grazia');
    return res.status(500).json({
      success: false,
      error: 'Errore nel salvare voti grazia'
    });
  } finally {
    if (client) client.release();
  }
});

// POST /api/grazia/richiesta/:id/:action - Gestisci richiesta grazia
router.post('/richiesta/:id/:action', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id, action } = req.params;

    if (action === 'approve') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['approvata', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['rifiutata', id]);
    }

    res.json({ success: true, message: `Richiesta ${action === 'approve' ? 'approvata' : 'rifiutata'}` });
  } catch (error) {
    console.error('❌ Errore nella gestione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella gestione richiesta grazia'
    });
  }
});

module.exports = router;
