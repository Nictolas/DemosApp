const cron = require('node-cron');
const { AxiomArchiveService } = require('../services/axiomArchiveService');

let task = null;
let running = false;

// Never write raw Axiom/S3/HTTP exceptions to Render logs. Their messages
// may contain URLs, credentials, object keys, or fragments of query data.
function safeArchiveErrorCode(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  return /^(?:AXIOM_ARCHIVE|ARCHIVE|B2)_[A-Z0-9_]{3,64}$/.test(message)
    ? message : 'AXIOM_ARCHIVE_UNCLASSIFIED_FAILURE';
}

async function runAxiomArchiveOnce() {
  if (running) {
    console.warn('Axiom archive skipped: previous run is still active');
    return { skipped: true, reason: 'already-running' };
  }

  running = true;
  try {
    const service = new AxiomArchiveService();
    const results = await service.runOnce();
    const summary = results.map(result => ({
      dataset: result.dataset,
      skipped: result.skipped,
      caughtUp: result.caughtUp,
      chunks: result.chunks,
      count: result.count,
      categories: result.categories || {},
      remainingMs: result.remainingMs || 0
    }));
    console.log('Axiom archive completed:', JSON.stringify(summary));
    return { skipped: false, results };
  } catch (error) {
    console.error('Axiom archive failed:', safeArchiveErrorCode(error));
    throw error;
  } finally {
    running = false;
  }
}

function start() {
  if (process.env.AXIOM_ARCHIVE_ENABLED !== 'true') return null;
  if (task) return task;

  const schedule = process.env.AXIOM_ARCHIVE_CRON || '17 * * * *';
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid AXIOM_ARCHIVE_CRON: ${schedule}`);
  }

  task = cron.schedule(schedule, () => {
    runAxiomArchiveOnce().catch(() => {});
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log(`Axiom archive job enabled (${schedule} UTC)`);

  if (process.env.AXIOM_ARCHIVE_RUN_ON_START === 'true') {
    setImmediate(() => runAxiomArchiveOnce().catch(() => {}));
  }

  return task;
}

function stop() {
  if (!task) return;
  task.stop();
  task = null;
}

module.exports = {
  runAxiomArchiveOnce,
  start,
  stop,
  safeArchiveErrorCode
};
