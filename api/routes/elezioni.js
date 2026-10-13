const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');
const { listElectionEvents, listRelevantElectionEvents } = require('../services/electionEventService');
const { listEligibleCandidates } = require('../services/politicalEligibilityService');
const { buildPoliticalMatches } = require('../services/politicalMatchingService');
const {
  resolvePoliticalOffice,
  getOpinionGradeForOffice,
  getLegacySelectionDescriptors,
} = require('../services/politicalJurisdictionRegistryService');

const router = express.Router();
const CANDIDATE_SELECTION_DESCRIPTORS = Object.freeze(getLegacySelectionDescriptors('candidate'));

// GET /api/elezioni/prossime - Elezioni future dal modello canonico eventi.
router.get('/prossime', async (req, res) => {
  try {
    const elezioni = await listElectionEvents(pool, { upcomingOnly: true, limit: 5 });
    return res.json({ success: true, elezioni });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni future:', error);
    return res.status(500).json({ success: false, error: 'Errore nel recuperare elezioni' });
  }
});

// GET /api/elezioni - Lista elezioni canoniche. created_at è solo metadato, non la data elettorale.
router.get('/', verifyToken, async (req, res) => {
  try {
    const elezioni = await listElectionEvents(pool);
    return res.json({ success: true, elezioni });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni:', error);
    return res.status(500).json({ success: false, error: 'Errore nel recuperare elezioni' });
  }
});

// GET /api/elezioni/utente - Elezioni future pertinenti al territorio/circoscrizione dell'utente.
router.get('/utente', verifyToken, async (req, res) => {
  try {
    const elezioni = await listRelevantElectionEvents(pool, req.userId);
    return res.json({ success: true, elezioni });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni utente:', error);
    return res.status(500).json({ success: false, error: 'Errore nel recuperare elezioni utente' });
  }
});

// GET compatibilità candidati elettorali. Il motore autorevole è politicalEligibilityService.
router.get(['/disponibili', '/elezioni-utente/disponibili'], verifyToken, async (req, res) => {
  try {
    const { grado, categoria } = req.query;
    const raw = String(grado || '').trim();
    const category = String(categoria || '').trim();
    let office = resolvePoliticalOffice(raw);
    if (!office && ['nazionale', 'nazionali', 'n', 'national'].includes(raw.toLowerCase())) {
      office = resolvePoliticalOffice(category);
    }
    const candidateGrade = office?.aliases?.[0] || null;
    if (!candidateGrade) {
      return res.status(400).json({
        success: false,
        error: 'GRADO_ELEZIONE_NON_VALIDO',
        message: 'Per il livello nazionale specifica Camera o Senato.'
      });
    }

    const eligibility = await listEligibleCandidates(pool, req.userId, candidateGrade);
    const opinionGrade = getOpinionGradeForOffice(candidateGrade) || candidateGrade;
    const matching = await buildPoliticalMatches({
      pool,
      userId: req.userId,
      subjects: eligibility.subjects,
      grade: opinionGrade
    });

    const selectionsResult = await pool.query(
      `SELECT candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune
       FROM users WHERE id = $1`,
      [req.userId]
    );
    const selected = selectionsResult.rows[0] || {};
    return res.json({
      success: true,
      data: {
        candidati: matching.matches.slice(0, 4),
        utente: {
          candidato_europeo: selected.candidato_europeo || null,
          candidato_camera: selected.candidato_camera || null,
          candidato_senato: selected.candidato_senato || null,
          candidato_regione: selected.candidato_regionale || null,
          candidato_comune: selected.candidato_comune || null
        },
        matching: {
          userComplete: matching.isComplete,
          totalOpinions: matching.totalOpinions,
          answeredOpinions: matching.answeredOpinions,
          missingOpinions: matching.missingOpinions
        },
        eligibility: { source: eligibility.source, strict: eligibility.strict, reason: eligibility.reason }
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati elettorali:', error);
    return res.status(500).json({ success: false, error: 'Errore nel recuperare candidati disponibili' });
  }
});

// GET compatibilità selezioni candidati correnti.
router.get('/candidati', verifyToken, async (req, res) => {
  try {
    const selectionResult = await pool.query(
      `SELECT candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune
       FROM users WHERE id = $1`,
      [req.userId]
    );
    const selected = selectionResult.rows[0] || {};
    const fields = CANDIDATE_SELECTION_DESCRIPTORS.map(({ field, category }) => [field, category]);
    const candidati = {};
    const idMap = {};
    for (const [field, category] of fields) {
      const id = selected[field];
      if (!id) continue;
      const candidateResult = await pool.query(
        `SELECT id, nome, cognome, ruolo, status, avatar_config FROM users WHERE id::text = $1 LIMIT 1`,
        [String(id)]
      );
      if (candidateResult.rows[0]) {
        candidati[category] = [candidateResult.rows[0]];
        idMap[category] = String(id);
      }
    }
    return res.json({ success: true, data: { candidati, idMap } });
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati selezionati:', error);
    return res.status(500).json({ success: false, error: 'Errore nel recuperare candidati utente' });
  }
});

// POST /api/elezioni - Scrittura legacy disattivata: createdat non è una data elettorale.
router.post('/', verifyToken, async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'LEGACY_ELECTION_WRITE_DISABLED',
    message: 'La vecchia scrittura elezioni è disattivata. Le elezioni canoniche sono eventi elettorali con date reali e unità elettorali.'
  });
});

module.exports = router;
