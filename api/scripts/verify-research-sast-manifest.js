const fs = require('fs');
const path = require('path');
const targets = require('../config/researchRuntimeSastManifest');
const repoRoot = path.resolve(__dirname, '..', '..');

const localRequires = (relativeFile) => {
  const source = fs.readFileSync(path.join(repoRoot, relativeFile), 'utf8');
  const dir = path.posix.dirname(relativeFile);
  return [...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)]
    .map((match) => match[1])
    .filter((request) => request.startsWith('.'))
    .map((request) => {
      let resolved = path.posix.normalize(path.posix.join(dir, request));
      if (!path.posix.extname(resolved)) resolved += '.js';
      return resolved;
    });
};

const targetSet = new Set(targets);
const missingFiles = targets.filter((file) => !fs.existsSync(path.join(repoRoot, file)));
if (missingFiles.length) process.exit(1);

for (const file of targets) {
  for (const dependency of localRequires(file)) {
    if (!targetSet.has(dependency)) {
      console.error(file + ' imports uncovered Research runtime dependency ' + dependency);
      process.exit(1);
    }
  }
}

process.stdout.write(targets.join('\n'));
