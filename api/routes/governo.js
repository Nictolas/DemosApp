const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { getPoliticalConsentState } = require('../services/politicalConsentService');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { getPool } = require('../config/database');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');
const { verifyAccessToken } = require('../utils/jwt');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// ===== ENDPOINTS PER GOVERNO =====

// GET /api/governo/voti - consent-gated own votes, consent-only public rankings.
router.get('/voti', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
}, verifyToken, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Utente non autenticato' });

    // Table identifiers come only from this fixed allowlist, never from HTTP.
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno',
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente',
      'ambiente_sicurezza_energetica', 'cultura', 'sport'
    ];
    const classifiche = {};
    let mieiVoti = {};
    let blocchi = {};
    const consentState = await getPoliticalConsentState(pool, userId);

    for (const ministero of ministeri) {
      const tableName = 'voti_' + ministero;
      const defaultBlock = { isBlocked: false, unlockDate: null };
      blocchi[ministero] = defaultBlock;
      classifiche[ministero] = [];
      try {
        // A vote left in a table after revocation must never inflate rankings.
        const ranking = await pool.query(
          'SELECT v.nome_display AS nome, COUNT(*)::integer AS voti ' +
          'FROM ' + tableName + ' v ' +
          'JOIN users u ON u.id::text = v.userid::text ' +
          'LEFT JOIN user_consents uc ON uc.user_id = u.id ' +
          'WHERE COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE ' +
          'GROUP BY v.nome_display ORDER BY voti DESC, v.nome_display ASC'
        );
        classifiche[ministero] = ranking.rows.map(row => ({
          nome: row.nome, voti: Number(row.voti)
        }));

        if (!consentState.granted) continue;
        // Read individual choices and Art. 9 consent in the same SQL statement.
        const own = await pool.query(
          'SELECT v.nome_display AS nome, v.timestamp ' +
          'FROM ' + tableName + ' v ' +
          'JOIN users u ON u.id::text = v.userid::text ' +
          'LEFT JOIN user_consents uc ON uc.user_id = u.id ' +
          'WHERE v.userid::text = $1::text ' +
          'AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE ' +
          'ORDER BY v.timestamp DESC LIMIT 1',
          [userId]
        );
        const choice = own.rows[0] || null;
        if (choice) mieiVoti[ministero] = choice.nome;

        if (req.user?.isAdmin) continue;
        const cooldown = await getPreferenceCooldown(pool, {
          userId,
          scope: 'governo:' + ministero,
          fallbackChangedAt: choice?.timestamp || null
        });
        blocchi[ministero] = {
          isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate
        };
      } catch (error) {
        // Legacy installs can lack an individual ministry table.
        // Only undefined-table errors preserve the former empty-section behavior.
        if (error?.code === '42P01') {
          classifiche[ministero] = [];
          delete mieiVoti[ministero];
          blocchi[ministero] = defaultBlock;
          continue;
        }
        throw error;
      }
    }

    // If revocation finished while reading preferences/cooldowns, do not
    // serialize the earlier snapshot of personal answers or cooldown history.
    const latestConsent = await getPoliticalConsentState(pool, userId);
    if (!latestConsent.granted) {
      mieiVoti = {};
      blocchi = Object.fromEntries(ministeri.map(ministero => [
        ministero, { isBlocked: false, unlockDate: null }
      ]));
    }
    const activeBlocks = Object.values(blocchi).filter(item => item?.isBlocked);
    const legacyUnlockDate = activeBlocks.map(item => item.unlockDate).filter(Boolean).sort()[0] || null;

    return res.json({
      classifiche,
      mieiVoti,
      blocchi,
      blocco: { isBlocked: activeBlocks.length > 0, unlockDate: legacyUnlockDate }
    });
  } catch (_error) {
    console.error('Errore interno nella lettura voti Governo');
    return res.status(500).json({ success: false, error: 'Errore nel recuperare i voti del governo' });
  }
});

