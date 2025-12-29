#!/usr/bin/env node

/**
 * MIGRAZIONE COMPLETA DA FIRESTORE A NEON POSTGRESQL (CORRETTA)
 * Migra tutti i dati rimasti in Firestore al database Neon usando le colonne esistenti
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

console.log('🚀 INIZIO MIGRAZIONE COMPLETA DA FIRESTORE A NEON (CORRETTA)');
console.log('📅 Data migrazione:', new Date().toISOString());

// Statistiche migrazione
const migrationStats = {
  total: 0,
  success: 0,
  errors: 0,
  skipped: 0,
  collections: {}
};

// Funzione helper per logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📝';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// Migrazione opinioni (usa colonne esistenti)
async function migrateOpinioni() {
  log('📝 Migrazione opinioni...');
  
  try {
    const snapshot = await firestore.collection('opinioni').get();
    migrationStats.collections.opinioni = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO opinioni (id, text, created_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET 
           text = EXCLUDED.text,
           created_at = EXCLUDED.created_at`,
          [data.id, data.text, data.createdAt || new Date()]
        );
        
        migrationStats.collections.opinioni.success++;
        migrationStats.success++;
      } catch (error) {
        log(`❌ Errore migrazione opinione ${doc.id}: ${error.message}`, 'error');
        migrationStats.collections.opinioni.errors++;
        migrationStats.errors++;
      }
    }
    
    log(`✅ Opinionii migrate: ${migrationStats.collections.opinioni.success}/${migrationStats.collections.opinioni.total}`);
  } catch (error) {
    log(`❌ Errore migrazione opinioni: ${error.message}`, 'error');
  }
}

// Migrazione opinioni_proposte (usa colonne esistenti)
async function migrateOpinioniProposte() {
  log('📝 Migrazione opinioni proposte...');
  
  try {
    const snapshot = await firestore.collection('opinioni_proposte').get();
    migrationStats.collections.opinioni_proposte = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO opinioni_proposte (id, testo, proponente, proponente_email, data_proposta, voti, votanti, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
           testo = EXCLUDED.testo,
           proponente = EXCLUDED.proponente,
           proponente_email = EXCLUDED.proponente_email,
           data_proposta = EXCLUDED.data_proposta,
           voti = EXCLUDED.voti,
           votanti = EXCLUDED.votanti`,
          [
            doc.id,
            data.testo,
            data.proponente,
            data.proponente_email,
            data.data_creazione ? new Date(data.data_creazione) : new Date(),
            data.voti || 0,
            data.votanti || [],
            'in_revisione'
          ]
        );
        
        migrationStats.collections.opinioni_proposte.success++;
        migrationStats.success++;
      } catch (error) {
        log(`❌ Errore migrazione opinione proposta ${doc.id}: ${error.message}`, 'error');
        migrationStats.collections.opinioni_proposte.errors++;
        migrationStats.errors++;
      }
    }
    
    log(`✅ Opinionii proposte migrate: ${migrationStats.collections.opinioni_proposte.success}/${migrationStats.collections.opinioni_proposte.total}`);
  } catch (error) {
    log(`❌ Errore migrazione opinioni proposte: ${error.message}`, 'error');
  }
}

// Migrazione voti_capo_stato (usa colonne esistenti)
async function migrateVotiCapoStato() {
  log('🗳️ Migrazione voti capo stato...');
  
  try {
    const snapshot = await firestore.collection('voti_capo_stato').get();
    migrationStats.collections.voti_capo_stato = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO voti_capo_stato (id, utente_id, nome, timestamp)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET 
           utente_id = EXCLUDED.utente_id,
           nome = EXCLUDED.nome,
           timestamp = EXCLUDED.timestamp`,
          [
            doc.id,
            data.userId,
            data.nome,
            data.timestamp ? new Date(data.timestamp) : new Date()
          ]
        );
        
        migrationStats.collections.voti_capo_stato.success++;
        migrationStats.success++;
      } catch (error) {
        log(`❌ Errore migrazione voto capo stato ${doc.id}: ${error.message}`, 'error');
        migrationStats.collections.voti_capo_stato.errors++;
        migrationStats.errors++;
      }
    }
    
    log(`✅ Voti capo stato migrati: ${migrationStats.collections.voti_capo_stato.success}/${migrationStats.collections.voti_capo_stato.total}`);
  } catch (error) {
    log(`❌ Errore migrazione voti capo stato: ${error.message}`, 'error');
  }
}

// Migrazione voti_referendum_abrogativi (usa colonne esistenti)
async function migrateVotiReferendumAbrogativi() {
  log('🗳️ Migrazione voti referendum abrogativi...');
  
  try {
    const snapshot = await firestore.collection('voti_referendum_abrogativi').get();
    migrationStats.collections.voti_referendum_abrogativi = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO voti_referendum_abrogativi (id, utente_id, referendum_id, timestamp)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET 
           utente_id = EXCLUDED.utente_id,
           referendum_id = EXCLUDED.referendum_id,
           timestamp = EXCLUDED.timestamp`,
          [
            doc.id,
            data.userId,
            data.referendumId,
            data.timestamp ? new Date(data.timestamp) : new Date()
          ]
        );
        
        migrationStats.collections.voti_referendum_abrogativi.success++;
        migrationStats.success++;
      } catch (error) {
        log(`❌ Errore migrazione voto referendum ${doc.id}: ${error.message}`, 'error');
        migrationStats.collections.voti_referendum_abrogativi.errors++;
        migrationStats.errors++;
      }
    }
    
    log(`✅ Voti referendum abrogativi migrati: ${migrationStats.collections.voti_referendum_abrogativi.success}/${migrationStats.collections.voti_referendum_abrogativi.total}`);
  } catch (error) {
    log(`❌ Errore migrazione voti referendum: ${error.message}`, 'error');
  }
}

// Migrazione admin_notifications (usa colonne esistenti)
async function migrateAdminNotifications() {
  log('🔔 Migrazione notifiche admin...');
  
  try {
    const snapshot = await firestore.collection('admin_notifications').get();
    migrationStats.collections.admin_notifications = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO admin_notifications (id, type, title, message, userdata, read, createdat, updatedat)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
           type = EXCLUDED.type,
           title = EXCLUDED.title,
           message = EXCLUDED.message,
           userdata = EXCLUDED.userdata,
           read = EXCLUDED.read,
           updatedat = EXCLUDED.updatedat`,
          [
            doc.id,
            data.type,
            data.title,
            data.message,
            data.userData ? JSON.stringify(data.userData) : null,
            data.read || false,
            data.createdAt ? new Date(data.createdAt) : new Date(),
            data.updatedAt ? new Date(data.updatedAt) : new Date()
          ]
        );
        
        migrationStats.collections.admin_notifications.success++;
        migrationStats.success++;
      } catch (error) {
        log(`❌ Errore migrazione notifica admin ${doc.id}: ${error.message}`, 'error');
        migrationStats.collections.admin_notifications.errors++;
        migrationStats.errors++;
      }
    }
    
    log(`✅ Notifiche admin migrate: ${migrationStats.collections.admin_notifications.success}/${migrationStats.collections.admin_notifications.total}`);
  } catch (error) {
    log(`❌ Errore migrazione notifiche admin: ${error.message}`, 'error');
  }
}

// Migrazione elezioni (usa colonne esistenti)
async function migrateElezioni() {
  log('🏛️ Migrazione elezioni...');
  
  try {
    const snapshot = await firestore.collection('elezioni').get();
    migrationStats.collections.elezioni = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
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
            data.dataInizio,
            data.dataFine,
            data.circa || false,
            data.createdAt ? new Date(data.createdAt) : new Date(),
            data.updatedAt ? new Date(data.updatedAt) : new Date()
          ]
        );
        
        migrationStats.collections.elezioni.success++;
        migrationStats.success++;
      } catch (error) {
        log(`❌ Errore migrazione elezione ${doc.id}: ${error.message}`, 'error');
        migrationStats.collections.elezioni.errors++;
        migrationStats.errors++;
      }
    }
    
    log(`✅ Elezioni migrate: ${migrationStats.collections.elezioni.success}/${migrationStats.collections.elezioni.total}`);
  } catch (error) {
    log(`❌ Errore migrazione elezioni: ${error.message}`, 'error');
  }
}

// Migrazione iniziative_popolari (usa colonne esistenti)
async function migrateIniziativePopolari() {
  log('📋 Migrazione iniziative popolari...');
  
  try {
    const snapshot = await firestore.collection('iniziative_popolari').get();
    migrationStats.collections.iniziative_popolari = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
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
            data.quorum,
            data.acceptedAt ? new Date(data.acceptedAt) : null,
            data.createdAt ? new Date(data.createdAt) : new Date(),
            data.updatedAt ? new Date(data.updatedAt) : new Date()
          ]
        );
        
        migrationStats.collections.iniziative_popolari.success++;
        migrationStats.success++;
      } catch (error) {
        log(`❌ Errore migrazione iniziativa popolare ${doc.id}: ${error.message}`, 'error');
        migrationStats.collections.iniziative_popolari.errors++;
        migrationStats.errors++;
      }
    }
    
    log(`✅ Iniziative popolari migrate: ${migrationStats.collections.iniziative_popolari.success}/${migrationStats.collections.iniziative_popolari.total}`);
  } catch (error) {
    log(`❌ Errore migrazione iniziative popolari: ${error.message}`, 'error');
  }
}

// Migrazione voti_iniziative_popolari (usa colonne esistenti)
async function migrateVotiIniziativePopolari() {
  log('🗳️ Migrazione voti iniziative popolari...');
  
  try {
    const snapshot = await firestore.collection('voti_iniziative_popolari').get();
    migrationStats.collections.voti_iniziative_popolari = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
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
        
        migrationStats.collections.voti_iniziative_popolari.success++;
        migrationStats.success++;
      } catch (error) {
        log(`❌ Errore migrazione voto iniziativa popolare ${doc.id}: ${error.message}`, 'error');
        migrationStats.collections.voti_iniziative_popolari.errors++;
        migrationStats.errors++;
      }
    }
    
    log(`✅ Voti iniziative popolari migrati: ${migrationStats.collections.voti_iniziative_popolari.success}/${migrationStats.collections.voti_iniziative_popolari.total}`);
  } catch (error) {
    log(`❌ Errore migrazione voti iniziative popolari: ${error.message}`, 'error');
  }
}

// Migrazione ice (usa colonne esistenti)
async function migrateIce() {
  log('🌍 Migrazione ICE (Iniziative Cittadini Europei)...');
  
  try {
    const snapshot = await firestore.collection('ice').get();
    migrationStats.collections.ice = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
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
            data.quorum,
            data.data_creazione ? new Date(data.data_creazione) : new Date()
          ]
        );
        
        migrationStats.collections.ice.success++;
        migrationStats.success++;
      } catch (error) {
        log(`❌ Errore migrazione ICE ${doc.id}: ${error.message}`, 'error');
        migrationStats.collections.ice.errors++;
        migrationStats.errors++;
      }
    }
    
    log(`✅ ICE migrate: ${migrationStats.collections.ice.success}/${migrationStats.collections.ice.total}`);
  } catch (error) {
    log(`❌ Errore migrazione ICE: ${error.message}`, 'error');
  }
}

// Funzione principale di migrazione
async function migrateAllData() {
  try {
    log('🚀 INIZIO MIGRAZIONE COMPLETA (CORRETTA)');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Esegui migrazioni in sequenza
    await migrateOpinioni();
    await migrateOpinioniProposte();
    await migrateVotiCapoStato();
    await migrateVotiReferendumAbrogativi();
    await migrateAdminNotifications();
    await migrateElezioni();
    await migrateIniziativePopolari();
    await migrateVotiIniziativePopolari();
    await migrateIce();
    
    // Riepilogo finale
    log('📊 RIEPILOGO MIGRAZIONE COMPLETA');
    log('================================');
    log(`📈 Totale documenti processati: ${migrationStats.total}`);
    log(`✅ Migrazioni riuscite: ${migrationStats.success}`);
    log(`❌ Errori: ${migrationStats.errors}`);
    log(`⏭️ Saltati: ${migrationStats.skipped}`);
    
    log('\n📋 DETTAGLIO PER COLLECTION:');
    for (const [collection, stats] of Object.entries(migrationStats.collections)) {
      log(`   📁 ${collection}: ${stats.success}/${stats.total} (${stats.errors} errori)`);
    }
    
    if (migrationStats.errors === 0) {
      log('🎉 MIGRAZIONE COMPLETATA CON SUCCESSO!');
    } else {
      log('⚠️ MIGRAZIONE COMPLETATA CON ALCUNI ERRORI');
    }
    
  } catch (error) {
    log(`❌ Errore critico durante la migrazione: ${error.message}`, 'error');
  } finally {
    await pool.end();
    log('🔚 Connessione database chiusa');
  }
}

// Esegui migrazione
migrateAllData();
