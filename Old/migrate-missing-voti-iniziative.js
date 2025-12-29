#!/usr/bin/env node

/**
 * MIGRAZIONE VOTO INIZIATIVE POPOLARI MANCANTE
 * Migra il documento mancante da Firestore a Neon
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
  connectionString: 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

console.log('🚀 MIGRAZIONE VOTO INIZIATIVE POPOLARI MANCANTE');
console.log('===============================================');

// Statistiche
const stats = {
  total: 0,
  migrated: 0,
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

// Funzione per parsare quorum
function parseQuorum(quorum) {
  if (!quorum || quorum === 'ok' || quorum === 'OK') return null;
  const parsed = parseInt(quorum);
  return isNaN(parsed) ? null : parsed;
}

// Migrazione voto iniziative popolari mancante
async function migrateMissingVotiIniziative() {
  log('🚀 INIZIO MIGRAZIONE VOTO INIZIATIVE POPOLARI MANCANTE');
  
  try {
    // 1. Ottieni tutti i voti da Firestore
    const snapshot = await firestore.collection('voti_iniziative_popolari').get();
    stats.total = snapshot.size;
    
    log(`📊 Trovati ${stats.total} voti in Firestore`);
    
    // 2. Ottieni tutti i voti da Neon
    const neonResult = await pool.query('SELECT id FROM voti_iniziative_popolari');
    const neonIds = new Set(neonResult.rows.map(row => row.id));
    
    log(`📊 Trovati ${neonIds.size} voti in Neon`);
    
    // 3. Trova voti mancanti
    const missingVotes = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const firestoreId = doc.id;
      
      if (!neonIds.has(firestoreId)) {
        missingVotes.push({
          id: firestoreId,
          data: data
        });
      }
    }
    
    log(`📊 Trovati ${missingVotes.length} voti mancanti in Neon`);
    
    if (missingVotes.length === 0) {
      log('✅ Nessun voto mancante da migrare!', 'success');
      return;
    }
    
    // 4. Migra voti mancanti
    for (const vote of missingVotes) {
      try {
        const data = vote.data;
        const createdAt = parseTimestamp(data.created_at || data.createdAt);
        
        // Verifica che l'iniziativa esista
        const iniziativaExists = await pool.query(
          'SELECT id FROM iniziative_popolari WHERE id = $1',
          [data.iniziativa_id]
        );
        
        if (iniziativaExists.rows.length === 0) {
          log(`⚠️ Iniziativa ${data.iniziativa_id} non trovata, salto voto ${vote.id}`, 'warning');
          stats.skipped++;
          continue;
        }
        
        // Inserisci voto
        await pool.query(`
          INSERT INTO voti_iniziative_popolari (
            id, iniziativa_id, user_id, voto, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [
          vote.id,
          data.iniziativa_id,
          data.user_id,
          data.voto,
          createdAt
        ]);
        
        log(`✅ Migrato voto ${vote.id} per iniziativa ${data.iniziativa_id}`);
        stats.migrated++;
        
      } catch (error) {
        log(`❌ Errore migrazione voto ${vote.id}: ${error.message}`, 'error');
        stats.errors++;
      }
    }
    
    // 5. Verifica finale
    const finalNeonResult = await pool.query('SELECT COUNT(*) as count FROM voti_iniziative_popolari');
    const finalNeonCount = parseInt(finalNeonResult.rows[0].count);
    
    log(`📊 Voti finali in Neon: ${finalNeonCount}`);
    
    // 6. Riepilogo finale
    log('📊 RIEPILOGO MIGRAZIONE VOTI INIZIATIVE POPOLARI');
    log('================================================');
    log(`📈 Totale processati: ${stats.total}`);
    log(`✅ Migrati: ${stats.migrated}`);
    log(`❌ Errori: ${stats.errors}`);
    log(`⏭️ Saltati: ${stats.skipped}`);
    
    if (finalNeonCount === stats.total) {
      log('🎉 TUTTI I VOTI SONO STATI MIGRATI!', 'success');
    } else {
      log(`⚠️ Mancano ancora ${stats.total - finalNeonCount} voti`, 'warning');
    }
    
  } catch (error) {
    log(`❌ Errore critico durante la migrazione: ${error.message}`, 'error');
  }
}

// Funzione principale
async function main() {
  try {
    log('🚀 INIZIO MIGRAZIONE VOTO INIZIATIVE POPOLARI MANCANTE');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui migrazione
    await migrateMissingVotiIniziative();
    
    log('🎉 MIGRAZIONE VOTI INIZIATIVE POPOLARI COMPLETATA!');
    
  } catch (error) {
    log(`❌ Errore critico: ${error.message}`, 'error');
  } finally {
    await pool.end();
    log('🔚 Connessione database chiusa');
  }
}

// Esegui migrazione
main();