// POST /api/governo/vota - Preferenze ministeriali atomiche rispetto alla revoca.
// Prevent storage of personal political choices even on auth and error responses.
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
    if (!voti || typeof voti !== 'object' || Array.isArray(voti)) {
      return res.status(400).json({ success: false, error: 'I voti devono essere un oggetto' });
    }

    // Fixed allowlist: minister keys never originate from arbitrary user-supplied SQL.
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno',
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente',
      'ambiente_sicurezza_energetica', 'cultura', 'sport'
    ];
    const submitted = ministeri.filter(ministero =>
      Object.prototype.hasOwnProperty.call(voti, ministero)
    );
    // Validate the whole submitted batch before opening a database connection.
    for (const ministero of submitted) {
      const value = voti[ministero];
      if (value !== null && (typeof value !== 'string' || value.length > 250)) {
        return res.status(400).json({ success: false, error: 'Preferenza ministeriale non valida' });
      }
    }

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    // Revocation locks the same users row before erasure. Never trust an
    // earlier authorization decision or a pre-transaction vote/cooldown read.
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
        success: false,
        error: 'Consenso richiesto',
        code: 'POLITICAL_CONSENT_REQUIRED',
        consent_required: true
      });
    }

    let changedCount = 0;
    for (const ministero of submitted) {
      const requestedRaw = voti[ministero];
      const requestedName = requestedRaw === null ? null : (requestedRaw.trim() || null);
      const tableName = 'voti_' + ministero;
      const scope = 'governo:' + ministero;

      // Read, cooldown-check and replace all preferences under the user lock.
      const previousResult = await client.query(
        'SELECT nome_display AS nome, timestamp FROM ' + tableName +
          ' WHERE userid = $1 ORDER BY timestamp DESC LIMIT 1', [userId]
      );
      const previous = previousResult.rows[0] || null;
      const currentName = previous?.nome ? String(previous.nome).trim() : null;
      if (requestedName === currentName) continue;

      await assertPreferenceChangeAllowed(client, {
        userId,
        scope,
        fallbackChangedAt: previous?.timestamp || null,
        isAdmin: Boolean(req.user?.isAdmin)
      });
      await client.query('DELETE FROM ' + tableName + ' WHERE userid = $1', [userId]);
      if (requestedName) {
        const nomeKey = requestedName.toLowerCase();
        const nomeDisplay = requestedName
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        await client.query(
          'INSERT INTO ' + tableName +
            ' (id, userid, nome_ministro, nome_display, timestamp)' +
            ' VALUES (gen_random_uuid(), $1, $2, $3, NOW())',
          [userId, nomeKey, nomeDisplay]
        );
      }
      await recordPreferenceChange(client, { userId, scope });
      changedCount += 1;
    }

    if (changedCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.json({ success: true, message: 'Preferenze già aggiornate' });
    }
    await client.query('COMMIT');
    transactionStarted = false;
    return res.json({ success: true, message: 'Voti salvati con successo' });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackError) {
        console.error('Rollback preferenze ministeriali non riuscito');
      }
    }
    if (sendCooldownError(res, error)) return;
    // Never emit a political choice, user identifier or database stack in logs.
    console.error('Errore interno durante il salvataggio delle preferenze ministeriali');
    return res.status(500).json({ success: false, error: 'Errore nel salvare i voti del governo' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/governo - Lista membri del governo
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM governo ORDER BY ruolo, cognome'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/governo/ideale - never return revoked personal political votes.
router.get('/ideale', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
}, verifyToken, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Utente non autenticato' });
    const consent = await getPoliticalConsentState(pool, userId);
    if (!consent.granted) return res.json({ success: true, data: {} });

    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno',
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente',
      'ambiente_sicurezza_energetica', 'cultura', 'sport'
    ];
    const governoIdeale = {};
    for (const ministero of ministeri) {
      const tableName = 'voti_' + ministero;
      try {
        const result = await pool.query(
          'SELECT v.nome_display ' +
          'FROM ' + tableName + ' v ' +
          'JOIN users u ON u.id::text = v.userid::text ' +
          'LEFT JOIN user_consents uc ON uc.user_id = u.id ' +
          'WHERE v.userid::text = $1::text ' +
          'AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE ' +
          'ORDER BY v.timestamp DESC LIMIT 1',
          [userId]
        );
        if (result.rows[0]) governoIdeale[ministero] = result.rows[0].nome_display;
      } catch (error) {
        if (error?.code === '42P01') continue;
        throw error;
      }
    }

    // A finished revocation cannot leave an old personalized snapshot in this response.
    const finalConsent = await getPoliticalConsentState(pool, userId);
    return res.json({
      success: true,
      data: finalConsent.granted ? governoIdeale : {}
    });
  } catch (_error) {
    console.error('Errore interno nella lettura Governo ideale');
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// POST /api/governo - Aggiungi membro governo
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { nome, cognome, ruolo, partito, data_nominazione } = req.body;
    
    if (!nome || !cognome || !ruolo) {
      return res.status(400).json({
        success: false,
        error: 'Nome, cognome e ruolo sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO governo (nome, cognome, ruolo, partito, data_nominazione) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, cognome, ruolo, partito, data_nominazione]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta membro governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// ===== ENDPOINTS PER CONSENSO GOVERNO =====

// GET /api/governo/consenso - public aggregate and consent-gated own choice.
// Optional authentication can add personal choices: never allow caching.
router.get('/consenso', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
}, async (req, res) => {
  try {
    let mioConsenso = null;
    let blocco = { isBlocked: false, unlockDate: null };
    const authorization = req.headers.authorization;
    let userId = null;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      try {
        // Only signed, unexpired access tokens with correct type/issuer/audience.
        const decoded = verifyAccessToken(authorization.slice(7));
        userId = decoded.userId || decoded.sub || decoded.id || null;
      } catch (_invalidToken) {
        // Public aggregates remain available without authentication.
        // Never log headers, bearer tokens or decoded payloads.
      }
    }

    if (userId) {
      // Consent and the personal vote are read by ONE SQL statement,
      // excluding any residual vote remaining after consent revocation.
      const ownResult = await pool.query(
        'SELECT cg.risposta, cg.timestamp ' +
        'FROM consenso_governo cg ' +
        'JOIN users u ON u.id::text = cg.userid::text ' +
        'LEFT JOIN user_consents uc ON uc.user_id = u.id ' +
        'WHERE cg.userid::text = $1::text ' +
        'AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE ' +
        'ORDER BY cg.timestamp DESC LIMIT 1',
        [userId]
      );
      const consentState = await getPoliticalConsentState(pool, userId);
      if (consentState.granted) {
        const choice = ownResult.rows[0];
        if (choice) {
          mioConsenso = { risposta: choice.risposta, timestamp: choice.timestamp };
        }
        const cooldown = await getPreferenceCooldown(pool, {
          userId,
          scope: 'governo:consenso',
          fallbackChangedAt: choice?.timestamp || null
        });
        blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };

        // If revocation finished during the cooldown lookup, avoid leaking
        // preference or historic change metadata.
        const finalConsent = await getPoliticalConsentState(pool, userId);
        if (!finalConsent.granted) {
          mioConsenso = null;
          blocco = { isBlocked: false, unlockDate: null };
        }
      }
    }

    // Public totals must not count revoked accounts' residual ballots.
    const statsResult = await pool.query(
      'SELECT cg.risposta, COUNT(*)::integer AS conteggio ' +
      'FROM consenso_governo cg ' +
      'JOIN users u ON u.id::text = cg.userid::text ' +
      'LEFT JOIN user_consents uc ON uc.user_id = u.id ' +
      'WHERE COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE ' +
      'GROUP BY cg.risposta ORDER BY cg.risposta'
    );

    const statistiche = { 'Sì': 0, 'Non so': 0, 'No': 0, totale: 0 };
    for (const row of statsResult.rows) {
      if (!Object.prototype.hasOwnProperty.call(statistiche, row.risposta)
          || row.risposta === 'totale') continue;
      const count = Number(row.conteggio) || 0;
      statistiche[row.risposta] += count;
      statistiche.totale += count;
    }
    return res.json({ success: true, data: { mioConsenso, statistiche, blocco } });
  } catch (_error) {
    // Never emit DB error strings, user IDs or choices to logs.
    console.error('Errore interno nella lettura consenso Governo');
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// POST /api/governo/consenso - Scelta politica transazionale rispetto alla revoca.
// Set no-store before auth, including error and validation responses.
router.post('/consenso', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
}, verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
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

    // The consent-revocation route locks the same user row before erasure.
    // A prior middleware check does not protect in-flight political writes.
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
        success: false,
        error: 'Consenso richiesto',
        code: 'POLITICAL_CONSENT_REQUIRED',
        consent_required: true
      });
    }

    // Read the old choice, enforce cooldown, and replace it under the lock.
    const currentResult = await client.query(
      `SELECT risposta, timestamp
       FROM consenso_governo
       WHERE userid = $1
       ORDER BY timestamp DESC
       LIMIT 1`, [userId]
    );
    const current = currentResult.rows[0] || null;
    if (current?.risposta === risposta) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.json({ success: true, message: 'Consenso già aggiornato', data: current });
    }

    await assertPreferenceChangeAllowed(client, {
      userId,
      scope: 'governo:consenso',
      fallbackChangedAt: current?.timestamp || null,
      isAdmin: Boolean(req.user?.isAdmin)
    });

    await client.query('DELETE FROM consenso_governo WHERE userid = $1', [userId]);
    // Preserve the existing legacy text identifier format for this table.
    const votoId = 'consenso_gov_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    await client.query(
      `INSERT INTO consenso_governo (id, userid, risposta, timestamp, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
      [votoId, userId, risposta]
    );
    await recordPreferenceChange(client, { userId, scope: 'governo:consenso' });
    await client.query('COMMIT');
    transactionStarted = false;

    return res.json({
      success: true,
      message: 'Voto di consenso del governo salvato con successo',
      data: { risposta, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackError) {
        console.error('Rollback consenso governo non riuscito');
      }
    }
    if (sendCooldownError(res, error)) return;
    // Do not log IDs, the political choice, SQL details or stacks.
    console.error('Errore interno durante il salvataggio consenso governo');
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  } finally {
    if (client) client.release();
  }
});

// ===== ENDPOINTS PER GOVERNO ATTUALE =====

// GET /api/governo/attuale - Ottieni i ministri attuali del governo
router.get('/attuale', async (req, res) => {
  try {
    // Verifica se la tabella esiste prima di fare la query
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'governo_attuale'
      );
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    const tableExists = tableCheckResult.rows[0]?.exists;
    
    if (!tableExists) {
      // Se la tabella non esiste, restituisci un array vuoto
      console.log('⚠️ Tabella governo_attuale non esiste ancora, restituisco array vuoto');
      return res.json({
        success: true,
        data: []
      });
    }
    
    // Recupera i ministri con i dati dell'utente incluso avatar_config
    const result = await pool.query(`
      SELECT 
        ga.*,
        u.avatar_config
      FROM governo_attuale ga
      LEFT JOIN users u ON ga.user_id = u.id
      ORDER BY ga.ruolo_ministro
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    // Se l'errore è "relation does not exist", restituisci array vuoto
    if (error.code === '42P01') {
      console.log('⚠️ Tabella governo_attuale non esiste, restituisco array vuoto');
      return res.json({
        success: true,
        data: []
      });
    }
    
    console.error('❌ Errore nel recupero governo attuale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// PUT /api/governo/attuale/:ruolo - Aggiorna o crea un ministro attuale
router.put('/attuale/:ruolo', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { ruolo } = req.params;
    const { user_id } = req.body;

    // Verifica se la tabella esiste, altrimenti restituisci errore
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'governo_attuale'
      );
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    const tableExists = tableCheckResult.rows[0]?.exists;
    
    if (!tableExists) {
      return res.status(500).json({
        success: false,
        error: 'Tabella governo_attuale non esiste. Esegui lo script SQL per crearla.'
      });
    }

    // Se user_id è fornito, verifica che l'utente esista
    let userData = null;
    if (user_id) {
      const userCheckQuery = `SELECT id, nome, cognome, email FROM users WHERE id = $1`;
      const userCheckResult = await pool.query(userCheckQuery, [user_id]);
      
      if (userCheckResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Utente non trovato'
        });
      }
      
      userData = userCheckResult.rows[0];
    }

    // Decodifica il ruolo dal parametro URL
    const ruoloDecoded = decodeURIComponent(ruolo);

    // Verifica se esiste già un record per questo ruolo
    const existingQuery = `SELECT id FROM governo_attuale WHERE ruolo_ministro = $1`;
    const existingResult = await pool.query(existingQuery, [ruoloDecoded]);

    if (existingResult.rows.length > 0) {
      // Aggiorna il record esistente
      const updateQuery = `
        UPDATE governo_attuale 
        SET user_id = $1, 
            nome_utente = $2, 
            cognome_utente = $3, 
            email_utente = $4,
            updated_at = NOW()
        WHERE ruolo_ministro = $5
        RETURNING *
      `;
      
      const updateResult = await pool.query(updateQuery, [
        userData?.id || null,
        userData?.nome || null,
        userData?.cognome || null,
        userData?.email || null,
        ruoloDecoded
      ]);

      res.json({
        success: true,
        message: 'Ministro aggiornato con successo',
        data: updateResult.rows[0]
      });
    } else {
      // Crea un nuovo record (l'ID viene generato automaticamente dal database)
      const insertQuery = `
        INSERT INTO governo_attuale (
          ruolo_ministro, user_id, nome_utente, cognome_utente, email_utente, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *
      `;
      
      const insertResult = await pool.query(insertQuery, [
        ruoloDecoded,
        userData?.id || null,
        userData?.nome || null,
        userData?.cognome || null,
        userData?.email || null
      ]);

      res.json({
        success: true,
        message: 'Ministro aggiunto con successo',
        data: insertResult.rows[0]
      });
    }
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento governo attuale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
