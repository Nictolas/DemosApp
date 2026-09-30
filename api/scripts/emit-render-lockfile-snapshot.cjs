const fs = require('fs');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(
  npmCommand,
  ['install', '--package-lock-only', '--ignore-scripts', '--no-fund', '--audit=false'],
  { encoding: 'utf8' }
);

if (result.status !== 0) {
  console.log('[LOCK_SNAPSHOT_ERROR]', JSON.stringify({
    status: result.status,
    stdout: (result.stdout || '').slice(-4000),
    stderr: (result.stderr || '').slice(-4000)
  }));
  process.exit(0);
}

const raw = fs.readFileSync('package-lock.json');
const encoded = zlib.gzipSync(raw, { level: 9 }).toString('base64');
const chunkSize = 3000;
const total = Math.ceil(encoded.length / chunkSize);

console.log('[LOCK_SNAPSHOT_META]', JSON.stringify({
  rawBytes: raw.length,
  gzipBase64Chars: encoded.length,
  chunks: total
}));

for (let i = 0; i < total; i += 1) {
  const chunk = encoded.slice(i * chunkSize, (i + 1) * chunkSize);
  console.log(`[LOCK_SNAPSHOT_CHUNK ${i + 1}/${total}] ${chunk}`);
}

process.exit(0);
