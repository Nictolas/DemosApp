const {
  researchPublicExposurePolicyFromEnv
} = require('./config/researchPublicExposurePolicy');
const {
  createResearchPublicBoundaryMiddleware,
  researchPublicErrorHandler
} = require('./middleware/researchPublicBoundary');
const {
  createResearchPublicRouter
} = require('./routes/researchPublicRouter');

const mountResearchPublicApiIfEnabled = (
  app,
  {
    policy = researchPublicExposurePolicyFromEnv(),
    boundary,
    router,
    challengeLimiter,
    readLimiter,
    errorHandler = researchPublicErrorHandler
  } = {}
) => {
  if (!app || typeof app.use !== 'function') {
    throw new Error('Research app is required');
  }

  if (!policy.mountAllowed || policy.allowedOrigins.length === 0) {
    return { mounted: false };
  }

  const resolvedBoundary = boundary || createResearchPublicBoundaryMiddleware({ policy });
  let resolvedRouter = router;

  // Production exposure must never silently fall back to the process-local
  // express-rate-limit MemoryStore. Runtime limiters must be supplied explicitly
  // (for example by the approved distributed rate-limit composition).
  if (!resolvedRouter) {
    if (typeof challengeLimiter !== 'function' || typeof readLimiter !== 'function') {
      return { mounted: false };
    }
    resolvedRouter = createResearchPublicRouter({ challengeLimiter, readLimiter });
  }

  app.use(resolvedBoundary);
  app.use(resolvedRouter);
  app.use(errorHandler);

  return { mounted: true };
};

module.exports = {
  mountResearchPublicApiIfEnabled
};
