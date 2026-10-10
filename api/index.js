'use strict';

const { runStagingBootGate } = require('./scripts/stagingBoot');

async function bootstrap() {
  await runStagingBootGate();
  require('./server');
}

bootstrap().catch((error) => {
  console.error(`[startup] FAILED: ${error.message}`);
  process.exitCode = 1;
});
