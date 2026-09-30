const isAdminRole = (role) => ['AD', 'Admin'].includes(String(role || '').trim());

const shouldAuditPoliticalOpinionAccess = ({ requesterId, requesterRole, targetId }) =>
  Boolean(
    requesterId &&
    targetId &&
    String(requesterId) !== String(targetId) &&
    isAdminRole(requesterRole)
  );

module.exports = {
  isAdminRole,
  shouldAuditPoliticalOpinionAccess
};
