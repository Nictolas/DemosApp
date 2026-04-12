const express = require('express');
const { pool, verifyToken } = require('../../middleware/auth');
const {
  GRADI_PREFERITI_DEFAULT,
  getColonneOpinioniRisposte,
  computeCheckMissingForGrado
} = require('../../services/opinioniCheckMissing');

const router = express.Router();

// GET /api/opinioni/check-missing-all — tutti i gradi Preferiti in una round-trip
router.get('/check-missing-all', verifyToken, async (req, res) => {
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
    console.error('❌ Errore check-missing-all:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile controllare le opinioni mancanti'
    });
  }
});

// GET /api/opinioni/check-missing/:grado - Controlla opinioni mancanti per grado
router.get('/check-missing/:grado', verifyToken, async (req, res) => {
  try {
    const { grado } = req.params;
    const userId = req.user.id;

    console.log(
      `🔍 GET /api/opinioni/check-missing/${grado} - Controllo opinioni mancanti per utente ${userId}`
    );

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

    console.log(`📊 Risultati per grado ${grado}:`, {
      totaleOpinioni: data.totaleOpinioni,
      opinioniRisposte: data.opinioniRisposte,
      opinioniMancanti: data.opinioniMancanti,
      percentualeCompletamento: data.percentualeCompletamento,
      isComplete: data.isComplete
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ Errore nel controllo opinioni mancanti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile controllare le opinioni mancanti'
    });
  }
});

module.exports = router;
