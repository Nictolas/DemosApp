function createSecurityCenterHandlers(service) {
  if (!service || typeof service.getOverview !== 'function' || typeof service.listIncidents !== 'function' || typeof service.getHealth !== 'function') {
    throw new TypeError('SecurityCenterService read contract is required');
  }

  const sendError = res => res.status(500).json({ success: false, error: 'SECURITY_CENTER_READ_FAILED' });

  return {
    async overview(req, res) {
      try {
        const recentLimit = req?.query?.recentLimit;
        const data = await service.getOverview({ recentLimit: recentLimit === undefined ? 10 : Number(recentLimit) });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async incidents(req, res) {
      try {
        const data = await service.listIncidents({ status: req?.query?.status, severity: req?.query?.severity, limit: req?.query?.limit });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async health(_req, res) {
      try { return res.json({ success: true, data: await service.getHealth() }); }
      catch (_error) { return sendError(res); }
    },
    async notifications(req, res) {
      try {
        if (typeof service.getNotifications !== 'function') throw new Error('notification read unavailable');
        const data = await service.getNotifications({ limit: req?.query?.limit });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    },
    async aiAnalyses(req, res) {
      try {
        if (typeof service.getAiAnalyses !== 'function') throw new Error('AI analyst read unavailable');
        const data = await service.getAiAnalyses({ limit: req?.query?.limit });
        return res.json({ success: true, data });
      } catch (_error) { return sendError(res); }
    }
  };
}

module.exports = { createSecurityCenterHandlers };
