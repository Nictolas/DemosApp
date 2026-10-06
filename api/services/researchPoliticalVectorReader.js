const ALLOWED_SCOPE_KEYS = Object.freeze(['kind', 'grade', 'country', 'region', 'province', 'municipality']);
const ALLOWED_KINDS = Object.freeze(['candidate', 'representative']);

const normalizePoliticalVectorScope = (scope) => {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new Error('Invalid political vector scope');
  const keys = Object.keys(scope);
  if (keys.some((key) => !ALLOWED_SCOPE_KEYS.includes(key))) throw new Error('Unexpected political vector scope');
  if (!ALLOWED_KINDS.includes(scope.kind)) throw new Error('Invalid political vector kind');
  if (typeof scope.grade !== 'string' || !/^[A-Z]{1,2}$/.test(scope.grade)) throw new Error('Invalid political vector grade');
  const normalized = { kind: scope.kind, grade: scope.grade };
  for (const key of ['country','region','province','municipality']) {
    if (scope[key] == null) continue;
    if (typeof scope[key] !== 'string' || scope[key].length < 1 || scope[key].length > 100) throw new Error('Invalid political vector geography');
    normalized[key] = scope[key];
  }
  return Object.freeze(normalized);
};

const createResearchPoliticalVectorReader = ({ readEligibleVectors }) => {
  if (typeof readEligibleVectors !== 'function') throw new Error('Political vector reader required');
  return {
    async read(scope) {
      const normalizedScope = normalizePoliticalVectorScope(scope);
      const rows = await readEligibleVectors(normalizedScope);
      return Object.freeze((rows || []).map((row) => Object.freeze({
        candidateId: String(row.candidateId),
        displayName: String(row.displayName || ''),
        avatarConfig: row.avatarConfig ?? null,
        opinions: Object.freeze({ ...(row.opinions || {}) })
      })));
    }
  };
};

module.exports = { ALLOWED_SCOPE_KEYS, normalizePoliticalVectorScope, createResearchPoliticalVectorReader };
