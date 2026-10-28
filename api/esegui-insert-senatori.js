'use strict';

// Retired after verification of duplicate Camera/Senato users in production.
// Historical script directly inserted into public.users based on the
// existence of a Senate ('S') profile, ignoring a prior Chamber ('C')
// profile for the same person. Its former .catch(console.error) also
// reported failures without a non-zero exit code.
//
// Deliberately make every invocation fail *before* loading credentials,
// opening a DB connection or making any query. Git history retains
// the historical implementation for audit; see issue #396 / PR #397.
process.stderr.write(
  'Senate legacy importer disabled: this command could recreate duplicate politician accounts. ' +
  'Use a verified identity-first importer with canonical person IDs instead. ' +
  'See https://github.com/Nictolas/DemosApp/issues/396\n'
);
process.exitCode = 1;
