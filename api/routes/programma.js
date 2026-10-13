const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { remember, getJson, setJson, invalidateProgrammaCaches, isEnabled } = require('../services/redisCache');
const { keys, ttl } = require('../config/cacheKeys');
const { verifyToken } = require('../middleware/auth');
const { getAccountSubject } = require('../services/accountCapabilitiesService');
const {
  isProgramSchemaError,
  toLegacyProgramView,
  resolveEditableCandidacy,
  upsertCandidacyProgram,
  getEditableProgramContextsForUser,
  getProgramByCandidacy,
  getActiveProgramsForUser,
  getMandateProgramSnapshots
} = require('../services/candidacyProgramService');

const pool = getPool();

function legacyRowToView(programma) {
  return {
    proposta1: programma.proposta_1 || '', proposta2: programma.proposta_2 || '',
    proposta3: programma.proposta_3 || '', proposta4: programma.proposta_4 || '',
    proposta5: programma.proposta_5 || '', url1: programma.url_1 || '',
    url2: programma.url_2 || '', url3: programma.url_3 || '',
    url4: programma.url_4 || '', url5: programma.url_5 || '',
    data_creazione: programma.created_at || programma.data_creazione || null,
    data_modifica: programma.updated_at || programma.data_modifica || null,
    canonical: false, frozen: false
  };
}

function sendProgramError(res, error) {
  if (error?.code?.startsWith('PROGRAMMA_')) {
    return res.status(error.statusCode || 409).json({ success: false, error: error.code, message: error.message });
  }
  throw error;
}

