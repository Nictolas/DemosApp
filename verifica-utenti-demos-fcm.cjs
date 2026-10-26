'use strict';
// DEMOS: retired legacy diagnostics (unsafe historical DB/FCM token dumps).
// Deliberately do not import dotenv, pg, Firebase, or open a connection.
process.stderr.write(
  'verifica-utenti-demos-fcm.cjs retired: no database access or token display. ' +
  'Use the authorized read-only aggregate SQL audit on staging and ' +
  'the synthetic PostgreSQL 17 CI tests for FCM correctness.\n'
);
process.exitCode = 2;
