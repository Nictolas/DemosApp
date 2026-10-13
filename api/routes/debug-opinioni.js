const express = require('express');
const { getPool } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { buildPoliticalMatches } = require('../services/politicalMatchingService');

const router = express.Router();
const pool = getPool();

const VALID_GRADES = new Set(['E', 'N', 'R', 'CO']);

// Dev-only debug surface: usa esattamente lo stesso motore di matching dell'app.
router.get('/debug-opinioni-comuni', verifyToken, requireAdmin, async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    const targetId = String(req.query.targetId || '').trim();
    const grado = String(req.query.grado || '').trim().toUpperCase();

    if (!userId || !targetId || !VALID_GRADES.has(grado)) {
      return res.status(400).json({
        success: false,
        error: 'Parametri non validi',
        message: 'Sono richiesti userId, targetId e grado (E, N, R o CO).'
      });
    }

    const usersResult = await pool.query(
      `SELECT id, nome, cognome, ruolo
       FROM users
       WHERE id = $1 OR id = $2`,
      [userId, targetId]
    );

    const byId = new Map(usersResult.rows.map((row) => [String(row.id), row]));
    const user = byId.get(userId);
    const target = byId.get(targetId);

    if (!user || !target) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
        missing: {
          user: !user,
          target: !target
        }
      });
    }

    const matching = await buildPoliticalMatches({
      pool,
      userId,
      subjects: [target],
      grade: grado
    });

    return res.json({
      success: true,
      data: {
        user,
        target,
        grado,
        userComplete: matching.isComplete,
        totalOpinions: matching.totalOpinions,
        answeredOpinions: matching.answeredOpinions,
        missingOpinions: matching.missingOpinions,
        missingOpinionIds: matching.missingOpinionIds,
        match: matching.matches[0] || null
      }
    });
  } catch (error) {
    console.error('❌ Errore debug matching politico:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nel debug del matching politico'
    });
  }
});

module.exports = router;
