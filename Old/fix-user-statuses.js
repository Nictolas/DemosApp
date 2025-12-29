#!/usr/bin/env node

/**
 * CORREZIONE STATUS UTENTI
 * Corregge gli status degli utenti in Neon da "pending" a "approved"
 * per sincronizzare con Firestore
 */

import pkg from 'pg';
const { Pool } = pkg;

// Configurazione database Neon
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

console.log('🔧 CORREZIONE STATUS UTENTI');
console.log('============================');

// Statistiche
const stats = {
  total: 0,
  updated: 0,
  errors: 0
};

// Funzione helper per logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📝';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// Correzione status utenti
async function fixUserStatuses() {
  log('🚀 INIZIO CORREZIONE STATUS UTENTI');
  
  try {
    // 1. Trova tutti gli utenti con status "pending"
    const pendingUsers = await pool.query(`
      SELECT id, email, nome, cognome, ruolo, status
      FROM users 
      WHERE status = 'pending'
    `);
    
    stats.total = pendingUsers.rows.length;
    log(`📊 Trovati ${stats.total} utenti con status "pending"`);
    
    if (stats.total === 0) {
      log('✅ Nessun utente da aggiornare!', 'success');
      return;
    }
    
    // 2. Mostra utenti che verranno aggiornati
    log('📋 UTENTI CHE VERRANNO AGGIORNATI:');
    pendingUsers.rows.forEach(user => {
      log(`📝 ${user.email} - ${user.nome} ${user.cognome} (${user.ruolo})`);
    });
    
    // 3. Aggiorna status da "pending" a "approved"
    const updateResult = await pool.query(`
      UPDATE users 
      SET status = 'approved', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'pending'
    `);
    
    stats.updated = updateResult.rowCount;
    log(`✅ Aggiornati ${stats.updated} utenti da "pending" a "approved"`);
    
    // 4. Verifica il risultato
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as pending_count
      FROM users 
      WHERE status = 'pending'
    `);
    
    const remainingPending = verifyResult.rows[0].pending_count;
    log(`📊 Utenti rimasti con status "pending": ${remainingPending}`);
    
    // 5. Riepilogo finale
    log('📊 RIEPILOGO CORREZIONE STATUS');
    log('==============================');
    log(`📈 Totale processati: ${stats.total}`);
    log(`✅ Aggiornati: ${stats.updated}`);
    log(`❌ Errori: ${stats.errors}`);
    
    if (remainingPending === 0) {
      log('🎉 TUTTI GLI UTENTI SONO STATI APPROVATI!', 'success');
    } else {
      log(`⚠️ ${remainingPending} utenti rimangono in "pending"`, 'warning');
    }
    
  } catch (error) {
    log(`❌ Errore durante la correzione: ${error.message}`, 'error');
    stats.errors++;
  }
}

// Funzione principale
async function main() {
  try {
    log('🚀 INIZIO CORREZIONE STATUS UTENTI');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui correzione
    await fixUserStatuses();
    
    log('🎉 CORREZIONE STATUS COMPLETATA!');
    
  } catch (error) {
    log(`❌ Errore critico: ${error.message}`, 'error');
  } finally {
    await pool.end();
    log('🔚 Connessione database chiusa');
  }
}

// Esegui correzione
main();
