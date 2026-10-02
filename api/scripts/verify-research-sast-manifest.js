const fs = require('fs');
const path = require('path');
const targets = require('../config/researchRuntimeSastManifest');
const repoRoot = path.resolve(__dirname, '..', '..');
const roots = Object.freeze(['api/research-server.js', 'api/research-app.js']);

const resolveLocalModule = (relativeFile, request) => {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(relativeFile), request));
  const candidates = path.posix.extname(base)
    ? [base]
    : [base + '.js', path.posix.join(base, 'index.js')];
  return candidates.find((candidate) => fs.existsSync(path.join(repoRoot, candidate))) || candidates[0];
};

const localRequires = (relativeFile) => {
  const source = fs.readFileSync(path.join(repoRoot, relativeFile), 'utf8');
  return [...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)]
    .map((match) => match[1])
    .filter((request) => request.startsWith('.'))
    .map((request) => resolveLocalModule(relativeFile, request));
};

const targetSet = new Set(targets);
const missingFiles = targets.filter((file) => !fs.existsSync(path.join(repoRoot, file)));
if (missingFiles.length) {
  console.error('Research SAST manifest contains missing files: ' + missingFiles.join(', '));
  process.exit(1);
}

const visited = new Set();
const stack = [...roots];
while (stack.length) {
  const file = stack.pop();
  if (visited.has(file)) continue;
  if (!targetSet.has(file)) {
    console.error('Research runtime recursively reaches uncovered dependency ' + file);
    process.exit(1);
  }
  visited.add(file);
  for (const dependency of localRequires(file)) stack.push(dependency);
}

const unreachable = targets.filter((file) => !visited.has(file));
if (unreachable.length) {
  console.error('Research SAST manifest contains unreachable entries: ' + unreachable.join(', '));
  process.exit(1);
}

process.stdout.write([...visited].sort().join('\n'));
