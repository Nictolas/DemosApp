// Utility CLI: imposta il ruolo di un utente per email
// Uso: node set-user-role.cjs "email@example.com" "Admin"

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function main() {
  const emailArg = process.argv[2];
  const roleArg = process.argv[3] || 'Admin';

  if (!emailArg) {
    console.error('Uso: node set-user-role.cjs "email@example.com" "Ruolo"');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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


