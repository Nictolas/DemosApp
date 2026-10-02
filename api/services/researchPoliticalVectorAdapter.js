const { createResearchPoliticalVectorReader } = require('./researchPoliticalVectorReader');

const READ_ELIGIBLE_POLITICAL_VECTORS_SQL = `
  SELECT candidate_id, display_name, avatar_config, opinions
  FROM research_public_political_vectors
  WHERE kind = $1
    AND grade = $2
    AND ($3::text IS NULL OR country = $3)
    AND ($4::text IS NULL OR region = $4)
    AND ($5::text IS NULL OR province = $5)
    AND ($6::text IS NULL OR municipality = $6)
  ORDER BY candidate_id
  LIMIT 500
`;

const createResearchPoliticalVectorAdapter = ({ client }) => {
  if (!client || typeof client.query !== 'function') throw new Error('Research client required');
  return createResearchPoliticalVectorReader({
    readEligibleVectors: async (scope) => {
      const result = await client.query(READ_ELIGIBLE_POLITICAL_VECTORS_SQL, [
        scope.kind, scope.grade, scope.country ?? null, scope.region ?? null,
        scope.province ?? null, scope.municipality ?? null
      ]);
      return result.rows.map((row) => ({
        candidateId: row.candidate_id,
        displayName: row.display_name,
        avatarConfig: row.avatar_config,
        opinions: row.opinions
      }));
    }
  });
};

module.exports = { READ_ELIGIBLE_POLITICAL_VECTORS_SQL, createResearchPoliticalVectorAdapter };
