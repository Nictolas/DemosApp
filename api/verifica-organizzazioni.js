#!/usr/bin/env node
/**
 * Script di verifica per la pagina Organizzazioni.
 * Controlla: colonna users.organizzazioni, esistenza di utenti con ruolo 'O'.
 *
 * Uso: dalla cartella api/
 *   node verifica-organizzazioni.js
 *
 * Richiede .env con DATABASE_URL (Neon).
 */

require('dotenv').config();
const { getPool } = require('./config/database');

async function main() {
  const pool = getPool ? getPool() : null;
  if (!pool) {
    console.log('❌ Impossibile ottenere il pool DB. Verifica api/config/database.js e DATABASE_URL in .env');
    process.exit(1);
  }

  try {
    // 1) Colonna organizzazioni in users
    const colCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'organizzazioni'
    `);
    if (colCheck.rows.length === 0) {
      console.log('⚠️  Colonna users.organizzazioni NON presente. Aggiungila con:');
      console.log('   ALTER TABLE users ADD COLUMN IF NOT EXISTS organizzazioni VARCHAR(255) DEFAULT NULL;');
      console.log('   CREATE INDEX IF NOT EXISTS idx_users_organizzazioni ON users (organizzazioni);');
    } else {
      console.log('✅ Colonna users.organizzazioni presente:', colCheck.rows[0].data_type);
    }

    // 2) Conteggio utenti con ruolo 'O'
    const countO = await pool.query(
      "SELECT COUNT(*) AS n FROM users WHERE ruolo = 'O'"
    );
    const n = parseInt(countO.rows[0].n, 10);
    console.log('');
    if (n === 0) {
      console.log('⚠️  Nessun utente con ruolo "O" (Organizzazione). La pagina /organizzazioni sarà vuota.');
      console.log('   Per avere organizzazioni in lista, crea o aggiorna utenti con ruolo = \'O\'.');
    } else {
      console.log(`✅ Trovati ${n} utenti con ruolo "O" (Organizzazioni). Dovrebbero apparire in /organizzazioni.`);
      const sample = await pool.query(`
        SELECT id, email, nome, cognome, ruolo, status
        FROM users WHERE ruolo = 'O'
        ORDER BY created_at DESC
        LIMIT 5
      `);
      console.log('   Prime organizzazioni (max 5):');
      sample.rows.forEach((r) => console.log('   -', r.email || r.id, r.nome, r.cognome));
    }

    // 3) Opzionale: quanti utenti seguono almeno un'organizzazione
    try {
      const followers = await pool.query(`
        SELECT COUNT(*) AS n FROM users WHERE organizzazioni IS NOT NULL AND organizzazioni != ''
      `);
      console.log('');
      console.log('📊 Utenti che seguono un\'organizzazione:', followers.rows[0].n);
    } catch (e) {
      // colonna potrebbe non esistere
    }
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  } finally {
    if (pool && typeof pool.end === 'function') pool.end();
  }
}

main();
