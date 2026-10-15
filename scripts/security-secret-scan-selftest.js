const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scanner = path.resolve(__dirname, 'security-secret-scan.js');

test('RT03 secret scanner blocks a synthetic secret without echoing it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-rt03-'));
  try {
    const fake = ['AK', 'IA', 'ABCDEFGHIJKLMNOP'].join('');
    const bad = path.join(dir, 'synthetic-secret.txt');
    fs.writeFileSync(bad, `TOKEN=${fake}\n`, 'utf8');
    const result = spawnSync(process.execPath, [scanner, bad], { encoding: 'utf8' });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    assert.equal(result.status, 2);
    assert.match(output, /SECRET_SCAN_FINDING AWS_ACCESS_KEY/);
    assert.doesNotMatch(output, new RegExp(fake));

    const safe = path.join(dir, 'safe.txt');
    fs.writeFileSync(safe, 'TOKEN=synthetic-placeholder-only\n', 'utf8');
    const safeResult = spawnSync(process.execPath, [scanner, safe], { encoding: 'utf8' });
    assert.equal(safeResult.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
