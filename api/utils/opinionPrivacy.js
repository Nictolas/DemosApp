const PUBLIC_POLITICAL_ROLES = new Set([
  'P',
  'C',
  'CP',
  'Politico',
  'Candidato',
  'Candidato Politico'
]);

const ADMIN_ROLES = new Set(['AD', 'Admin']);

const normalizeRole = (role) => String(role || '').trim();

const isPublicPoliticalRole = (role) => PUBLIC_POLITICAL_ROLES.has(normalizeRole(role));
const isAdminRole = (role) => ADMIN_ROLES.has(normalizeRole(role));

const canReadUserOpinions = ({
  requesterId,
  requesterRole,
  targetId,
  targetRole
}) => {
  if (!requesterId || !targetId) return false;

  if (String(requesterId) === String(targetId)) return true;
  if (isAdminRole(requesterRole)) return true;

  return isPublicPoliticalRole(targetRole);
};

module.exports = {
  PUBLIC_POLITICAL_ROLES,
  isPublicPoliticalRole,
  isAdminRole,
  canReadUserOpinions
};
