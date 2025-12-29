#!/usr/bin/env node

/**
 * Migrazione completa di tutti i dati da Firestore a Neon
 */

import { Pool } from 'pg';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Configurazione database Neon
const neonPool = new Pool({
  connectionString: 'postgres://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

// Configurazione Firebase Admin SDK
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

const firestore = getFirestore(firebaseApp);

async function migrateVotiCapoStato() {
  console.log('🗳️ Migrazione voti capo stato...');
  
  try {
    const snapshot = await firestore.collection('voti_capo_stato').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        await neonPool.query(`
          INSERT INTO voti_capo_stato (id, nome, userId, timestamp)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [
          doc.id,
          data.nome,
          data.userId,
          data.timestamp?.toDate() || new Date()
        ]);
        migrated++;
      } catch (error) {
        console.error(`❌ Errore inserimento voto capo stato ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Migrati ${migrated} voti capo stato, skippati ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti capo stato:', error);
  }
}

async function migrateVotiReferendumAbrogativi() {
  console.log('📊 Migrazione voti referendum abrogativi...');
  
  try {
    const snapshot = await firestore.collection('voti_referendum_abrogativi').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        await neonPool.query(`
          INSERT INTO voti_referendum_abrogativi (id, userId, referendumId, timestamp)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [
          doc.id,
          data.userId,
          data.referendumId,
          data.timestamp?.toDate() || new Date()
        ]);
        migrated++;
      } catch (error) {
        console.error(`❌ Errore inserimento voto referendum ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Migrati ${migrated} voti referendum, skippati ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti referendum:', error);
  }
}

async function migrateAdminNotifications() {
  console.log('🔔 Migrazione notifiche amministrative...');
  
  try {
    const snapshot = await firestore.collection('admin_notifications').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        await neonPool.query(`
          INSERT INTO admin_notifications (id, type, title, message, userData, created_at, read, createdAt, updatedAt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          doc.id,
          data.type,
          data.title,
          data.message,
          data.userData ? JSON.stringify(data.userData) : null,
          data.createdAt?.toDate() || new Date(),
          data.read || false,
          data.createdAt?.toDate() || new Date(),
          data.updatedAt?.toDate() || new Date()
        ]);
        migrated++;
      } catch (error) {
        console.error(`❌ Errore inserimento notifica ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Migrate ${migrated} notifiche, skippate ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore migrazione notifiche:', error);
  }
}

async function migrateElezioni() {
  console.log('🏛️ Migrazione elezioni...');
  
  try {
    const snapshot = await firestore.collection('elezioni').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        await neonPool.query(`
          INSERT INTO elezioni (id, tipo, zona, dataInizio, dataFine, circa, created_at, updated_at, createdAt, updatedAt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [
          doc.id,
          data.tipo,
          data.zona,
          data.dataInizio,
          data.dataFine,
          data.circa,
          data.createdAt?.toDate() || new Date(),
          data.updatedAt?.toDate() || new Date(),
          data.createdAt?.toDate() || new Date(),
          data.updatedAt?.toDate() || new Date()
        ]);
        migrated++;
      } catch (error) {
        console.error(`❌ Errore inserimento elezione ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Migrate ${migrated} elezioni, skippate ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore migrazione elezioni:', error);
  }
}

async function migrateIniziativePopolari() {
  console.log('📝 Migrazione iniziative popolari...');
  
  try {
    const snapshot = await firestore.collection('iniziative_popolari').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        await neonPool.query(`
          INSERT INTO iniziative_popolari (id, userId, nome, dataInizio, dataFine, sitoWeb, status, quorum, created_at, updated_at, createdAt, updatedAt, acceptedAt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO NOTHING
        `, [
          doc.id,
          data.userId,
          data.nome,
          data.dataInizio,
          data.dataFine,
          data.sitoWeb,
          data.status,
          data.quorum,
          data.createdAt?.toDate() || new Date(),
          data.updatedAt?.toDate() || new Date(),
          data.createdAt?.toDate() || new Date(),
          data.updatedAt?.toDate() || new Date(),
          data.acceptedAt?.toDate() || null
        ]);
        migrated++;
      } catch (error) {
        console.error(`❌ Errore inserimento iniziativa ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Migrate ${migrated} iniziative popolari, skippate ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore migrazione iniziative popolari:', error);
  }
}

async function migrateVotiIniziativePopolari() {
  console.log('🗳️ Migrazione voti iniziative popolari...');
  
  try {
    const snapshot = await firestore.collection('voti_iniziative_popolari').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        await neonPool.query(`
          INSERT INTO voti_iniziative_popolari (id, iniziativaId, userId, timestamp)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [
          doc.id,
          data.iniziativaId,
          data.userId,
          data.timestamp?.toDate() || new Date()
        ]);
        migrated++;
      } catch (error) {
        console.error(`❌ Errore inserimento voto iniziativa ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Migrati ${migrated} voti iniziative, skippati ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti iniziative:', error);
  }
}

async function migrateICE() {
  console.log('🇪🇺 Migrazione ICE (Iniziative Cittadini Europei)...');
  
  try {
    const snapshot = await firestore.collection('ice').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        await neonPool.query(`
          INSERT INTO ice (id, nome, descrizione, dataInizio, dataFine, sitoWeb, quorum, data_creazione)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [
          doc.id,
          data.nome,
          data.descrizione,
          data.dataInizio,
          data.dataFine,
          data.sitoWeb,
          data.quorum,
          data.data_creazione?.toDate() || new Date()
        ]);
        migrated++;
      } catch (error) {
        console.error(`❌ Errore inserimento ICE ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Migrate ${migrated} ICE, skippate ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore migrazione ICE:', error);
  }
}

async function updateUtentiWithAdditionalFields() {
  console.log('👥 Aggiornamento utenti con campi aggiuntivi...');
  
  try {
    const snapshot = await firestore.collection('utenti').get();
    let updated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        await neonPool.query(`
          UPDATE utenti SET
            paese_candidatura = $1,
            provincia_residenza = $2,
            comune_residenza = $3,
            regione_residenza = $4,
            provincia_elezione = $5,
            regione_elezione = $6,
            grado_elezione = $7,
            paese_elezione = $8,
            provincia_candidatura = $9,
            paese_residenza = $10,
            comune_candidatura = $11,
            cittadina_animale = $12,
            caccia = $13,
            eutanasia = $14,
            case_chiuse = $15,
            salario_minimo = $16,
            matrimonio_gay = $17,
            legalizzazione_canapa = $18,
            energia_nucleare = $19,
            nato = $20,
            omobitransfobia = $21,
            data_nascita = $22,
            genere = $23,
            uid = $24,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $25
        `, [
          data.paese_candidatura,
          data.provincia_residenza,
          data.comune_residenza,
          data.regione_residenza,
          data.provincia_elezione,
          data.regione_elezione,
          data.grado_elezione,
          data.paese_elezione,
          data.provincia_candidatura,
          data.paese_residenza,
          data.comune_candidatura,
          data.cittadina_animale,
          data.caccia,
          data.eutanasia,
          data.case_chiuse,
          data.salario_minimo,
          data.matrimonio_gay,
          data.legalizzazione_canapa,
          data.energia_nucleare,
          data.nato,
          data.omobitransfobia,
          data.data_nascita,
          data.genere,
          data.uid,
          doc.id
        ]);
        updated++;
      } catch (error) {
        console.error(`❌ Errore aggiornamento utente ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Aggiornati ${updated} utenti, skippati ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore aggiornamento utenti:', error);
  }
}

async function checkFinalStatus() {
  console.log('📊 Stato finale migrazione...');
  
  try {
    const tables = [
      'utenti',
      'opinioni',
      'opinioni_proposte',
      'voti_capo_stato',
      'voti_referendum_abrogativi',
      'admin_notifications',
      'elezioni',
      'iniziative_popolari',
      'voti_iniziative_popolari',
      'ice'
    ];
    
    for (const table of tables) {
      const result = await neonPool.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`📁 ${table}: ${result.rows[0].count} record`);
    }
    
  } catch (error) {
    console.error('❌ Errore verifica stato finale:', error);
  }
}

async function migrateAllData() {
  console.log('🚀 Migrazione completa di tutti i dati...');
  console.log('📅 Data migrazione:', new Date().toISOString());
  
  try {
    // Migra tutti i dati in ordine
    await updateUtentiWithAdditionalFields();
    await migrateVotiCapoStato();
    await migrateVotiReferendumAbrogativi();
    await migrateAdminNotifications();
    await migrateElezioni();
    await migrateIniziativePopolari();
    await migrateVotiIniziativePopolari();
    await migrateICE();
    
    await checkFinalStatus();
    
    console.log('\n🎉 Migrazione completa terminata con successo!');
    console.log('📊 Database Neon popolato con tutti i dati esistenti');
    
  } catch (error) {
    console.error('\n❌ Errore durante la migrazione completa:', error);
  } finally {
    await neonPool.end();
    console.log('\n🔒 Connessione chiusa');
  }
}

// Esegui migrazione completa
migrateAllData();
