#!/usr/bin/env node

/**
 * VERIFICA CANDIDATI MANCANTI
 * Controlla gli utenti con ruolo "Candidato" o "Candidato Politico" in Firestore
 * e verifica se sono presenti in Neon
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

console.log('🔍 VERIFICA CANDIDATI MANCANTI');
console.log('==============================');

// Statistiche
const stats = {
  firestoreCandidates: 0,
  neonCandidates: 0,
  missingInNeon: 0,
  foundInNeon: 0
};

// Funzione helper per logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📝';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// Verifica candidati mancanti
async function checkMissingCandidates() {
  log('🚀 INIZIO VERIFICA CANDIDATI MANCANTI');
  
  try {
    // 1. Trova tutti i candidati in Firestore
    const snapshot = await firestore.collection('utenti').get();
    const firestoreCandidates = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const ruolo = data.ruolo;
      
      if (ruolo && (ruolo.includes('Candidato') || ruolo.includes('candidato'))) {
        firestoreCandidates.push({
          id: doc.id,
          email: data.email,
          nome: data.nome,
          cognome: data.cognome,
          ruolo: ruolo,
          status: data.status
        });
      }
    });
    
    stats.firestoreCandidates = firestoreCandidates.length;
    log(`📊 Trovati ${stats.firestoreCandidates} candidati in Firestore`);
    
    // Mostra dettagli candidati Firestore
    firestoreCandidates.forEach(candidate => {
      log(`📋 Firestore: ${candidate.email} - ${candidate.nome} ${candidate.cognome} (${candidate.ruolo})`);
    });
    
    // 2. Verifica candidati in Neon
    const neonResult = await pool.query(`
      SELECT id, email, nome, cognome, ruolo, status 
      FROM users 
      WHERE ruolo ILIKE '%candidato%'
    `);
    
    stats.neonCandidates = neonResult.rows.length;
    log(`📊 Trovati ${stats.neonCandidates} candidati in Neon`);
    
    // Mostra dettagli candidati Neon
    neonResult.rows.forEach(candidate => {
      log(`✅ Neon: ${candidate.email} - ${candidate.nome} ${candidate.cognome} (${candidate.ruolo})`);
    });
    
    // 3. Trova candidati mancanti in Neon
    const missingCandidates = [];
    
    for (const firestoreCandidate of firestoreCandidates) {
      const existsInNeon = neonResult.rows.find(neonCandidate => 
        neonCandidate.email === firestoreCandidate.email
      );
      
      if (!existsInNeon) {
        missingCandidates.push(firestoreCandidate);
        stats.missingInNeon++;
      } else {
        stats.foundInNeon++;
      }
    }
    
    // 4. Mostra candidati mancanti
    if (missingCandidates.length > 0) {
      log('⚠️ CANDIDATI MANCANTI IN NEON:', 'warning');
      log('================================');
      
      missingCandidates.forEach(candidate => {
        log(`❌ Mancante: ${candidate.email} - ${candidate.nome} ${candidate.cognome} (${candidate.ruolo})`, 'warning');
      });
    } else {
      log('✅ Tutti i candidati sono presenti in Neon!', 'success');
    }
    
    // 5. Riepilogo finale
    log('📊 RIEPILOGO VERIFICA CANDIDATI');
    log('===============================');
    log(`📈 Candidati in Firestore: ${stats.firestoreCandidates}`);
    log(`📈 Candidati in Neon: ${stats.neonCandidates}`);
    log(`✅ Trovati in Neon: ${stats.foundInNeon}`);
    log(`❌ Mancanti in Neon: ${stats.missingInNeon}`);
    
    return missingCandidates;
    
  } catch (error) {
    log(`❌ Errore durante la verifica: ${error.message}`, 'error');
    return [];
  }
}

// Funzione principale
async function main() {
  try {
    log('🚀 INIZIO VERIFICA CANDIDATI MANCANTI');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui verifica
    const missingCandidates = await checkMissingCandidates();
    
    if (missingCandidates.length > 0) {
      log('⚠️ TROVATI CANDIDATI MANCANTI!', 'warning');
      log('Eseguire la migrazione per completare il trasferimento.');
    } else {
      log('🎉 TUTTI I CANDIDATI SONO PRESENTI!', 'success');
    }
    
  } catch (error) {
    log(`❌ Errore critico: ${error.message}`, 'error');
  } finally {
    await pool.end();
    log('🔚 Connessione database chiusa');
  }
}

// Esegui verifica
main();
