// Utility CLI: imposta il ruolo di un utente per email
// Uso: node set-user-role.cjs "email@example.com" "Admin"

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  // Prova a caricare .env in api/
  const apiEnv = path.resolve(__dirname, '.env');
  if (fs.existsSync(apiEnv)) {
    require('dotenv').config({ path: apiEnv });
  } else {
    // fallback: prova root del repo
    const rootEnv = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(rootEnv)) {
      require('dotenv').config({ path: rootEnv });
    }
  }
}

loadEnv();

async function main() {
  const emailArg = process.argv[2];
  const roleArg = process.argv[3] || 'Admin';
  const urlArg = process.argv[4];

  if (!emailArg) {
    console.error('Uso: node set-user-role.cjs "email@example.com" "Ruolo"');
    process.exit(1);
  }

  const connectionString = (urlArg || process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  if (!connectionString) {
    console.error('DATABASE_URL non trovata. Passa la connection string come terzo argomento o definiscila in api/.env');
    console.error('Esempio: node set-user-role.cjs "email" "Admin" "postgres://...sslmode=require"');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const { rows } = await pool.query(
      'UPDATE utenti SET ruolo = $1 WHERE LOWER(email) = LOWER($2) RETURNING id, email, ruolo',
      [roleArg, emailArg]
    );

    if (rows.length === 0) {
      console.error('Nessun utente trovato con email:', emailArg);
      process.exit(2);
    }

    console.log('Ruolo aggiornato:', rows[0]);
  } catch (err) {
    console.error('Errore aggiornamento ruolo:', err);
    process.exit(3);
  } finally {
    await pool.end();
  }
}

main();


