#!/usr/bin/env node
/**
 * Crea un account AD (Admin) dedicato alle credenziali per Google Play Console.
 * Uso: dalla cartella api/
 *   set PLAY_REVIEW_ADMIN_PASSWORD=LaTuaPasswordSicura
 *   node create-play-review-admin.js
 *
 * Opzionale: PLAY_REVIEW_ADMIN_EMAIL (default: play-review@demos.community)
 *
 * Richiede: .env con DATABASE_URL (o variabile d'ambiente).
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool } = require('./config/database');

const SALT_ROUNDS = 10;
const DEFAULT_EMAIL = 'play-review@demos.community';

async function main() {
  const email = (process.env.PLAY_REVIEW_ADMIN_EMAIL || DEFAULT_EMAIL).toLowerCase().trim();
  const password = process.env.PLAY_REVIEW_ADMIN_PASSWORD;

  if (!password || password.length < 8) {
    console.error('❌ Imposta la variabile PLAY_REVIEW_ADMIN_PASSWORD (minimo 8 caratteri).');
    console.error('   Esempio (PowerShell): $env:PLAY_REVIEW_ADMIN_PASSWORD="LaTuaPasswordSicura123"');
    console.error('   Poi: node create-play-review-admin.js');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL non definita. Avvia da cartella api/ con .env configurato.');
    process.exit(1);
  }

  const pool = getPool();

  try {
    const existing = await pool.query(
      'SELECT id, email, ruolo, status FROM users WHERE LOWER(TRIM(email)) = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      console.log('⚠️  Account già esistente con email:', email);
      console.log('   id:', existing.rows[0].id, '| ruolo:', existing.rows[0].ruolo, '| status:', existing.rows[0].status);
      console.log('   Per resettare la password, aggiorna manualmente l\'utente o elimina e riesegui lo script.');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date().toISOString();

    const insertQuery = `
      INSERT INTO users (
        nome, cognome, email, password_hash, ruolo, status, email_verification_token,
        privacy_policy_consent, terms_of_service_consent, consent_timestamp,
        political_opinions_consent, political_opinions_consent_timestamp,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NULL,
        true, true, $7,
        true, $7,
        NOW()
      )
      RETURNING id, nome, cognome, email, ruolo, status
    `;
    const result = await pool.query(insertQuery, [
      'Play',
      'Review',
      email,
      passwordHash,
      'AD',
      'a',
      now
    ]);

    const user = result.rows[0];
    console.log('✅ Account AD creato con successo.');
    console.log('   id:', user.id);
    console.log('   email:', user.email);
    console.log('   ruolo:', user.ruolo);
    console.log('   status:', user.status);
    console.log('');
    console.log('   Usa queste credenziali in Google Play Console > Accesso alle app > Credenziali di accesso.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Errore:', err.message);
    if (err.code) console.error('   code:', err.code);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