async function getLegacyUserProgram(userId) {
  const result = await pool.query(
    `SELECT proposta_1, proposta_2, proposta_3, proposta_4, proposta_5,
            url_1, url_2, url_3, url_4, url_5, created_at, updated_at
     FROM programmi WHERE utente_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

// Lista pubblica dei programmi correnti/snapshot; fallback legacy solo prima della migrazione.
router.get('/', async (_req, res) => {
  try {
    const body = await remember(keys.programmiList, ttl.programmiList, async () => {
      try {
        const result = await pool.query(
          `SELECT pp.*, pc.election_event_id, pc.jurisdiction
           FROM political_programs pp
           JOIN political_candidacies pc ON pc.id = pp.candidacy_id
           WHERE pc.status = 'ACTIVE'
           ORDER BY pp.updated_at DESC`
        );
        return { success: true, data: result.rows.map((row) => ({ user_id: row.user_id, ...toLegacyProgramView(row) })), canonical: true };
      } catch (error) {
        if (!isProgramSchemaError(error)) throw error;
        let result;
        try {
          result = await pool.query('SELECT * FROM programmi ORDER BY created_at DESC NULLS LAST');
        } catch (legacyError) {
          if (legacyError?.code !== '42703') throw legacyError;
          result = await pool.query('SELECT * FROM programmi ORDER BY data_creazione DESC NULLS LAST');
        }
        return { success: true, data: result.rows, canonical: false };
      }
    });
    if (isEnabled()) {
      res.set('Cache-Control', `public, max-age=${Math.min(ttl.programmiList, 45)}, s-maxage=${Math.min(ttl.programmiList, 45)}`);
    }
    return res.json(body);
  } catch (error) {
    console.error('❌ Errore nel recupero programmi:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Contesto editor autenticato: mostra tutte le candidature attive, anche senza Programma.
router.get('/edit-context', verifyToken, async (req, res) => {
  try {
    const contexts = await getEditableProgramContextsForUser(pool, req.userId);
    return res.json({ success: true, canonical: true, contexts, requires_candidacy_context: contexts.length > 1 });
  } catch (error) {
    if (isProgramSchemaError(error)) {
      return res.json({ success: true, canonical: false, contexts: [], requires_candidacy_context: false });
    }
    console.error('❌ Errore contesto editor Programma:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Lettura esplicita del Programma di una candidatura specifica.
router.get('/candidacy/:candidacyId', async (req, res) => {
  try {
    const row = await getProgramByCandidacy(pool, req.params.candidacyId);
    if (!row) return res.status(404).json({ success: false, error: 'Programma non trovato' });
    return res.json({ success: true, data: toLegacyProgramView(row) });
  } catch (error) {
    if (isProgramSchemaError(error)) {
      return res.status(503).json({ success: false, error: 'PROGRAMMA_CANONICAL_SCHEMA_REQUIRED' });
    }
    console.error('❌ Errore programma candidatura:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Compatibilità user-scoped: preferisce candidatura attiva, poi snapshot di mandato.
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, error: 'ID utente richiesto' });

    const cacheKey = keys.programmaUser(userId);
    const cached = await getJson(cacheKey);
    if (cached != null) return res.json(cached);

    let responseData;
    try {
      const active = await getActiveProgramsForUser(pool, userId);
      if (active.length > 0) {
        const programs = active.map(toLegacyProgramView);
        responseData = {
          success: true,
          data: programs[0],
          programs,
          canonical: true,
          requires_candidacy_context: programs.length > 1
        };
      } else {
        const snapshots = await getMandateProgramSnapshots(pool, userId);
        if (snapshots.length === 0) {
          return res.status(404).json({ success: false, error: 'Programma non trovato per questo utente' });
        }
        const programs = snapshots.map(toLegacyProgramView);
        responseData = { success: true, data: programs[0], programs, canonical: true, frozen: true };
      }
    } catch (error) {
      if (!isProgramSchemaError(error)) throw error;
      const legacy = await getLegacyUserProgram(userId);
      if (!legacy) return res.status(404).json({ success: false, error: 'Programma non trovato per questo utente' });
      responseData = { success: true, data: legacyRowToView(legacy), canonical: false };
    }

    await setJson(cacheKey, responseData, ttl.programmaUser);
    res.set('Cache-Control', 'private, max-age=15');
    return res.json(responseData);
  } catch (error) {
    console.error('❌ Errore nel recupero programma utente:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const requestedUserId = req.body?.utente_id ? String(req.body.utente_id) : String(req.userId);
    const isAdmin = Boolean(req.user?.isAdmin);
    if (!isAdmin && requestedUserId !== String(req.userId)) {
      return res.status(403).json({ success: false, error: 'PROGRAMMA_OWNERSHIP_REQUIRED', message: 'Puoi modificare solo il tuo Programma.' });
    }

    const subject = requestedUserId === String(req.userId)
      ? { capabilities: req.user?.capabilities || req.user }
      : await getAccountSubject(pool, requestedUserId);
    const capabilities = subject?.capabilities || subject || {};
    if (!capabilities.isCandidate && !capabilities.isPolitician) {
      return res.status(403).json({
        success: false,
        error: 'PROGRAMMA_POLITICAL_PROFILE_REQUIRED',
        message: 'Il Programma è disponibile solo per Candidati o Politici.'
      });
    }

    let row;
    let canonical = true;
    try {
      const candidacy = await resolveEditableCandidacy(pool, requestedUserId, req.body?.candidacy_id || null);
      row = await upsertCandidacyProgram(pool, candidacy, req.body || {});
    } catch (error) {
      if (error?.code?.startsWith('PROGRAMMA_')) return sendProgramError(res, error);
      if (!isProgramSchemaError(error)) throw error;
      canonical = false;
      const result = await pool.query(
        `INSERT INTO programmi (
           utente_id, proposta_1, proposta_2, proposta_3, proposta_4, proposta_5,
           url_1, url_2, url_3, url_4, url_5, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
         ON CONFLICT (utente_id)
         DO UPDATE SET
           proposta_1=EXCLUDED.proposta_1, proposta_2=EXCLUDED.proposta_2,
           proposta_3=EXCLUDED.proposta_3, proposta_4=EXCLUDED.proposta_4,
           proposta_5=EXCLUDED.proposta_5, url_1=EXCLUDED.url_1,
           url_2=EXCLUDED.url_2, url_3=EXCLUDED.url_3, url_4=EXCLUDED.url_4,
           url_5=EXCLUDED.url_5, updated_at=NOW()
         RETURNING *`,
        [
          requestedUserId,
          req.body?.proposta_1 || '', req.body?.proposta_2 || '', req.body?.proposta_3 || '',
          req.body?.proposta_4 || '', req.body?.proposta_5 || '', req.body?.url_1 || '',
          req.body?.url_2 || '', req.body?.url_3 || '', req.body?.url_4 || '', req.body?.url_5 || ''
        ]
      );
      row = result.rows[0];
    }

    await invalidateProgrammaCaches(requestedUserId);
    return res.status(201).json({
      success: true,
      data: canonical ? toLegacyProgramView(row) : legacyRowToView(row),
      canonical
    });
  } catch (error) {
    console.error('❌ Errore nella creazione/aggiornamento programma:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

module.exports = router;
