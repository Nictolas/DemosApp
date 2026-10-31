const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
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

// GET /api/capo-stato - Lista candidati capo di stato con classifica voti
router.get('/', async (req, res) => {
  try {
    // Una sola lettura aggregata: conserva i candidati legacy e rende visibili
    // i soggetti approvati dall'Admin anche prima del primo voto.
    // Richiede la migrazione DRAFT capo_stato_soggetti_approvati prima del deploy.
    const classificaQuery = `
      WITH conteggi AS (
        SELECT nome, COUNT(*) AS voti FROM voti_capo_stato GROUP BY nome
      ), catalogo AS (
        SELECT nome FROM conteggi
        UNION
        SELECT nome FROM capo_stato_soggetti_approvati WHERE active = true
      )
      SELECT catalogo.nome, COALESCE(conteggi.voti, 0) AS voti
      FROM catalogo LEFT JOIN conteggi ON conteggi.nome = catalogo.nome
      ORDER BY voti DESC, catalogo.nome ASC
    `;

    const classificaResult = await pool.query(classificaQuery);

    console.log('🔍 DEBUG /api/capo-stato - Candidati trovati:', classificaResult.rows.length);

    // Processa la classifica per il frontend
    const classifica = classificaResult.rows
      .filter(candidato => !isIneligibleCandidate(candidato.nome))
      .map(candidato => ({
        nome: candidato.nome,
        voti: parseInt(candidato.voti, 10)
      }));

    // Ottieni i voti dell'utente corrente se autenticato
    let mieiVoti = [];
    let blocco = {
      isBlocked: false,
      unlockDate: null
    };

    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Controlla il ruolo dell'utente
        const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
        const userResult = await pool.query(userQuery, [userId]);
        const userRole = userResult.rows[0]?.ruolo;

        // Cooldown canonico: la singola preferenza Capo di Stato può cambiare al massimo ogni 24 ore.
        if (userRole !== 'Admin' && userRole !== 'AD') {
          const tableInfoResult = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'voti_capo_stato'
          `);
          const voteColumns = tableInfoResult.rows.map((row) => row.column_name);
          const cooldownUserColumn = voteColumns.includes('userid') ? 'userid' : 'userId';
          const lastResult = await pool.query(
            `SELECT MAX(timestamp) AS last_changed_at FROM voti_capo_stato WHERE ${cooldownUserColumn} = $1`,
            [userId]
          );
          const cooldown = await getPreferenceCooldown(pool, {
            userId,
            scope: 'capo-stato:preferenza',
            fallbackChangedAt: lastResult.rows[0]?.last_changed_at || null
          });
          blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
        }

        // Verifica la struttura della tabella per capire quale colonna usare
        const tableInfoQuery = `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'voti_capo_stato'
          ORDER BY ordinal_position
        `;
        const tableInfo = await pool.query(tableInfoQuery);
        const columns = tableInfo.rows.map(r => r.column_name);
        const hasUserId = columns.includes('userId');
        const hasUserid = columns.includes('userid');
        const userIdColumn = hasUserid ? 'userid' : (hasUserId ? 'userId' : 'userid'); // Default a userid

        const userVotiQuery = `
          SELECT nome
          FROM voti_capo_stato
          WHERE ${userIdColumn} = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.nome);
      } catch (authError) {
        console.log('⚠️ Token non valido per capo di stato:', authError.message);
      }
    }

    const responseData = {
      success: true,
      classifica,
      mieiVoti,
      blocco
    };

    res.json(responseData);
  } catch (error) {
    console.error('❌ Errore nel recupero candidati capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
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

    // Il voto non può creare nomi nuovi: ammette solo candidati legacy o
    // nuove voci già approvate dall'Admin nel catalogo dedicato.
    if (voti.length === 1) {
      if (typeof voti[0] !== 'string' || !voti[0].trim() || voti[0].length > 160) {
        return res.status(400).json({ success: false, error: 'Nome candidato non valido' });
      }
      const allowed = await pool.query(
        `SELECT 1 WHERE
          EXISTS (SELECT 1 FROM voti_capo_stato WHERE nome = $1)
          OR EXISTS (SELECT 1 FROM capo_stato_soggetti_approvati
                     WHERE active = true AND nome = $1)`,
        [voti[0]]
      );
      if (!allowed.rows.length) {
        return res.status(422).json({
          success: false,
          error: 'Candidato non presente nel catalogo attuale. Le nuove proposte richiedono approvazione.',
        });
      }
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

// GET /api/capo-stato/consenso - Ottieni i dati di consenso
router.get('/consenso', async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/consenso GET - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);

    // Ottieni i voti di consenso dell'utente corrente se autenticato
    let mioConsenso = null;
    let blocco = {
      isBlocked: false,
      unlockDate: null
    };

    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.email;

        console.log('🔍 DEBUG - Token decodificato:', decoded);
        console.log('🔍 DEBUG - User ID:', userId);

        // Controlla se l'utente ha già votato per il consenso
        const consensoQuery = `
          SELECT risposta, timestamp
          FROM consenso_capo_stato
          WHERE userid = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `;

        const consensoResult = await pool.query(consensoQuery, [userId]);

        if (consensoResult.rows.length > 0) {
          mioConsenso = {
            risposta: consensoResult.rows[0].risposta,
            timestamp: consensoResult.rows[0].timestamp
          };
        }

        const cooldown = await getPreferenceCooldown(pool, {
          userId,
          scope: 'capo-stato:consenso',
          fallbackChangedAt: consensoResult.rows[0]?.timestamp || null
        });
        blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
      } catch (error) {
        console.log('🔍 DEBUG - Token non valido per consenso:', error.message);
      }
    }

    // Ottieni le statistiche aggregate dei voti di consenso
    const statsQuery = `
      SELECT
        risposta,
        COUNT(*) as conteggio
      FROM consenso_capo_stato
      GROUP BY risposta
      ORDER BY risposta
    `;

    const statsResult = await pool.query(statsQuery);

    const statistiche = {
      'Sì': 0,
      'Non so': 0,
      'No': 0,
      totale: 0
    };

    statsResult.rows.forEach(row => {
      statistiche[row.risposta] = parseInt(row.conteggio);
      statistiche.totale += parseInt(row.conteggio);
    });

    res.json({
      success: true,
      data: {
        mioConsenso,
        statistiche,
        blocco
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero dati consenso:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/capo-stato/consenso - Salva il voto di consenso
router.post('/consenso', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/consenso - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);
    console.log('🔍 DEBUG - Body:', req.body);
    console.log('🔍 DEBUG - User:', req.user);

    const { risposta } = req.body;
    const userId = req.user.id;


    if (!risposta || !['Sì', 'Non so', 'No'].includes(risposta)) {
      return res.status(400).json({
        success: false,
        error: 'Risposta non valida. Deve essere "Sì", "Non so" o "No"'
      });
    }

    const currentResult = await pool.query(
      `SELECT risposta, timestamp
       FROM consenso_capo_stato
       WHERE userid = $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [userId]
    );
    const current = currentResult.rows[0] || null;
    if (current?.risposta === risposta) {
      return res.json({ success: true, message: 'Consenso già aggiornato', data: current });
    }

    await assertPreferenceChangeAllowed(pool, {
      userId,
      scope: 'capo-stato:consenso',
      fallbackChangedAt: current?.timestamp || null,
      isAdmin: Boolean(req.user?.isAdmin)
    });

    // Inizia transazione
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Elimina il voto precedente se esiste
      await client.query(
        'DELETE FROM consenso_capo_stato WHERE userid = $1',
        [userId]
      );

      // Inserisce il nuovo voto
      const votoId = `consenso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await client.query(
        `INSERT INTO consenso_capo_stato (
          id, userid, risposta, timestamp, created_at, updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
        [votoId, userId, risposta]
      );

      // Conferma la transazione
      await recordPreferenceChange(client, { userId, scope: 'capo-stato:consenso' });

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Voto di consenso salvato con successo',
        data: {
          risposta,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Rollback in caso di errore
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    if (sendCooldownError(res, error)) return;
    console.error('❌ Errore nel salvataggio consenso:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
