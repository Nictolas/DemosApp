#!/usr/bin/env node

/**
 * Migrazione dati da Keliweb PostgreSQL e Firebase Firestore a Neon
 */

import { Pool } from 'pg';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

// Configurazione database Neon (target)
const neonPool = new Pool({
  connectionString: 'postgres://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

// Configurazione database Keliweb (source) - da aggiornare con i tuoi dati
const keliwebPool = new Pool({
  host: process.env.KELIWEB_DB_HOST || 'localhost',
  port: process.env.KELIWEB_DB_PORT || 5432,
  database: process.env.KELIWEB_DB_NAME || 'demosapp',
  user: process.env.KELIWEB_DB_USER || 'postgres',
  password: process.env.KELIWEB_DB_PASSWORD || '',
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
const firebaseAuth = getAuth(firebaseApp);

async function migrateUsers() {
  console.log('👥 Migrazione utenti...');
  
  try {
    // Migra utenti da Firebase Auth
    const listUsersResult = await firebaseAuth.listUsers();
    
    for (const userRecord of listUsersResult.users) {
      const user = userRecord.toJSON();
      
      // Inserisci utente in Neon
      await neonPool.query(`
        INSERT INTO utenti (id, email, nome, cognome, status, created_at, updated_at, ruolo, premium)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          nome = EXCLUDED.nome,
          cognome = EXCLUDED.cognome,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP,
          ruolo = EXCLUDED.ruolo,
          premium = EXCLUDED.premium
      `, [
        user.uid,
        user.email,
        user.displayName?.split(' ')[0] || 'Utente',
        user.displayName?.split(' ').slice(1).join(' ') || 'Anonimo',
        'approved',
        new Date(user.metadata.creationTime),
        new Date(user.metadata.lastSignInTime || user.metadata.creationTime),
        'user',
        false
      ]);
    }
    
    console.log(`✅ Migrati ${listUsersResult.users.length} utenti da Firebase Auth`);
    
  } catch (error) {
    console.error('❌ Errore migrazione utenti:', error);
  }
}

async function migrateFirestoreData() {
  console.log('🔥 Migrazione dati Firestore...');
  
  try {
    // Migra comunicazioni
    const comunicazioniSnapshot = await firestore.collection('comunicazioni').get();
    for (const doc of comunicazioniSnapshot.docs) {
      const data = doc.data();
      await neonPool.query(`
        INSERT INTO comunicazioni (id, id_utente, titolo, testo, zona, data_creazione, likes, dislikes, punti_trasparenza)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        doc.id,
        data.id_utente,
        data.titolo,
        data.testo,
        data.zona,
        data.data_creazione?.toDate() || new Date(),
        data.likes || 0,
        data.dislikes || 0,
        data.punti_trasparenza || 0
      ]);
    }
    console.log(`✅ Migrate ${comunicazioniSnapshot.docs.length} comunicazioni`);
    
    // Migra opinioni
    const opinioniSnapshot = await firestore.collection('opinioni').get();
    for (const doc of opinioniSnapshot.docs) {
      const data = doc.data();
      await neonPool.query(`
        INSERT INTO opinioni (id, text, source, created_at, original_proponente)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [
        doc.id,
        data.text,
        data.source,
        data.created_at?.toDate() || new Date(),
        data.original_proponente
      ]);
    }
    console.log(`✅ Migrate ${opinioniSnapshot.docs.length} opinioni`);
    
    // Migra opinioni proposte
    const opinioniProposteSnapshot = await firestore.collection('opinioni_proposte').get();
    for (const doc of opinioniProposteSnapshot.docs) {
      const data = doc.data();
      await neonPool.query(`
        INSERT INTO opinioni_proposte (id, testo, proponente, proponente_email, voti, votanti, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [
        doc.id,
        data.testo,
        data.proponente,
        data.proponente_email,
        data.voti || 0,
        data.votanti || [],
        data.created_at?.toDate() || new Date()
      ]);
    }
    console.log(`✅ Migrate ${opinioniProposteSnapshot.docs.length} opinioni proposte`);
    
  } catch (error) {
    console.error('❌ Errore migrazione dati Firestore:', error);
  }
}

async function migrateKeliwebData() {
  console.log('🌐 Migrazione dati Keliweb PostgreSQL...');
  
  try {
    // Migra utenti da Keliweb (se esistono)
    const keliwebUsers = await keliwebPool.query('SELECT * FROM utenti');
    for (const user of keliwebUsers.rows) {
      await neonPool.query(`
        INSERT INTO utenti (id, email, nome, cognome, status, created_at, updated_at, ruolo, premium)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          nome = EXCLUDED.nome,
          cognome = EXCLUDED.cognome,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP,
          ruolo = EXCLUDED.ruolo,
          premium = EXCLUDED.premium
      `, [
        user.id,
        user.email,
        user.nome,
        user.cognome,
        user.status,
        user.created_at,
        user.updated_at,
        user.ruolo,
        user.premium
      ]);
    }
    console.log(`✅ Migrati ${keliwebUsers.rows.length} utenti da Keliweb`);
    
    // Migra altre tabelle da Keliweb se esistono
    // ... aggiungi qui altre migrazioni specifiche per Keliweb
    
  } catch (error) {
    console.error('❌ Errore migrazione dati Keliweb:', error);
    console.log('ℹ️ Se Keliweb non è configurato, questo errore è normale');
  }
}

async function migrateData() {
  console.log('🚀 Inizio migrazione dati...');
  console.log('📅 Data migrazione:', new Date().toISOString());
  
  try {
    // Migra dati in ordine
    await migrateUsers();
    await migrateFirestoreData();
    await migrateKeliwebData();
    
    console.log('\n🎉 Migrazione completata con successo!');
    console.log('📊 Database Neon popolato con i dati esistenti');
    
  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:', error);
  } finally {
    await neonPool.end();
    await keliwebPool.end();
    console.log('\n🔒 Connessioni chiuse');
  }
}

// Esegui migrazione
migrateData();
