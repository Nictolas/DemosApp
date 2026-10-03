function createSecurityCenterHandlers(service) {
  if (!service || typeof service.getOverview !== 'function' || typeof service.listIncidents !== 'function' || typeof service.getHealth !== 'function') {
    throw new TypeError('SecurityCenterService read contract is required');
  }

  const sendError = res => res.status(500).json({
    success: false,
    error: 'SECURITY_CENTER_READ_FAILED'
  });

  return {
    overview(req, res) {
      try {
        const recentLimit = req?.query?.recentLimit;
        const data = service.getOverview({
          recentLimit: recentLimit === undefined ? 10 : Number(recentLimit)
        });
        return res.json({ success: true, data });
      } catch (_error) {
        return sendError(res);
      }
    },

    incidents(req, res) {
      try {
        const data = service.listIncidents({
          status: req?.query?.status,
          severity: req?.query?.severity,
          limit: req?.query?.limit
        });
        return res.json({ success: true, data });
      } catch (_error) {
        return sendError(res);
      }
    },

    health(_req, res) {
      try {
        return res.json({ success: true, data: service.getHealth() });
      } catch (_error) {
        return sendError(res);
      }
    }
  };
}

module.exports = { createSecurityCenterHandlers };
