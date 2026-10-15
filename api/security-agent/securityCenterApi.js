const { query, readLimit, readIncidents } = require('./securityCenterQueryPolicy');
const { validateSecurityCenterResponse } = require('./securityCenterResponsePolicy');

function createSecurityCenterHandlers(service) {
  if (!service || typeof service.getOverview !== 'function' || typeof service.listIncidents !== 'function' || typeof service.getHealth !== 'function') {
    throw new TypeError('SecurityCenterService read contract is required');
  }

  const sendError = res => res.status(500).json({ success: false, error: 'SECURITY_CENTER_READ_FAILED' });
  const sendData = (res, route, data) => res.json(validateSecurityCenterResponse(route, data));

  return {
    async overview(req, res) {
      try {
        const recentLimit = readLimit(req, 'recentLimit', 10);
        const data = await service.getOverview({ recentLimit });
        return sendData(res, 'overview', data);
      } catch (_error) { return sendError(res); }
    },
    async incidents(req, res) {
      try {
        const data = await service.listIncidents(readIncidents(req));
        return sendData(res, 'incidents', data);
      } catch (_error) { return sendError(res); }
    },
    async health(req, res) {
      try {
        query(req, []);
        return sendData(res, 'health', await service.getHealth());
      } catch (_error) { return sendError(res); }
    },
    async notifications(req, res) {
      try {
        if (typeof service.getNotifications !== 'function') throw new Error('notification read unavailable');
        const data = await service.getNotifications({ limit: readLimit(req, 'limit', undefined) });
        return sendData(res, 'notifications', data);
      } catch (_error) { return sendError(res); }
    },
    async boundaryAudit(req, res) {
      try {
        if (typeof service.getBoundaryAudit !== 'function') throw new Error('read unavailable');
        const data = await service.getBoundaryAudit({ limit: readLimit(req, 'limit', undefined) });
        return sendData(res, 'boundaryAudit', data);
      } catch (_error) { return sendError(res); }
    },
    async approvals(req, res) {
      try {
        if (typeof service.getApprovals !== 'function') throw new Error('approval read unavailable');
        const data = await service.getApprovals({ limit: readLimit(req, 'limit', undefined) });
        return sendData(res, 'approvals', data);
      } catch (_error) { return sendError(res); }
    },
    async aiPolicy(req, res) {
      try {
        if (typeof service.getAiPolicy !== 'function') throw new Error('AI policy read unavailable');
        const data = await service.getAiPolicy({ limit: readLimit(req, 'limit', undefined) });
        return sendData(res, 'aiPolicy', data);
      } catch (_error) { return sendError(res); }
    },
    async aiOrchestrator(req, res) {
      try {
        if (typeof service.getAiOrchestrator !== 'function') throw new Error('AI orchestrator read unavailable');
        const data = await service.getAiOrchestrator({ limit: readLimit(req, 'limit', undefined) });
        return sendData(res, 'aiOrchestrator', data);
      } catch (_error) { return sendError(res); }
    },
    async aiAnalyses(req, res) {
      try {
        if (typeof service.getAiAnalyses !== 'function') throw new Error('AI analyst read unavailable');
        const data = await service.getAiAnalyses({ limit: readLimit(req, 'limit', undefined) });
        return sendData(res, 'aiAnalyses', data);
      } catch (_error) { return sendError(res); }
    }
  };
}

module.exports = { createSecurityCenterHandlers };
