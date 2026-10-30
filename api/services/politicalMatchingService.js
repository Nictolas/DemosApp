const {
  getOpinionCompletion,
  calculatePoliticalMatch
} = require('../utils/politicalMatching');
const { getOpinionIdsForGrade } = require('./opinionCatalog');

async function getGradeOpinionIds(_pool, grade) {
  // Official question IDs no longer need a query to opinioni_domande.
  return getOpinionIdsForGrade(grade);
}

async function getOpinionMapsByUserId(pool, userIds, opinionIds) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  const maps = new Map(ids.map((id) => [id, {}]));

  if (ids.length === 0 || opinionIds.length === 0) {
    return maps;
  }

  // Niente cast sulla colonna: PostgreSQL può usare l'indice di user_id.
  const result = await pool.query(
    `SELECT *
     FROM opinioni_risposte
     WHERE user_id = ANY($1)`,
    [ids]
  );

  for (const row of result.rows) {
    const userId = String(row.user_id);
    const answers = {};

    for (const opinionId of opinionIds) {
      answers[opinionId] = row[opinionId];
    }

    maps.set(userId, answers);
  }

  return maps;
}

async function getUserOpinionCompletion(pool, userId, grade) {
  const opinionIds = await getGradeOpinionIds(pool, grade);
  const maps = await getOpinionMapsByUserId(pool, [userId], opinionIds);
  const userAnswers = maps.get(String(userId)) || {};
  const completion = getOpinionCompletion(opinionIds, userAnswers);

  return {
    grade,
    opinionIds,
    userAnswers,
    ...completion
  };
}

async function buildPoliticalMatches({ pool, userId, subjects, grade }) {
  const opinionIds = await getGradeOpinionIds(pool, grade);
  const subjectList = Array.isArray(subjects) ? subjects : [];
  const allUserIds = [userId, ...subjectList.map((subject) => subject.id)];
  const opinionMaps = await getOpinionMapsByUserId(pool, allUserIds, opinionIds);
  const userAnswers = opinionMaps.get(String(userId)) || {};
  const completion = getOpinionCompletion(opinionIds, userAnswers);

  if (!completion.isComplete) {
    return {
      grade,
      opinionIds,
      userAnswers,
      ...completion,
      matches: []
    };
  }

  const matches = subjectList.map((subject) => {
    const targetAnswers = opinionMaps.get(String(subject.id)) || {};
    const match = calculatePoliticalMatch(opinionIds, userAnswers, targetAnswers);

    return {
      ...subject,
      matching_score: match.rawScore,
      matchingScore: match.rawScore,
      matching_score_max: match.maxScore,
      compatibilita_percentuale: match.compatibilityPercentage,
      compatibilitaPercentuale: match.compatibilityPercentage,
      copertura_posizioni: match.knownPositions,
      coperturaPosizioni: match.knownPositions,
      copertura_totale: match.totalOpinions,
      coperturaTotale: match.totalOpinions,
      copertura_percentuale: match.coveragePercentage,
      coperturaPercentuale: match.coveragePercentage,
      concordanze_chiare: match.clearAgreements,
      concordanze_non_so: match.uncertainAgreements,
      divergenze: match.disagreements,
      incertezze_miste: match.mixedUncertainty,
      posizioni_mancanti: match.targetMissing
    };
  });

  matches.sort((a, b) => {
    if (b.matching_score !== a.matching_score) {
      return b.matching_score - a.matching_score;
    }

    const surnameCompare = String(a.cognome || '').localeCompare(String(b.cognome || ''), 'it');
    if (surnameCompare !== 0) return surnameCompare;

    return String(a.nome || '').localeCompare(String(b.nome || ''), 'it');
  });

  return {
    grade,
    opinionIds,
    userAnswers,
    ...completion,
    matches
  };
}

module.exports = {
  getGradeOpinionIds,
  getOpinionMapsByUserId,
  getUserOpinionCompletion,
  buildPoliticalMatches
};
