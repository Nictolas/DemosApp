#!/usr/bin/env node

/**
 * MIGRAZIONE COMPLETA DA FIRESTORE A NEON POSTGRESQL
 * Migra tutti i dati rimasti in Firestore al database Neon
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Carica variabili d'ambiente
dotenv.config();

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

console.log('🚀 INIZIO MIGRAZIONE COMPLETA DA FIRESTORE A NEON');
console.log('📅 Data migrazione:', new Date().toISOString());
console.log('🔗 Database:', process.env.DATABASE_URL ? 'Neon configurato' : '❌ DATABASE_URL mancante');

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

// Funzione per creare tabelle se non esistono
async function ensureTables() {
  log('🔧 Verifica e creazione tabelle...');
  
  const tables = [
    // Tabella opinioni
    `CREATE TABLE IF NOT EXISTS opinioni (
      id VARCHAR(255) PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    
    // Tabella opinioni_proposte
    `CREATE TABLE IF NOT EXISTS opinioni_proposte (
      id VARCHAR(255) PRIMARY KEY,
      testo TEXT NOT NULL,
      proponente VARCHAR(255),
      proponente_email VARCHAR(255),
      data_creazione TIMESTAMP,
      votanti INTEGER DEFAULT 0,
      voti INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    // Tabella voti_capo_stato
    `CREATE TABLE IF NOT EXISTS voti_capo_stato (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      timestamp TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    // Tabella voti_referendum_abrogativi
    `CREATE TABLE IF NOT EXISTS voti_referendum_abrogativi (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      referendum_id VARCHAR(255) NOT NULL,
      timestamp TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    // Tabella admin_notifications
    `CREATE TABLE IF NOT EXISTS admin_notifications (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(100) NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      user_data JSONB,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    
    // Tabella elezioni
    `CREATE TABLE IF NOT EXISTS elezioni (
      id VARCHAR(255) PRIMARY KEY,
      tipo VARCHAR(100) NOT NULL,
      zona VARCHAR(100),
      data_inizio DATE,
      data_fine DATE,
      circa BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    
    // Tabella iniziative_popolari
    `CREATE TABLE IF NOT EXISTS iniziative_popolari (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      nome TEXT NOT NULL,
      data_inizio DATE,
      data_fine DATE,
      sito_web TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      quorum INTEGER,
      accepted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    
    // Tabella voti_iniziative_popolari
    `CREATE TABLE IF NOT EXISTS voti_iniziative_popolari (
      id VARCHAR(255) PRIMARY KEY,
      iniziativa_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      timestamp TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    // Tabella ice (Iniziative Cittadini Europei)
    `CREATE TABLE IF NOT EXISTS ice (
      id VARCHAR(255) PRIMARY KEY,
      nome TEXT NOT NULL,
      descrizione TEXT,
      data_inizio DATE,
      data_fine DATE,
      sito_web TEXT,
      quorum INTEGER,
      data_creazione TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`
  ];
  
  for (const tableSQL of tables) {
    try {
      await pool.query(tableSQL);
      log(`✅ Tabella creata/verificata`);
    } catch (error) {
      log(`❌ Errore creazione tabella: ${error.message}`, 'error');
    }
  }
}

// Migrazione opinioni
async function migrateOpinioni() {
  log('📝 Migrazione opinioni...');
  
  try {
    const snapshot = await firestore.collection('opinioni').get();
    migrationStats.collections.opinioni = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO opinioni (id, text, created_at, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET 
           text = EXCLUDED.text,
           updated_at = EXCLUDED.updated_at`,
          [data.id, data.text, data.createdAt || new Date(), data.updatedAt || new Date()]
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

// Migrazione opinioni_proposte
async function migrateOpinioniProposte() {
  log('📝 Migrazione opinioni proposte...');
  
  try {
    const snapshot = await firestore.collection('opinioni_proposte').get();
    migrationStats.collections.opinioni_proposte = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO opinioni_proposte (id, testo, proponente, proponente_email, data_creazione, votanti, voti, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
           testo = EXCLUDED.testo,
           proponente = EXCLUDED.proponente,
           proponente_email = EXCLUDED.proponente_email,
           data_creazione = EXCLUDED.data_creazione,
           votanti = EXCLUDED.votanti,
           voti = EXCLUDED.voti`,
          [
            doc.id,
            data.testo,
            data.proponente,
            data.proponente_email,
            data.data_creazione ? new Date(data.data_creazione) : new Date(),
            data.votanti || 0,
            data.voti || 0,
            'pending'
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

// Migrazione voti_capo_stato
async function migrateVotiCapoStato() {
  log('🗳️ Migrazione voti capo stato...');
  
  try {
    const snapshot = await firestore.collection('voti_capo_stato').get();
    migrationStats.collections.voti_capo_stato = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO voti_capo_stato (id, user_id, nome, timestamp)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET 
           user_id = EXCLUDED.user_id,
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

// Migrazione voti_referendum_abrogativi
async function migrateVotiReferendumAbrogativi() {
  log('🗳️ Migrazione voti referendum abrogativi...');
  
  try {
    const snapshot = await firestore.collection('voti_referendum_abrogativi').get();
    migrationStats.collections.voti_referendum_abrogativi = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO voti_referendum_abrogativi (id, user_id, referendum_id, timestamp)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET 
           user_id = EXCLUDED.user_id,
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

// Migrazione admin_notifications
async function migrateAdminNotifications() {
  log('🔔 Migrazione notifiche admin...');
  
  try {
    const snapshot = await firestore.collection('admin_notifications').get();
    migrationStats.collections.admin_notifications = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO admin_notifications (id, type, title, message, user_data, read, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
           type = EXCLUDED.type,
           title = EXCLUDED.title,
           message = EXCLUDED.message,
           user_data = EXCLUDED.user_data,
           read = EXCLUDED.read,
           updated_at = EXCLUDED.updated_at`,
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

// Migrazione elezioni
async function migrateElezioni() {
  log('🏛️ Migrazione elezioni...');
  
  try {
    const snapshot = await firestore.collection('elezioni').get();
    migrationStats.collections.elezioni = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO elezioni (id, tipo, zona, data_inizio, data_fine, circa, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
           tipo = EXCLUDED.tipo,
           zona = EXCLUDED.zona,
           data_inizio = EXCLUDED.data_inizio,
           data_fine = EXCLUDED.data_fine,
           circa = EXCLUDED.circa,
           updated_at = EXCLUDED.updated_at`,
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

// Migrazione iniziative_popolari
async function migrateIniziativePopolari() {
  log('📋 Migrazione iniziative popolari...');
  
  try {
    const snapshot = await firestore.collection('iniziative_popolari').get();
    migrationStats.collections.iniziative_popolari = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO iniziative_popolari (id, user_id, nome, data_inizio, data_fine, sito_web, status, quorum, accepted_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET 
           user_id = EXCLUDED.user_id,
           nome = EXCLUDED.nome,
           data_inizio = EXCLUDED.data_inizio,
           data_fine = EXCLUDED.data_fine,
           sito_web = EXCLUDED.sito_web,
           status = EXCLUDED.status,
           quorum = EXCLUDED.quorum,
           accepted_at = EXCLUDED.accepted_at,
           updated_at = EXCLUDED.updated_at`,
          [
            doc.id,
            data.userId,
            data.nome,
            data.dataInizio,
            data.dataFine,
            data.sitoWeb,
            data.status || 'pending',
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

// Migrazione voti_iniziative_popolari
async function migrateVotiIniziativePopolari() {
  log('🗳️ Migrazione voti iniziative popolari...');
  
  try {
    const snapshot = await firestore.collection('voti_iniziative_popolari').get();
    migrationStats.collections.voti_iniziative_popolari = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO voti_iniziative_popolari (id, iniziativa_id, user_id, timestamp)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET 
           iniziativa_id = EXCLUDED.iniziativa_id,
           user_id = EXCLUDED.user_id,
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

// Migrazione ice
async function migrateIce() {
  log('🌍 Migrazione ICE (Iniziative Cittadini Europei)...');
  
  try {
    const snapshot = await firestore.collection('ice').get();
    migrationStats.collections.ice = { total: snapshot.size, success: 0, errors: 0 };
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        await pool.query(
          `INSERT INTO ice (id, nome, descrizione, data_inizio, data_fine, sito_web, quorum, data_creazione)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
           nome = EXCLUDED.nome,
           descrizione = EXCLUDED.descrizione,
           data_inizio = EXCLUDED.data_inizio,
           data_fine = EXCLUDED.data_fine,
           sito_web = EXCLUDED.sito_web,
           quorum = EXCLUDED.quorum,
           data_creazione = EXCLUDED.data_creazione`,
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
    log('🚀 INIZIO MIGRAZIONE COMPLETA');
    
    // Verifica connessione database
    await pool.query('SELECT NOW()');
    log('✅ Connessione database Neon verificata');
    
    // Crea tabelle se non esistono
    await ensureTables();
    
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
