#!/usr/bin/env node

/**
 * MIGRAZIONE CANDIDATI MANCANTI
 * Crea i candidati mancanti da Firestore in Neon
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';

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

console.log('🚀 MIGRAZIONE CANDIDATI MANCANTI');
console.log('=================================');

// Statistiche
const stats = {
  total: 0,
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
    'Candidato': 'Candidato',
    'Candidato Politico': 'Candidato Politico',
    'admin': 'Admin',
    'politico': 'Politico',
    'utente': 'Elettore',
    'candidato': 'Candidato',
    'candidato politico': 'Candidato Politico'
  };
  
  return roleMap[firestoreRole] || firestoreRole;
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

// Migrazione candidati mancanti
async function migrateMissingCandidates() {
  log('🚀 INIZIO MIGRAZIONE CANDIDATI MANCANTI');
  
  try {
    const snapshot = await firestore.collection('utenti').get();
    const candidates = [];
    
    // Trova tutti i candidati in Firestore
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const ruolo = data.ruolo;
      
      if (ruolo && (ruolo.includes('Candidato') || ruolo.includes('candidato'))) {
        candidates.push({
          id: doc.id,
          data: data
        });
      }
    });
    
    stats.total = candidates.length;
    log(`📊 Trovati ${stats.total} candidati in Firestore`);
    
    for (const candidate of candidates) {
      try {
        const data = candidate.data;
        const email = data.email;
        
        if (!email) {
          log(`⚠️ Candidato ${candidate.id} senza email, salto`, 'warning');
          stats.skipped++;
          continue;
        }
        
        // Verifica se il candidato esiste già in Neon
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        
        if (existingUser.rows.length > 0) {
          // Aggiorna candidato esistente
          await updateExistingCandidate(email, data, candidate.id);
          stats.created++;
        } else {
          // Crea nuovo candidato
          await createNewCandidate(email, data, candidate.id);
          stats.created++;
        }
        
      } catch (error) {
        log(`❌ Errore migrazione candidato ${candidate.id}: ${error.message}`, 'error');
        stats.errors++;
      }
    }
    
    // Riepilogo finale
    log('📊 RIEPILOGO MIGRAZIONE CANDIDATI');
    log('==================================');
    log(`📈 Totale processati: ${stats.total}`);
    log(`✅ Creati/Aggiornati: ${stats.created}`);
    log(`❌ Errori: ${stats.errors}`);
    log(`⏭️ Saltati: ${stats.skipped}`);
    
  } catch (error) {
    log(`❌ Errore critico durante la migrazione: ${error.message}`, 'error');
  }
}

// Aggiorna candidato esistente
async function updateExistingCandidate(email, data, firestoreId) {
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

// Crea nuovo candidato
async function createNewCandidate(email, data, firestoreId) {
  const mappedRole = mapRole(data.ruolo);
  const mappedStatus = mapStatus(data.status);
  const createdAt = parseTimestamp(data.created_at || data.createdAt);
  const userId = crypto.randomUUID();
  
  await pool.query(`
    INSERT INTO users (
      id, email, nome, cognome, ruolo, status, created_at, updated_at, 
      password_hash, energia_nucleare, sperimentazione_animale, 
      legalizzazione_canapa, caccia
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, $10, $11, $12)
  `, [
    userId,
    email,
    data.nome || null,
    data.cognome || null,
    mappedRole,
    mappedStatus,
    createdAt,
    data.password_hash || null,
    data.energia_nucleare || null,
    data.sperimentazione_animale || null,
    data.legalizzazione_canapa || null,
    data.caccia || null
  ]);
  
  log(`✅ Creato: ${email} (${data.nome} ${data.cognome}) - Ruolo: ${mappedRole}`);
}

// Funzione principale
async function main() {
  try {
    log('🚀 INIZIO MIGRAZIONE CANDIDATI MANCANTI');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui migrazione
    await migrateMissingCandidates();
    
    log('🎉 MIGRAZIONE CANDIDATI COMPLETATA!');
    
  } catch (error) {
    log(`❌ Errore critico durante la migrazione: ${error.message}`, 'error');
  } finally {
    await pool.end();
    log('🔚 Connessione database chiusa');
  }
}

// Esegui migrazione
main();
