#!/usr/bin/env node

/**
 * VERIFICA COMPLETA COLLEZIONI FIRESTORE
 * Controlla tutte le collezioni in Firestore e confronta con le tabelle in Neon
 * per identificare eventuali dati mancanti
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

console.log('🔍 VERIFICA COMPLETA COLLEZIONI FIRESTORE');
console.log('==========================================');

// Statistiche
const stats = {
  firestoreCollections: 0,
  neonTables: 0,
  missingData: 0
};

// Funzione helper per logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📝';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// Verifica completa collezioni Firestore
async function checkAllFirestoreCollections() {
  log('🚀 INIZIO VERIFICA COMPLETA COLLEZIONI FIRESTORE');
  
  try {
    // 1. Ottieni tutte le collezioni da Firestore
    const collections = await firestore.listCollections();
    const firestoreCollections = [];
    
    log('📊 COLLEZIONI TROVATE IN FIRESTORE:');
    log('===================================');
    
    for (const collection of collections) {
      const collectionName = collection.id;
      const snapshot = await collection.get();
      const docCount = snapshot.size;
      
      firestoreCollections.push({
        name: collectionName,
        count: docCount
      });
      
      log(`📋 ${collectionName}: ${docCount} documenti`);
    }
    
    stats.firestoreCollections = firestoreCollections.length;
    log(`📈 Totale collezioni Firestore: ${stats.firestoreCollections}`);
    
    // 2. Ottieni tutte le tabelle da Neon
    const neonResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const neonTables = neonResult.rows.map(row => row.table_name);
    
    log('📊 TABELLE TROVATE IN NEON:');
    log('===========================');
    neonTables.forEach(table => {
      log(`📋 ${table}`);
    });
    
    stats.neonTables = neonTables.length;
    log(`📈 Totale tabelle Neon: ${stats.neonTables}`);
    
    // 3. Mappatura collezioni Firestore -> tabelle Neon
    const collectionMapping = {
      'utenti': 'users',
      'opinioni': 'opinioni',
      'opinioni_proposte': 'opinioni_proposte',
      'opinioni_risposte': 'opinioni_risposte',
      'voti_capo_stato': 'voti_capo_stato',
      'voti_referendum_abrogativi': 'voti_referendum_abrogativi',
      'admin_notifications': 'admin_notifications',
      'elezioni': 'elezioni',
      'iniziative_popolari': 'iniziative_popolari',
      'voti_iniziative_popolari': 'voti_iniziative_popolari',
      'ice': 'ice'
    };
    
    // 4. Verifica mappatura e conta documenti
    log('📊 CONFRONTO COLLEZIONI vs TABELLE:');
    log('====================================');
    
    const missingData = [];
    
    for (const collection of firestoreCollections) {
      const collectionName = collection.name;
      const expectedTable = collectionMapping[collectionName];
      
      if (expectedTable) {
        if (neonTables.includes(expectedTable)) {
          // Verifica conteggio documenti
          const neonCountResult = await pool.query(`SELECT COUNT(*) as count FROM ${expectedTable}`);
          const neonCount = parseInt(neonCountResult.rows[0].count);
          
          log(`✅ ${collectionName} -> ${expectedTable}: Firestore=${collection.count}, Neon=${neonCount}`);
          
          if (collection.count > neonCount) {
            const missing = collection.count - neonCount;
            missingData.push({
              collection: collectionName,
              table: expectedTable,
              firestoreCount: collection.count,
              neonCount: neonCount,
              missing: missing
            });
            stats.missingData++;
          }
        } else {
          log(`❌ ${collectionName} -> ${expectedTable}: TABELLA MANCANTE IN NEON!`, 'warning');
          missingData.push({
            collection: collectionName,
            table: expectedTable,
            firestoreCount: collection.count,
            neonCount: 0,
            missing: collection.count,
            tableMissing: true
          });
          stats.missingData++;
        }
      } else {
        log(`⚠️ ${collectionName}: COLLEZIONE NON MAPPATA`, 'warning');
      }
    }
    
    // 5. Verifica tabelle Neon senza collezioni Firestore
    log('📊 TABELLE NEON SENZA COLLEZIONI FIRESTORE:');
    log('============================================');
    
    const reverseMapping = Object.fromEntries(
      Object.entries(collectionMapping).map(([k, v]) => [v, k])
    );
    
    for (const table of neonTables) {
      if (!reverseMapping[table]) {
        log(`⚠️ ${table}: TABELLA NEON SENZA COLLEZIONE FIRESTORE`, 'warning');
      }
    }
    
    // 6. Mostra dati mancanti
    if (missingData.length > 0) {
      log('⚠️ DATI MANCANTI IN NEON:', 'warning');
      log('==========================');
      
      missingData.forEach(item => {
        if (item.tableMissing) {
          log(`❌ ${item.collection}: TABELLA ${item.table} MANCANTE (${item.firestoreCount} documenti)`, 'warning');
        } else {
          log(`❌ ${item.collection}: ${item.missing} documenti mancanti (Firestore=${item.firestoreCount}, Neon=${item.neonCount})`, 'warning');
        }
      });
    } else {
      log('✅ TUTTI I DATI SONO STATI MIGRATI!', 'success');
    }
    
    // 7. Riepilogo finale
    log('📊 RIEPILOGO FINALE');
    log('====================');
    log(`📈 Collezioni Firestore: ${stats.firestoreCollections}`);
    log(`📈 Tabelle Neon: ${stats.neonTables}`);
    log(`❌ Dati mancanti: ${stats.missingData}`);
    
    if (stats.missingData === 0) {
      log('🎉 MIGRAZIONE COMPLETATA CON SUCCESSO!', 'success');
    } else {
      log('⚠️ CI SONO ANCORA DATI DA MIGRARE!', 'warning');
    }
    
    return missingData;
    
  } catch (error) {
    log(`❌ Errore durante la verifica: ${error.message}`, 'error');
    return [];
  }
}

// Funzione principale
async function main() {
  try {
    log('🚀 INIZIO VERIFICA COMPLETA COLLEZIONI FIRESTORE');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui verifica
    const missingData = await checkAllFirestoreCollections();
    
    if (missingData.length > 0) {
      log('⚠️ TROVATI DATI MANCANTI!', 'warning');
      log('Considerare la migrazione per completare il trasferimento.');
    } else {
      log('🎉 TUTTI I DATI SONO STATI MIGRATI!', 'success');
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
