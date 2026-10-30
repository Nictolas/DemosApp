const express = require('express');
const { pool, verifyToken } = require('../../middleware/auth');
const {
  GRADI_PREFERITI_DEFAULT,
  getColonneOpinioniRisposte,
  computeCheckMissingForGrado
} = require('../../services/opinioniCheckMissing');

const router = express.Router();

// Completion results reveal whether a person has recorded political opinions.
// Never allow browser or intermediary caches to persist them, including 401,
// 400 and 500 responses. Run before authentication.
function noStorePoliticalCompletion(_req, res, next) {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
}

// GET /api/opinioni/check-missing-all — tutti i gradi Preferiti in una richiesta HTTP
router.get('/check-missing-all', noStorePoliticalCompletion, verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const colonneEsistenti = await getColonneOpinioniRisposte(pool);
    const byGrado = {};
    let totaleOpinioni = 0;
    let opinioniRisposte = 0;
    let opinioniMancantiCount = 0;
    const allMissingOpinions = [];

    for (const grado of GRADI_PREFERITI_DEFAULT) {
      const data = await computeCheckMissingForGrado(pool, userId, grado, colonneEsistenti);
      byGrado[grado] = data;
      totaleOpinioni += data.totaleOpinioni;
      opinioniRisposte += data.opinioniRisposte;
      opinioniMancantiCount += data.opinioniMancanti;
      if (data.missingOpinions && data.missingOpinions.length) {
        allMissingOpinions.push(...data.missingOpinions);
      }
    }

    const allComplete = GRADI_PREFERITI_DEFAULT.every((g) => byGrado[g].isComplete);
    const percentualeCompletamento =
      totaleOpinioni > 0 ? Math.round((opinioniRisposte / totaleOpinioni) * 100) : 0;

    res.json({
      success: true,
      data: {
        byGrado,
        allComplete,
        totaleOpinioni,
        opinioniRisposte,
        opinioniMancanti: opinioniMancantiCount,
        percentualeCompletamento,
        missingOpinions: allMissingOpinions
      }
    });
  } catch (error) {
    console.error('Errore interno nella verifica delle Opinioni mancanti');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile controllare le opinioni mancanti'
    });
  }
});

// GET /api/opinioni/check-missing/:grado - Controlla opinioni mancanti per grado
router.get('/check-missing/:grado', noStorePoliticalCompletion, verifyToken, async (req, res) => {
  try {
    const { grado } = req.params;
    const userId = req.user.id;

    const colonneEsistenti = await getColonneOpinioniRisposte(pool);

    let data;
    try {
      data = await computeCheckMissingForGrado(pool, userId, grado, colonneEsistenti);
    } catch (e) {
      if (e.code === 'INVALID_GRADO') {
        return res.status(400).json({
          success: false,
          error: 'Grado non valido'
        });
      }
      throw e;
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Errore interno nella verifica delle Opinioni mancanti');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile controllare le opinioni mancanti'
    });
  }
});

module.exports = router;
