const express = require('express');
const {
  mountResearchPublicApiIfEnabled
} = require('./researchPublicApiMount');

const createResearchPublicIntegrationPoc = ({
  policy,
  boundary,
  router,
  errorHandler
} = {}) => {
  const app = express();
  const result = mountResearchPublicApiIfEnabled(app, {
    policy,
    boundary,
    router,
    errorHandler
  });

  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  return { app, mounted: result.mounted };
};

module.exports = {
  createResearchPublicIntegrationPoc
};
