const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MAX_BYTES = 2 * 1024 * 1024;
const PATTERNS = Object.freeze([
  ['AWS_ACCESS_KEY', /\bAKIA[0-9A-Z]{16}\b/],
  ['GITHUB_TOKEN', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255}\b/],
  ['GITHUB_PAT', /\bgithub_pat_[A-Za-z0-9_]{50,255}\b/],
  ['OPENAI_STYLE_KEY', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['GROQ_KEY', /\bgsk_[A-Za-z0-9]{20,}\b/]
]);

function looksBinary(buffer) {
  const probe = buffer.subarray(0, Math.min(buffer.length, 4096));
  return probe.includes(0);
}

function placeholderToken(value) {
  const token = String(value || '');
  return /x{8,}/i.test(token) || /your[_-]|placeholder|example/i.test(token);
}

function scanPrivateKey(text, file) {
  const normalized = String(text).replace(/\\n/g, '\n');
  const block = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+([A-Za-z0-9+/=\r\n]{80,})-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g;
  const findings = [];
  let match;
  while ((match = block.exec(normalized)) !== null) {
    const body = match[1].replace(/\s+/g, '');
    if (body.length < 80 || /YOUR|PLACEHOLDER|XXXX/i.test(body)) continue;
    const line = normalized.slice(0, match.index).split(/\r?\n/).length;
    findings.push(Object.freeze({ rule: 'PRIVATE_KEY', file, line }));
  }
  return findings;
}

function scanText(text, file = '<memory>') {
  const findings = [];
  String(text).split(/\r?\n/).forEach((line, index) => {
    for (const [rule, pattern] of PATTERNS) {
      const match = line.match(pattern);
      if (match && !placeholderToken(match[0])) findings.push(Object.freeze({ rule, file, line: index + 1 }));
    }
  });
  findings.push(...scanPrivateKey(text, file));
  return findings;
}

function walk(target, out = []) {
  const stat = fs.statSync(target);
  if (stat.isFile()) { out.push(target); return out; }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory() && ['.git', 'node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
    walk(path.join(target, entry.name), out);
  }
  return out;
}

function trackedFiles() {
  const raw = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return raw.split('\0').filter(Boolean).map(file => path.resolve(file));
}

function resolveFiles(args) {
  if (!args.length) return trackedFiles();
  return args.flatMap(target => walk(path.resolve(target)));
}

function scanFiles(files) {
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    if (!stat.isFile() || stat.size > MAX_BYTES) continue;
    const buffer = fs.readFileSync(file);
    if (looksBinary(buffer)) continue;
    scanned += 1;
    findings.push(...scanText(buffer.toString('utf8'), path.relative(process.cwd(), file) || path.basename(file)));
  }
  return { findings, scanned };
}

function main(args = process.argv.slice(2)) {
  const { findings, scanned } = scanFiles(resolveFiles(args));
  if (findings.length) {
    for (const finding of findings) console.error(`SECRET_SCAN_FINDING ${finding.rule} ${finding.file}:${finding.line}`);
    console.error(`Secret scan FAILED: ${findings.length} finding(s) across ${scanned} file(s).`);
    process.exitCode = 2;
    return;
  }
  console.log(`Secret scan PASS: ${scanned} file(s) scanned.`);
}

if (require.main === module) main();
module.exports = { PATTERNS, scanText, scanFiles, resolveFiles };
