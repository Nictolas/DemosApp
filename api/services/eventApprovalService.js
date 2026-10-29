const SCHEMA_COMPAT_ERROR_CODES = new Set(['42P01', '42703']);

class EventApprovalSchemaRequiredError extends Error {
  constructor() {
    super('Event approval schema is required before non-admin event requests can be stored safely.');
    this.code = 'EVENT_APPROVAL_SCHEMA_REQUIRED';
    this.statusCode = 503;
  }
}

function isApprovalSchemaError(error) {
  return SCHEMA_COMPAT_ERROR_CODES.has(error?.code);
}

function canRequestEvent(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (['INSTITUTION', 'E', 'ORGANIZATION', 'O'].includes(user.accountType)) return true;
  return Boolean(user.isPolitician || user.isCandidate || user.isActivist);
}

function canCreateElectionEvent(user) {
  return Boolean(user?.isAdmin);
}

function initialApprovalState(user) {
  if (user?.isAdmin) {
    return { status: 'APPROVED', approvedNow: true };
  }
  return { status: 'PENDING', approvedNow: false };
}

function normalize(value) {
  return value == null ? null : String(value).trim();
}

const SUBSTANTIAL_EVENT_FIELDS = [
  'nome_evento', 'tipologia_evento', 'tipo_elezione',
  'paese_evento', 'regione_evento', 'provincia_evento', 'comune_evento',
  'indirizzo_evento', 'giorno_inizio', 'giorno_fine',
  'orario_inizio', 'orario_fine', 'orario_inizio_giorno2', 'orario_fine_giorno2'
];

function hasSubstantialEventChange(existing, next) {
  return SUBSTANTIAL_EVENT_FIELDS.some((field) => normalize(existing?.[field]) !== normalize(next?.[field]));
}

module.exports = {
  EventApprovalSchemaRequiredError,
  isApprovalSchemaError,
  canRequestEvent,
  canCreateElectionEvent,
  initialApprovalState,
  hasSubstantialEventChange,
  SUBSTANTIAL_EVENT_FIELDS
};
