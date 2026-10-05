const { createResearchPoliticalVectorReader } = require('./researchPoliticalVectorReader');
const {
  MAX_RESEARCH_POLITICAL_VECTOR_ROWS
} = require('./researchPublicVectorResponsePolicy');

const RESEARCH_POLITICAL_VECTOR_OVERFLOW_LIMIT = MAX_RESEARCH_POLITICAL_VECTOR_ROWS + 1;

const READ_ELIGIBLE_POLITICAL_VECTORS_SQL = `
  SELECT candidate_id, display_name, avatar_config, opinions
  FROM research_public_political_vectors
  WHERE kind = $1
    AND grade = $2
    AND ($3::text IS NULL OR country = $3)
    AND ($4::text IS NULL OR region = $4)
    AND ($5::text IS NULL OR province = $5)
    AND ($6::text IS NULL OR municipality = $6)
    AND generated_at <= NOW()
    AND expires_at > NOW()
  ORDER BY candidate_id
  LIMIT $7
`;

const createResearchPoliticalVectorAdapter = ({ client }) => {
  if (!client || typeof client.query !== 'function') throw new Error('Research client required');
  return createResearchPoliticalVectorReader({
    readEligibleVectors: async (scope) => {
      const result = await client.query(READ_ELIGIBLE_POLITICAL_VECTORS_SQL, [
        scope.kind, scope.grade, scope.country ?? null, scope.region ?? null,
        scope.province ?? null, scope.municipality ?? null,
        RESEARCH_POLITICAL_VECTOR_OVERFLOW_LIMIT
      ]);
      if ((result.rows || []).length > MAX_RESEARCH_POLITICAL_VECTOR_ROWS) {
        throw new Error('Research political vector exceeds read row limit');
      }
      return (result.rows || []).map((row) => ({
        candidateId: row.candidate_id,
        displayName: row.display_name,
        avatarConfig: row.avatar_config,
        opinions: row.opinions
      }));
    }
  });
};

module.exports = {
  RESEARCH_POLITICAL_VECTOR_OVERFLOW_LIMIT,
  READ_ELIGIBLE_POLITICAL_VECTORS_SQL,
  createResearchPoliticalVectorAdapter
};
