const { AxiomArchiveService } = require('../services/axiomArchiveService');

(async () => {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: node scripts/verify-axiom-archive-object.js <b2-object-key>');
    process.exitCode = 2;
    return;
  }

  try {
    const service = new AxiomArchiveService();
    service.validateB2Configuration();
    const result = await service.verifyArchiveObject(key);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
})();
