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
    boundary = createResearchPublicBoundaryMiddleware({ policy }),
    router = createResearchPublicRouter(),
    errorHandler = researchPublicErrorHandler
  } = {}
) => {
  if (!app || typeof app.use !== 'function') {
    throw new Error('Research app is required');
  }

  if (!policy.mountAllowed || policy.allowedOrigins.length === 0) {
    return { mounted: false };
  }

  app.use(boundary);
  app.use(router);
  app.use(errorHandler);

  return { mounted: true };
};

module.exports = {
  mountResearchPublicApiIfEnabled
};
