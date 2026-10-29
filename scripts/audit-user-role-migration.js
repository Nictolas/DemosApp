'use strict';

// F12-12A: deterministic, read-only inventory of legacy account references.
// Scan the tracked tree, including importers and test fixtures; never connect to a DB.
// The inventory is intentionally over-inclusive: a match is NOT automatically a
// dependency on public.users.ruolo. Humans must classify the entries before removal.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.sql',
  '.py', '.sh', '.yml', '.yaml', '.json'
]);
const EXCLUDED = /(^|\/)(node_modules|dist|build|coverage|\.next|\.expo)(\/|$)/;
const SIGNALS = Object.freeze([
  ['legacy_role', /\bruolo\b/i],
  ['account_type', /\baccount_type\b/i],
  ['capability', /\b(?:is_admin|is_dpo|is_activist|is_politician|is_candidate)\b/i],
  ['account_status', /\b(?:users|u|user|account|profile)\.status\b|\bstatus\s*(?:=|!=|<>|IN)\s*(?:\('a'|'a'|'v'|'pending')/i]
]);

function kindFor(file) {
  if (/(^|\/)(tests?|__tests__)(\/|$)|\.(?:test|spec)\.[a-z]+$/i.test(file)) return 'TEST';
  if (/(^|\/)(migrations?|database|db)(\/|$)|\.sql$/i.test(file)) return 'MIGRATION_OR_SQL';
  if (/(^|\/)(auth|middleware|webauthn)(\/|$)|(?:jwt|session|permission|capabilit)/i.test(file)) return 'AUTH_OR_AUTHORIZATION';
  if (/politic|candidat|mandat|rappresent|elettoral|parlament|organizzaz|attivist/i.test(file)) return 'POLITICAL_OR_ORGANIZATION';
  if (/^(?:client\/src|mobile\/)/.test(file)) return 'CLIENT';
  if (/^(?:api\/routes|api\/services|server\/)/.test(file)) return 'API';
  if (/^(?:api\/scripts|scripts\/)/.test(file)) return 'SCRIPT';
  return 'OTHER';
}

function inspectLine(line) {
  return SIGNALS.filter(([, regex]) => regex.test(line)).map(([name]) => name);
}

function trackedFiles(root = ROOT) {
  const raw = cp.execFileSync('git', ['-C', root, 'ls-files', '-z'], { maxBuffer: 8 * 1024 * 1024 });
  return raw.toString('utf8').split('\0').filter(Boolean).sort();
}

function inventory(root = ROOT, files = trackedFiles(root)) {
  const matches = [];
  const skipped = [];
  let considered = 0;
  for (const file of files) {
    if (EXCLUDED.test(file) || !EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const absolute = path.join(root, file);
    let stat;
    try { stat = fs.statSync(absolute); } catch { skipped.push({ file, reason: 'unreadable' }); continue; }
    if (!stat.isFile()) continue;
    if (stat.size > 512 * 1024) { skipped.push({ file, reason: 'size_over_512KiB' }); continue; }
    const source = fs.readFileSync(absolute, 'utf8');
    if (source.includes('\0')) { skipped.push({ file, reason: 'binary' }); continue; }
    considered += 1;
    source.split(/\r?\n/).forEach((line, index) => {
      const signals = inspectLine(line);
      if (!signals.length) return;
      matches.push({
        file,
        line: index + 1,
        category: kindFor(file),
        signals,
        // No source contents: safe to attach the inventory to a public CI artifact.
      });
    });
  }
  const counts = {};
  for (const match of matches) {
    for (const signal of match.signals) counts[signal] = (counts[signal] || 0) + 1;
  }
  return {
    definition: 'Candidate references only; not proof of a runtime users.ruolo dependency',
    scanned_tracked_files: considered,
    skipped,
    matched_files: new Set(matches.map(x => x.file)).size,
    matched_lines: matches.length,
    signal_counts: counts,
    entries: matches
  };
}

function markdown(result) {
  const lines = [
    '# DEMOS F12-12A — legacy role inventory',
    '',
    'Read-only static inventory. This is NOT a list of confirmed dependencies on users.ruolo.',
    'A reference in a test, ministry description, or migration needs separate review.',
    '',
    '| Measure | Value |',
    '| --- | ---: |',
    '| Scanned files | ' + result.scanned_tracked_files + ' |',
    '| Files with signals | ' + result.matched_files + ' |',
    '| Matched lines | ' + result.matched_lines + ' |',
    '| Skipped files | ' + result.skipped.length + ' |'
  ];
  for (const [name, count] of Object.entries(result.signal_counts).sort()) {
    lines.push('| ' + name + ' lines | ' + count + ' |');
  }
  const categoryStats = new Map();
  const hotFiles = new Map();
  for (const entry of result.entries) {
    const current = categoryStats.get(entry.category) || { lines: 0, files: new Set() };
    current.lines += 1;
    current.files.add(entry.file);
    categoryStats.set(entry.category, current);
    if (entry.signals.includes('legacy_role')) hotFiles.set(entry.file, (hotFiles.get(entry.file) || 0) + 1);
  }
  lines.push('', '| Category | Files | Matched lines |', '| --- | ---: | ---: |');
  for (const [category, row] of [...categoryStats.entries()].sort((a, b) => b[1].lines - a[1].lines)) {
    lines.push('| ' + category + ' | ' + row.files.size + ' | ' + row.lines + ' |');
  }
  lines.push('', '## Highest-frequency legacy-role candidate files', '');
  lines.push('| File | Role lines |', '| --- | ---: |');
  [...hotFiles.entries()].filter(([file]) => kindFor(file) !== 'TEST')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 25).forEach(([file, count]) => lines.push('| ' + file + ' | ' + count + ' |'));

  lines.push('', 'Download the JSON artifact for every matching path, line and category.');
  lines.push('Review AUTH_OR_AUTHORIZATION and MIGRATION_OR_SQL before any schema change.');
  if (result.skipped.length) {
    lines.push('', '## Skipped (must review)', '');
    result.skipped.forEach(x => lines.push('- ' + x.file + ': ' + x.reason));
  }
  return lines.join('\n') + '\n';
}

function main(args = process.argv.slice(2)) {
  const result = inventory();
  const output = args.indexOf('--output');
  const markdownOutput = args.indexOf('--markdown-output');
  if (output !== -1) {
    const target = args[output + 1];
    if (!target || target.startsWith('--')) throw new Error('--output requires a path');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n');
  }
  const report = markdown(result);
  if (markdownOutput !== -1) {
    const target = args[markdownOutput + 1];
    if (!target || target.startsWith('--')) throw new Error('--markdown-output requires a path');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, report);
  }
  process.stdout.write(report);
}

if (require.main === module) main();

module.exports = { inspectLine, kindFor, inventory, markdown, trackedFiles };
