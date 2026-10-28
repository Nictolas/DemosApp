#!/usr/bin/env node
'use strict';

// Offline audit: no database, network, SQL or automatic demographic writes.
// Use only with explicitly authorized local snapshots.
const fs = require('node:fs');
const { auditOfficialSexEvidence, parseCameraSparqlBindings } = require('../utils/officialSexEvidenceAudit');

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const match = /^--(users|official|camera-sparql|out)=(.+)$/.exec(arg);
    if (!match || args[match[1]]) throw new Error('Parametro non valido o ripetuto');
    args[match[1]] = match[2];
  }
  if (!args.users || Boolean(args.official) === Boolean(args['camera-sparql'])) {
    throw new Error('Uso: node api/scripts/audit-official-sex.js --users=utenti.json (--official=senato.json | --camera-sparql=camera.json) [--out=revisione.json]');
  }
  return args;
}

function readLocalArray(filename) {
  const parsed = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (!Array.isArray(parsed)) throw new TypeError('Il file locale deve contenere un array JSON');
  return parsed;
}

function main(argv) {
  const args = parseArgs(argv);
  const users = readLocalArray(args.users);
  // La Camera restituisce SPARQL JSON results.bindings; il parser controlla
  // genere foaf:gender, URI e data di nascita prima di proporre il match.
  const official = args['camera-sparql']
    ? parseCameraSparqlBindings(
      JSON.parse(fs.readFileSync(args['camera-sparql'], 'utf8'))?.results?.bindings
    )
    : readLocalArray(args.official);
  const result = auditOfficialSexEvidence(users, official);

  if (args.out) {
    // Output solo tramite opt-in, file nuovo e permessi restrittivi.
    // L'audit non ha mai le credenziali per modificare Supabase.
    fs.writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n', {
      encoding: 'utf8', flag: 'wx', mode: 0o600
    });
  }
  // Nessun nome, cognome, data di nascita o ID personale nei log stdout.
  process.stdout.write(JSON.stringify({
    mode: result.mode,
    writes_performed: result.writes_performed,
    considered_users_with_complete_identity: result.considered_users_with_complete_identity,
    review_required_count: result.review_required_count,
    skipped: result.skipped,
    output_file_created: Boolean(args.out)
  }) + '\n');
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write('Audit non eseguito: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs };