#!/usr/bin/env node
'use strict';

// Purely offline. No Supabase credentials or network access are used.
// Input and optional output are local; NEVER commit real user snapshots.
const fs = require('node:fs');
const { auditPoliticalIdentityCrosswalk } = require('../utils/politicalIdentityCrosswalkAudit');

function main(argv) {
  const args = {};
  for (const arg of argv) {
    const match = /^--(cases|out)=(.+)$/.exec(arg);
    if (!match || args[match[1]]) throw new Error('Argomento sconosciuto o duplicato');
    args[match[1]] = match[2];
  }
  if (!args.cases) throw new Error('Uso: node api/scripts/audit-political-crosswalk.js --cases=locale.json [--out=privato.json]');
  const cases = JSON.parse(fs.readFileSync(args.cases, 'utf8'));
  const report = auditPoliticalIdentityCrosswalk(cases);
  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n', {
      encoding: 'utf8', flag: 'wx', mode: 0o600
    });
  }
  // Deliberately omit IDs of users, institutional IDs, birth dates and names.
  process.stdout.write(JSON.stringify({
    mode: report.mode,
    writes_performed: report.writes_performed,
    automatic_merges_performed: report.automatic_merges_performed,
    blocked_count: report.blocked_count,
    manual_review_count: report.manual_review_count,
    detailed_output_written: Boolean(args.out)
  }) + '\n');
  if (report.blocked_count) process.exitCode = 2;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('Crosswalk non eseguito: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
module.exports = { main };
