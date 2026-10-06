const { AxiomArchiveService } = require('../services/axiomArchiveService');

(async () => {
  try {
    const service = new AxiomArchiveService();
    const results = await service.runOnce();
    console.log(JSON.stringify(results.map(result => ({
      dataset: result.dataset,
      skipped: result.skipped,
      count: result.count,
      categories: result.categories || {},
      manifest: result.manifest?.key || null,
      lastSuccessfulEnd: result.checkpoint?.lastSuccessfulEnd || null
    })), null, 2));
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
})();
