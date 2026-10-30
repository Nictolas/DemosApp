/**
 * Logica condivisa per GET /check-missing/:grado e GET /check-missing-all.
 */

const { getOpinionsForGrade } = require('./opinionCatalog');

const GRADO_MAPPING = {
  N: 'N',
  E: 'E',
  R: 'R',
  C: 'C',
  CO: 'CO'
};

/** Gradi usati da Preferiti (alert navigazione). */
const GRADI_PREFERITI_DEFAULT = ['N', 'E', 'R', 'CO'];

/**
 * @param {import('pg').Pool} pool
 * @returns {Promise<Set<string>>}
 */
async function getColonneOpinioniRisposte(pool) {
  const colonneEsistentiQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_risposte' 
      AND column_name != 'user_id'
      AND column_name != 'fonti_opinioni'
    `;
  const colonneEsistentiResult = await pool.query(colonneEsistentiQuery);
  return new Set(colonneEsistentiResult.rows.map((row) => row.column_name));
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {string} gradoParam parametro URL (es. N, CO)
 * @param {Set<string>} colonneEsistenti
 * @returns {Promise<object>} payload `data` come nella risposta API singola
 */
async function computeCheckMissingForGrado(pool, userId, gradoParam, colonneEsistenti) {
  const gradoDatabase = GRADO_MAPPING[gradoParam];
  if (!gradoDatabase) {
    const err = new Error('Grado non valido');
    err.code = 'INVALID_GRADO';
    throw err;
  }

  const opinioniDelGrado = getOpinionsForGrade(gradoDatabase).map(({ id, text, gradi_opinione }) => ({ id, text, gradi_opinione }));

  if (opinioniDelGrado.length === 0) {
    return {
      grado: gradoParam,
      totaleOpinioni: 0,
      opinioniRisposte: 0,
      opinioniMancanti: 0,
      percentualeCompletamento: 100,
      isComplete: true,
      missingOpinions: []
    };
  }

  const opinioniConColonna = opinioniDelGrado.filter((op) => colonneEsistenti.has(op.id));
  const opinioniSenzaColonna = opinioniDelGrado.filter((op) => !colonneEsistenti.has(op.id));

  let opinioniMancanti = opinioniSenzaColonna.map((op) => ({
    id: op.id,
    text: op.text
  }));

  let opinioniRisposte = 0;

  if (opinioniConColonna.length > 0) {
    const userIds = opinioniConColonna.map((op) => `"${op.id}"`).join(', ');
    const risposteQuery = `
        SELECT ${userIds}
        FROM opinioni_risposte 
        WHERE user_id = $1
      `;

    try {
      const risposteResult = await pool.query(risposteQuery, [userId]);

      if (risposteResult.rows.length > 0) {
        const userAnswers = risposteResult.rows[0];

        opinioniConColonna.forEach((opinione) => {
          const answer = userAnswers[opinione.id];
          if (answer && answer !== null && answer !== '') {
            opinioniRisposte++;
          } else {
            opinioniMancanti.push({
              id: opinione.id,
              text: opinione.text
            });
          }
        });
      } else {
        opinioniMancanti.push(
          ...opinioniConColonna.map((op) => ({
            id: op.id,
            text: op.text
          }))
        );
      }
    } catch (error) {
      console.error('❌ Errore nella query risposte:', error);
      opinioniMancanti.push(
        ...opinioniConColonna.map((op) => ({
          id: op.id,
          text: op.text
        }))
      );
    }
  }

  const percentualeCompletamento =
    opinioniDelGrado.length > 0
      ? Math.round((opinioniRisposte / opinioniDelGrado.length) * 100)
      : 100;

  const isComplete = opinioniMancanti.length === 0;

  return {
    grado: gradoParam,
    totaleOpinioni: opinioniDelGrado.length,
    opinioniRisposte,
    opinioniMancanti: opinioniMancanti.length,
    percentualeCompletamento,
    isComplete,
    missingOpinions: opinioniMancanti
  };
}

module.exports = {
  GRADO_MAPPING,
  GRADI_PREFERITI_DEFAULT,
  getColonneOpinioniRisposte,
  computeCheckMissingForGrado
};
