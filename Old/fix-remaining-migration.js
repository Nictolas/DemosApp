#!/usr/bin/env node

/**
 * CORREZIONE ERRORI RIMANENTI MIGRAZIONE
 * Risolve i problemi di formato dati per completare la migrazione
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

console.log('🔧 CORREZIONE ERRORI RIMANENTI MIGRAZIONE');
console.log('========================================');

// Funzione helper per logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📝';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// Funzione per convertire anno in data completa
function yearToDate(year) {
  if (!year) return null;
  const yearStr = String(year);
  if (yearStr.length === 4 && !isNaN(parseInt(yearStr))) {
    return `${yearStr}-01-01`;
  }
  return null;
}

// Funzione per convertire quorum
function parseQuorum(quorum) {
  if (!quorum) return null;
  if (typeof quorum === 'number') return quorum;
  if (typeof quorum === 'string') {
    const parsed = parseInt(quorum);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Correzione elezioni (formato data)
async function fixElezioni() {
  log('🏛️ Correzione elezioni (formato data)...');
  
  try {
    const snapshot = await firestore.collection('elezioni').get();
    let success = 0;
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Converti anni in date complete
        const dataInizio = yearToDate(data.dataInizio);
        const dataFine = yearToDate(data.dataFine);
        
        await pool.query(
          `INSERT INTO elezioni (id, tipo, zona, datainizio, datafine, circa, createdat, updatedat)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
           tipo = EXCLUDED.tipo,
           zona = EXCLUDED.zona,
           datainizio = EXCLUDED.datainizio,
           datafine = EXCLUDED.datafine,
           circa = EXCLUDED.circa,
           updatedat = EXCLUDED.updatedat`,
          [
            doc.id,
            data.tipo,
            data.zona,
            dataInizio,
            dataFine,
            data.circa || false,
            data.createdAt ? new Date(data.createdAt) : new Date(),
            data.updatedAt ? new Date(data.updatedAt) : new Date()
          ]
        );
        
        success++;
      } catch (error) {
        log(`❌ Errore correzione elezione ${doc.id}: ${error.message}`, 'error');
        errors++;
      }
    }
    
    log(`✅ Elezioni corrette: ${success}/${snapshot.size} (${errors} errori)`);
  } catch (error) {
    log(`❌ Errore correzione elezioni: ${error.message}`, 'error');
  }
}

// Correzione iniziative popolari (formato quorum)
async function fixIniziativePopolari() {
  log('📋 Correzione iniziative popolari (formato quorum)...');
  
  try {
    const snapshot = await firestore.collection('iniziative_popolari').get();
    let success = 0;
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Converti quorum
        const quorum = parseQuorum(data.quorum);
        
        await pool.query(
          `INSERT INTO iniziative_popolari (id, userid, nome, datainizio, datafine, sitoweb, status, quorum, acceptedat, createdat, updatedat)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET 
           userid = EXCLUDED.userid,
           nome = EXCLUDED.nome,
           datainizio = EXCLUDED.datainizio,
           datafine = EXCLUDED.datafine,
           sitoweb = EXCLUDED.sitoweb,
           status = EXCLUDED.status,
           quorum = EXCLUDED.quorum,
           acceptedat = EXCLUDED.acceptedat,
           updatedat = EXCLUDED.updatedat`,
          [
            doc.id,
            data.userId,
            data.nome,
            data.dataInizio,
            data.dataFine,
            data.sitoWeb,
            data.status || 'attiva',
            quorum,
            data.acceptedAt ? new Date(data.acceptedAt) : null,
            data.createdAt ? new Date(data.createdAt) : new Date(),
            data.updatedAt ? new Date(data.updatedAt) : new Date()
          ]
        );
        
        success++;
      } catch (error) {
        log(`❌ Errore correzione iniziativa popolare ${doc.id}: ${error.message}`, 'error');
        errors++;
      }
    }
    
    log(`✅ Iniziative popolari corrette: ${success}/${snapshot.size} (${errors} errori)`);
  } catch (error) {
    log(`❌ Errore correzione iniziative popolari: ${error.message}`, 'error');
  }
}

// Correzione ICE (formato quorum)
async function fixIce() {
  log('🌍 Correzione ICE (formato quorum)...');
  
  try {
    const snapshot = await firestore.collection('ice').get();
    let success = 0;
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Converti quorum
        const quorum = parseQuorum(data.quorum);
        
        await pool.query(
          `INSERT INTO ice (id, nome, descrizione, datainizio, datafine, sitoweb, quorum, data_creazione_original)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
           nome = EXCLUDED.nome,
           descrizione = EXCLUDED.descrizione,
           datainizio = EXCLUDED.datainizio,
           datafine = EXCLUDED.datafine,
           sitoweb = EXCLUDED.sitoweb,
           quorum = EXCLUDED.quorum,
           data_creazione_original = EXCLUDED.data_creazione_original`,
          [
            doc.id,
            data.nome,
            data.descrizione,
            data.dataInizio,
            data.dataFine,
            data.sitoWeb,
            quorum,
            data.data_creazione ? new Date(data.data_creazione) : new Date()
          ]
        );
        
        success++;
      } catch (error) {
        log(`❌ Errore correzione ICE ${doc.id}: ${error.message}`, 'error');
        errors++;
      }
    }
    
    log(`✅ ICE corrette: ${success}/${snapshot.size} (${errors} errori)`);
  } catch (error) {
    log(`❌ Errore correzione ICE: ${error.message}`, 'error');
  }
}

// Correzione voti iniziative popolari (foreign key)
async function fixVotiIniziativePopolari() {
  log('🗳️ Correzione voti iniziative popolari (foreign key)...');
  
  try {
    const snapshot = await firestore.collection('voti_iniziative_popolari').get();
    let success = 0;
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Verifica se l'iniziativa esiste prima di inserire il voto
        const iniziativaExists = await pool.query(
          'SELECT id FROM iniziative_popolari WHERE id = $1',
          [data.iniziativaId]
        );
        
        if (iniziativaExists.rows.length === 0) {
          log(`⚠️ Iniziativa ${data.iniziativaId} non trovata, salto voto ${doc.id}`, 'warning');
          errors++;
          continue;
        }
        
        await pool.query(
          `INSERT INTO voti_iniziative_popolari (id, iniziativa_id, userid, timestamp)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET 
           iniziativa_id = EXCLUDED.iniziativa_id,
           userid = EXCLUDED.userid,
           timestamp = EXCLUDED.timestamp`,
          [
            doc.id,
            data.iniziativaId,
            data.userId,
            data.timestamp ? new Date(data.timestamp) : new Date()
          ]
        );
        
        success++;
      } catch (error) {
        log(`❌ Errore correzione voto iniziativa popolare ${doc.id}: ${error.message}`, 'error');
        errors++;
      }
    }
    
    log(`✅ Voti iniziative popolari corretti: ${success}/${snapshot.size} (${errors} errori)`);
  } catch (error) {
    log(`❌ Errore correzione voti iniziative popolari: ${error.message}`, 'error');
  }
}

// Funzione principale di correzione
async function fixAllRemainingErrors() {
  try {
    log('🚀 INIZIO CORREZIONE ERRORI RIMANENTI');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui correzioni in sequenza
    await fixElezioni();
    await fixIniziativePopolari();
    await fixIce();
    await fixVotiIniziativePopolari();
    
    log('🎉 CORREZIONE ERRORI COMPLETATA!');
    
  } catch (error) {
    log(`❌ Errore critico durante la correzione: ${error.message}`, 'error');
  } finally {
    await pool.end();
    log('🔚 Connessione database chiusa');
  }
}

// Esegui correzione
fixAllRemainingErrors();
