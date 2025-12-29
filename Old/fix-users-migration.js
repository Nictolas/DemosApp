#!/usr/bin/env node

/**
 * CORREZIONE MIGRAZIONE UTENTI
 * Migra correttamente tutti i dati mancanti da Firestore "utenti" a Neon "users"
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
  connectionString: 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

console.log('🔧 CORREZIONE MIGRAZIONE UTENTI');
console.log('===============================');

// Statistiche
const stats = {
  total: 0,
  updated: 0,
  created: 0,
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

// Migrazione completa utenti
async function migrateUsersComplete() {
  log('🚀 INIZIO MIGRAZIONE COMPLETA UTENTI');
  
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
          // Aggiorna utente esistente
          await updateExistingUser(email, data, doc.id);
          stats.updated++;
        } else {
          // Crea nuovo utente
          await createNewUser(email, data, doc.id);
          stats.created++;
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
    log(`🆕 Creati: ${stats.created}`);
    log(`❌ Errori: ${stats.errors}`);
    log(`⏭️ Saltati: ${stats.skipped}`);
    
  } catch (error) {
    log(`❌ Errore critico durante la migrazione: ${error.message}`, 'error');
  }
}

// Aggiorna utente esistente
async function updateExistingUser(email, data, firestoreId) {
  const mappedRole = mapRole(data.ruolo);
  const mappedStatus = mapStatus(data.status);
  const createdAt = parseTimestamp(data.created_at || data.createdAt);
  
  await pool.query(`
    UPDATE users SET
      nome = $1,
      cognome = $2,
      ruolo = $3,
      status = $4,
      created_at = $5,
      updated_at = CURRENT_TIMESTAMP,
      password_hash = $6,
      data_nascita = $7,
      genere = $8,
      cittadinanza = $9,
      paese_residenza = $10,
      regione_residenza = $11,
      provincia_residenza = $12,
      comune_residenza = $13,
      paese_elezione = $14,
      regione_elezione = $15,
      provincia_elezione = $16,
      comune_elezione = $17,
      paese_candidatura = $18,
      regione_candidatura = $19,
      provincia_candidatura = $20,
      comune_candidatura = $21,
      grado_elezione = $22,
      grado_candidatura = $23,
      energia_nucleare = $24,
      sperimentazione_animale = $25,
      legalizzazione_canapa = $26,
      caccia = $27
    WHERE email = $28
  `, [
    data.nome || null,
    data.cognome || null,
    mappedRole,
    mappedStatus,
    createdAt,
    data.password_hash || null,
    data.data_nascita || null,
    data.genere || data.sesso || null,
    data.cittadinanza || null,
    data.paese_residenza || null,
    data.regione_residenza || null,
    data.provincia_residenza || null,
    data.comune_residenza || null,
    data.paese_elezione || null,
    data.regione_elezione || null,
    data.provincia_elezione || null,
    data.comune_elezione || null,
    data.paese_candidatura || null,
    data.regione_candidatura || null,
    data.provincia_candidatura || null,
    data.comune_candidatura || null,
    data.grado_elezione || null,
    data.grado_candidatura || null,
    data.energia_nucleare || null,
    data.sperimentazione_animale || null,
    data.legalizzazione_canapa || null,
    data.caccia || null,
    email
  ]);
  
  log(`✅ Aggiornato: ${email} (${data.nome} ${data.cognome})`);
}

// Crea nuovo utente
async function createNewUser(email, data, firestoreId) {
  const mappedRole = mapRole(data.ruolo);
  const mappedStatus = mapStatus(data.status);
  const createdAt = parseTimestamp(data.created_at || data.createdAt);
  
  await pool.query(`
    INSERT INTO users (
      email, nome, cognome, ruolo, status, created_at, updated_at,
      password_hash, data_nascita, genere, cittadinanza,
      paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
      paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
      paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
      grado_elezione, grado_candidatura,
      energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia
    ) VALUES (
      $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP,
      $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
    )
  `, [
    email,
    data.nome || null,
    data.cognome || null,
    mappedRole,
    mappedStatus,
    createdAt,
    data.password_hash || null,
    data.data_nascita || null,
    data.genere || data.sesso || null,
    data.cittadinanza || null,
    data.paese_residenza || null,
    data.regione_residenza || null,
    data.provincia_residenza || null,
    data.comune_residenza || null,
    data.paese_elezione || null,
    data.regione_elezione || null,
    data.provincia_elezione || null,
    data.comune_elezione || null,
    data.paese_candidatura || null,
    data.regione_candidatura || null,
    data.provincia_candidatura || null,
    data.comune_candidatura || null,
    data.grado_elezione || null,
    data.grado_candidatura || null,
    data.energia_nucleare || null,
    data.sperimentazione_animale || null,
    data.legalizzazione_canapa || null,
    data.caccia || null
  ]);
  
  log(`🆕 Creato: ${email} (${data.nome} ${data.cognome})`);
}

// Funzione principale
async function fixUsersMigration() {
  try {
    log('🚀 INIZIO CORREZIONE MIGRAZIONE UTENTI');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui migrazione completa
    await migrateUsersComplete();
    
    log('🎉 CORREZIONE MIGRAZIONE UTENTI COMPLETATA!');
    
  } catch (error) {
    log(`❌ Errore critico durante la correzione: ${error.message}`, 'error');
  } finally {
    await pool.end();
    log('🔚 Connessione database chiusa');
  }
}

// Esegui correzione
fixUsersMigration();
