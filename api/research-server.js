require('dotenv').config();

const app = require('./research-app');
const { closeResearchPool } = require('./config/researchDatabase');

const port = process.env.PORT || process.env.RESEARCH_PORT || 3002;

const server = app.listen(port, () => {
  console.log(`Research shadow service listening on port ${port}`);
});

const shutdown = async () => {
  await closeResearchPool().catch(() => {});
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
