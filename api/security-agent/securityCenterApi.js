const { query, readLimit, readIncidents } = require('./securityCenterQueryPolicy');
function createSecurityCenterHandlers(service) {
  if (!service || typeof service.getOverview !== 'function' || typeof service.listIncidents !== 'function' || typeof service.getHealth !== 'function') {
    throw new TypeError('SecurityCenterService read contract is required');
  }

  const sendError = res => res.status(500).json({ success: false, error: 'SECURITY_CENTER_READ_FAILED' });

  return {
    async overview(req, res) {
      try {
        const recentLimit = readLimit(req, 'recentLimit', 10);
        const data = await service.getOverview({ recentLimit });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async incidents(req, res) {
      try {
        const data = await service.listIncidents(readIncidents(req));
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async health(req, res) {
      try { query(req, []); return res.json({ success: true, data: await service.getHealth() }); }
      catch (_error) { return sendError(res); }
    },
    async notifications(req, res) {
      try {
        if (typeof service.getNotifications !== 'function') throw new Error('notification read unavailable');
        const data = await service.getNotifications({ limit: readLimit(req, 'limit', undefined) });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async boundaryAudit(req, res) {
      try {
        if (typeof service.getBoundaryAudit !== 'function') throw new Error('read unavailable');
        const data = await service.getBoundaryAudit({ limit: readLimit(req, 'limit', undefined) });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async approvals(req, res) {
      try {
        if (typeof service.getApprovals !== 'function') throw new Error('approval read unavailable');
        const data = await service.getApprovals({ limit: readLimit(req, 'limit', undefined) });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async aiPolicy(req, res) {
      try {
        if (typeof service.getAiPolicy !== 'function') throw new Error('AI policy read unavailable');
        const data = await service.getAiPolicy({ limit: readLimit(req, 'limit', undefined) });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async aiOrchestrator(req, res) {
      try {
        if (typeof service.getAiOrchestrator !== 'function') throw new Error('AI orchestrator read unavailable');
        const data = await service.getAiOrchestrator({ limit: readLimit(req, 'limit', undefined) });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async aiAnalyses(req, res) {
      try {
        if (typeof service.getAiAnalyses !== 'function') throw new Error('AI analyst read unavailable');
        const data = await service.getAiAnalyses({ limit: readLimit(req, 'limit', undefined) });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    }
  };
}

module.exports = { createSecurityCenterHandlers };
