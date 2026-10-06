const {
  verifyResearchParticipantProof
} = require('./researchParticipantProofPolicy');

const VALID_ANSWERS = new Set(['f', 'c', 'i']);
const MAX_RESEARCH_OPINION_VECTOR_READ_ROWS = 2048;
const RESEARCH_OPINION_VECTOR_OVERFLOW_LIMIT = MAX_RESEARCH_OPINION_VECTOR_READ_ROWS + 1;

const readCurrentResearchOpinionVector = async (
  client,
  {
    participantPublicKey,
    challenge,
    signature
  },
  verifier
) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research opinion vector read requires a PostgreSQL client');
  }

  const proof = await verifyResearchParticipantProof({
    participantPublicKey,
    challenge,
    signature,
    verifier
  });

  const result = await client.query(
    `SELECT r.question_id, r.answer_code
     FROM research.current_opinion_responses r
     JOIN research.participants p
       ON p.participant_id = r.participant_id
     WHERE p.participant_public_key = $1
       AND p.status = 'active'
       AND (p.expires_at IS NULL OR p.expires_at > NOW())
       AND r.answer_code IN ('f', 'c', 'i')
     ORDER BY r.question_id
     LIMIT $2`,
    [proof.participantPublicKey, RESEARCH_OPINION_VECTOR_OVERFLOW_LIMIT]
  );

  if ((result.rows || []).length > MAX_RESEARCH_OPINION_VECTOR_READ_ROWS) {
    throw new Error('Research opinion vector exceeds read row limit');
  }

  const opinions = {};
  for (const row of result.rows || []) {
    if (typeof row.question_id !== 'string') continue;
    if (!VALID_ANSWERS.has(row.answer_code)) continue;
    opinions[row.question_id] = row.answer_code;
  }

  return { opinions };
};

module.exports = {
  MAX_RESEARCH_OPINION_VECTOR_READ_ROWS,
  RESEARCH_OPINION_VECTOR_OVERFLOW_LIMIT,
  readCurrentResearchOpinionVector
};
