const EXPECTED_SCHEMAS = Object.freeze([
  'identity',
  'research',
  'content',
  'politics',
  'audit'
]);

const EXPECTED_TABLES = Object.freeze([
  'identity.participation_eligibility',
  'identity.credential_issuances',
  'research.participants',
  'research.spent_credentials',
  'research.participant_dimensions',
  'research.opinion_response_events',
  'content.opinion_questions',
  'politics.public_figures',
  'politics.position_sources',
  'politics.figure_positions',
  'audit.security_events'
]);

const parseBoolean = (value) => String(value || '').trim().toLowerCase() === 'true';

module.exports = Object.freeze({
  enabled: parseBoolean(process.env.PRIVACY_RESEARCH_SHADOW_ENABLED),
  mode: 'read-only-shadow',
  expectedSchemas: EXPECTED_SCHEMAS,
  expectedTables: EXPECTED_TABLES
});
