#!/usr/bin/env node

/**
 * CONFRONTO COMPLETO UTENTI
 * Confronta tutti i dati tra Firestore "utenti" e Neon "users"
 * per identificare differenze, dati mancanti o inconsistenti
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

console.log('🔍 CONFRONTO COMPLETO UTENTI FIRESTORE vs NEON');
console.log('==============================================');

// Statistiche
const stats = {
  firestoreTotal: 0,
  neonTotal: 0,
  missingInNeon: 0,
  missingInFirestore: 0,
  differentData: 0,
  identical: 0,
  errors: 0
};

// Funzione helper per logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📝';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// Funzione per normalizzare i dati per il confronto
function normalizeData(data, source) {
  const normalized = {
    email: data.email || null,
    nome: data.nome || null,
    cognome: data.cognome || null,
    ruolo: data.ruolo || null,
    status: data.status || null,
    energia_nucleare: data.energia_nucleare || null,
    sperimentazione_animale: data.sperimentazione_animale || null,
    legalizzazione_canapa: data.legalizzazione_canapa || null,
    caccia: data.caccia || null
  };
  
  // Normalizza ruoli
  if (normalized.ruolo) {
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
    normalized.ruolo = roleMap[normalized.ruolo] || normalized.ruolo;
  }
  
  // Normalizza status
  if (normalized.status) {
    const statusMap = {
      'approved': 'approved',
      'pending': 'pending',
      'rejected': 'rejected',
      'Approved': 'approved',
      'Pending': 'pending',
      'Rejected': 'rejected'
    };
    normalized.status = statusMap[normalized.status] || normalized.status;
  }
  
  return normalized;
}

// Funzione per confrontare due oggetti
function compareObjects(obj1, obj2, email) {
  const differences = [];
  const keys = Object.keys(obj1);
  
  for (const key of keys) {
    if (obj1[key] !== obj2[key]) {
      differences.push({
        field: key,
        firestore: obj1[key],
        neon: obj2[key]
      });
    }
  }
  
  return differences;
}

// Confronto completo
async function compareUsers() {
  log('🚀 INIZIO CONFRONTO COMPLETO UTENTI');
  
  try {
    // 1. Ottieni tutti gli utenti da Firestore
    const firestoreSnapshot = await firestore.collection('utenti').get();
    const firestoreUsers = new Map();
    
    firestoreSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        firestoreUsers.set(data.email, normalizeData(data, 'firestore'));
      }
    });
    
    stats.firestoreTotal = firestoreUsers.size;
    log(`📊 Trovati ${stats.firestoreTotal} utenti in Firestore`);
    
    // 2. Ottieni tutti gli utenti da Neon
    const neonResult = await pool.query(`
      SELECT email, nome, cognome, ruolo, status, 
             energia_nucleare, sperimentazione_animale, 
             legalizzazione_canapa, caccia
      FROM users
    `);
    
    const neonUsers = new Map();
    neonResult.rows.forEach(row => {
      if (row.email) {
        neonUsers.set(row.email, normalizeData(row, 'neon'));
      }
    });
    
    stats.neonTotal = neonUsers.size;
    log(`📊 Trovati ${stats.neonTotal} utenti in Neon`);
    
    // 3. Trova utenti mancanti in Neon
    const missingInNeon = [];
    for (const [email, firestoreData] of firestoreUsers) {
      if (!neonUsers.has(email)) {
        missingInNeon.push({
          email,
          data: firestoreData
        });
        stats.missingInNeon++;
      }
    }
    
    // 4. Trova utenti mancanti in Firestore
    const missingInFirestore = [];
    for (const [email, neonData] of neonUsers) {
      if (!firestoreUsers.has(email)) {
        missingInFirestore.push({
          email,
          data: neonData
        });
        stats.missingInFirestore++;
      }
    }
    
    // 5. Confronta utenti presenti in entrambi
    const differentData = [];
    for (const [email, firestoreData] of firestoreUsers) {
      if (neonUsers.has(email)) {
        const neonData = neonUsers.get(email);
        const differences = compareObjects(firestoreData, neonData, email);
        
        if (differences.length > 0) {
          differentData.push({
            email,
            differences
          });
          stats.differentData++;
        } else {
          stats.identical++;
        }
      }
    }
    
    // 6. Mostra risultati
    log('📊 RISULTATI CONFRONTO');
    log('======================');
    log(`📈 Utenti in Firestore: ${stats.firestoreTotal}`);
    log(`📈 Utenti in Neon: ${stats.neonTotal}`);
    log(`✅ Identici: ${stats.identical}`);
    log(`⚠️ Dati diversi: ${stats.differentData}`);
    log(`❌ Mancanti in Neon: ${stats.missingInNeon}`);
    log(`❌ Mancanti in Firestore: ${stats.missingInFirestore}`);
    
    // 7. Mostra dettagli utenti mancanti in Neon
    if (missingInNeon.length > 0) {
      log('⚠️ UTENTI MANCANTI IN NEON:', 'warning');
      log('============================');
      missingInNeon.forEach(user => {
        log(`❌ Mancante: ${user.email} - ${user.data.nome} ${user.data.cognome} (${user.data.ruolo})`, 'warning');
      });
    }
    
    // 8. Mostra dettagli utenti mancanti in Firestore
    if (missingInFirestore.length > 0) {
      log('⚠️ UTENTI MANCANTI IN FIRESTORE:', 'warning');
      log('================================');
      missingInFirestore.forEach(user => {
        log(`❌ Mancante: ${user.email} - ${user.data.nome} ${user.data.cognome} (${user.data.ruolo})`, 'warning');
      });
    }
    
    // 9. Mostra dettagli dati diversi
    if (differentData.length > 0) {
      log('⚠️ UTENTI CON DATI DIVERSI:', 'warning');
      log('============================');
      differentData.forEach(user => {
        log(`⚠️ ${user.email}:`, 'warning');
        user.differences.forEach(diff => {
          log(`   ${diff.field}: Firestore="${diff.firestore}" vs Neon="${diff.neon}"`, 'warning');
        });
      });
    }
    
    // 10. Riepilogo finale
    log('📊 RIEPILOGO FINALE');
    log('====================');
    if (stats.missingInNeon === 0 && stats.missingInFirestore === 0 && stats.differentData === 0) {
      log('🎉 PERFETTO! Tutti i dati sono sincronizzati!', 'success');
    } else {
      if (stats.missingInNeon > 0) {
        log(`⚠️ ${stats.missingInNeon} utenti mancanti in Neon`, 'warning');
      }
      if (stats.missingInFirestore > 0) {
        log(`⚠️ ${stats.missingInFirestore} utenti mancanti in Firestore`, 'warning');
      }
      if (stats.differentData > 0) {
        log(`⚠️ ${stats.differentData} utenti con dati diversi`, 'warning');
      }
    }
    
    return {
      missingInNeon,
      missingInFirestore,
      differentData
    };
    
  } catch (error) {
    log(`❌ Errore durante il confronto: ${error.message}`, 'error');
    stats.errors++;
    return { missingInNeon: [], missingInFirestore: [], differentData: [] };
  }
}

// Funzione principale
async function main() {
  try {
    log('🚀 INIZIO CONFRONTO COMPLETO UTENTI');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui confronto
    const results = await compareUsers();
    
    if (results.missingInNeon.length > 0 || results.missingInFirestore.length > 0 || results.differentData.length > 0) {
      log('⚠️ TROVATE DIFFERENZE!', 'warning');
      log('Considerare la migrazione per sincronizzare i dati.');
    } else {
      log('🎉 TUTTI I DATI SONO SINCRONIZZATI!', 'success');
    }
    
  } catch (error) {
    log(`❌ Errore critico: ${error.message}`, 'error');
  } finally {
    await pool.end();
    log('🔚 Connessione database chiusa');
  }
}

// Esegui confronto
main();
