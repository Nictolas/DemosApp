#!/usr/bin/env node

/**
 * CORREZIONE MIGRAZIONE UTENTI (SEMPLIFICATA)
 * Migra solo i dati base disponibili nella tabella users
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

// Configurazione Firebase Admin SDK
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

const firestore = getFirestore(firebaseApp);

// Configurazione database Neon
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

console.log('🔧 CORREZIONE MIGRAZIONE UTENTI (SEMPLIFICATA)');
console.log('===============================================');

// Statistiche
const stats = {
  total: 0,
  updated: 0,
  errors: 0,
  skipped: 0
};

// Funzione helper per logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📝';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// Funzione per convertire timestamp
function parseTimestamp(timestamp) {
  if (!timestamp) return new Date();
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (timestamp && typeof timestamp.toDate === 'function') return timestamp.toDate();
  return new Date();
}

// Funzione per mappare il ruolo
function mapRole(firestoreRole) {
  if (!firestoreRole) return 'Elettore';
  
  const roleMap = {
    'Politico': 'Politico',
    'Utente': 'Elettore',
    'Admin': 'Admin',
    'admin': 'Admin',
    'politico': 'Politico',
    'utente': 'Elettore'
  };
  
  return roleMap[firestoreRole] || 'Elettore';
}

// Funzione per mappare lo status
function mapStatus(firestoreStatus) {
  if (!firestoreStatus) return 'pending';
  
  const statusMap = {
    'approved': 'approved',
    'pending': 'pending',
    'rejected': 'rejected',
    'Approved': 'approved',
    'Pending': 'pending',
    'Rejected': 'rejected'
  };
  
  return statusMap[firestoreStatus] || 'pending';
}

// Migrazione semplificata utenti
async function migrateUsersSimple() {
  log('🚀 INIZIO MIGRAZIONE SEMPLIFICATA UTENTI');
  
  try {
    const snapshot = await firestore.collection('utenti').get();
    stats.total = snapshot.size;
    
    log(`📊 Trovati ${stats.total} utenti in Firestore`);
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const email = data.email;
        
        if (!email) {
          log(`⚠️ Utente ${doc.id} senza email, salto`, 'warning');
          stats.skipped++;
          continue;
        }
        
        // Verifica se l'utente esiste già in Neon
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        
        if (existingUser.rows.length > 0) {
          // Aggiorna utente esistente con solo i campi disponibili
          await updateExistingUserSimple(email, data, doc.id);
          stats.updated++;
        } else {
          log(`⚠️ Utente ${email} non trovato in Neon, salto`, 'warning');
          stats.skipped++;
        }
        
      } catch (error) {
        log(`❌ Errore migrazione utente ${doc.id}: ${error.message}`, 'error');
        stats.errors++;
      }
    }
    
    // Riepilogo finale
    log('📊 RIEPILOGO MIGRAZIONE UTENTI');
    log('==============================');
    log(`📈 Totale processati: ${stats.total}`);
    log(`✅ Aggiornati: ${stats.updated}`);
    log(`❌ Errori: ${stats.errors}`);
    log(`⏭️ Saltati: ${stats.skipped}`);
    
  } catch (error) {
    log(`❌ Errore critico durante la migrazione: ${error.message}`, 'error');
  }
}

// Aggiorna utente esistente (solo campi disponibili)
async function updateExistingUserSimple(email, data, firestoreId) {
  const mappedRole = mapRole(data.ruolo);
  const mappedStatus = mapStatus(data.status);
  const createdAt = parseTimestamp(data.created_at || data.createdAt);
  
  // Usa solo le colonne disponibili nella tabella users
  await pool.query(`
    UPDATE users SET
      nome = $1,
      cognome = $2,
      ruolo = $3,
      status = $4,
      created_at = $5,
      updated_at = CURRENT_TIMESTAMP,
      password_hash = $6,
      energia_nucleare = $7,
      sperimentazione_animale = $8,
      legalizzazione_canapa = $9,
      caccia = $10
    WHERE email = $11
  `, [
    data.nome || null,
    data.cognome || null,
    mappedRole,
    mappedStatus,
    createdAt,
    data.password_hash || null,
    data.energia_nucleare || null,
    data.sperimentazione_animale || null,
    data.legalizzazione_canapa || null,
    data.caccia || null,
    email
  ]);
  
  log(`✅ Aggiornato: ${email} (${data.nome} ${data.cognome}) - Ruolo: ${mappedRole}`);
}

// Funzione principale
async function fixUsersMigrationSimple() {
  try {
    log('🚀 INIZIO CORREZIONE MIGRAZIONE UTENTI (SEMPLIFICATA)');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui migrazione semplificata
    await migrateUsersSimple();
    
    log('🎉 CORREZIONE MIGRAZIONE UTENTI COMPLETATA!');
    
  } catch (error) {
    log(`❌ Errore critico durante la correzione: ${error.message}`, 'error');
  } finally {
    await pool.end();
    log('🔚 Connessione database chiusa');
  }
}

// Esegui correzione
fixUsersMigrationSimple();
