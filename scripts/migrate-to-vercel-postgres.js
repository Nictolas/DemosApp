#!/usr/bin/env node

/**
 * Script di Migrazione a Vercel Postgres
 * 
 * Questo script migra i dati da:
 * 1. PostgreSQL su Keliweb
 * 2. Firestore Firebase
 * 
 * A Vercel Postgres
 */

import { Pool } from 'pg';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Carica variabili d'ambiente
dotenv.config();

// Configurazione database sorgente (Keliweb)
const sourcePool = new Pool({
  user: process.env.DB_USER || 'xeadylil_Nicolas',
  password: process.env.DB_PASSWORD || 'N1Nj6tAu789',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'xeadylil_demos',
  ssl: process.env.DB_SSL === 'true' || false,
});

// Configurazione database destinazione (Vercel Postgres)
const targetPool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Configurazione Firebase Admin
let firestoreDb = null;
let firebaseAuth = null;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
  
  firestoreDb = getFirestore(app);
  firebaseAuth = getAuth(app);
  console.log('✅ Firebase Admin SDK inizializzato');
} else {
  console.log('⚠️ Firebase Admin SDK non configurato - salteremo la migrazione Firestore');
}

/**
 * Migrazione utenti da Keliweb PostgreSQL
 */
async function migrateUsersFromKeliweb() {
  console.log('\n🔄 Migrazione utenti da Keliweb PostgreSQL...');
  
  try {
    const result = await sourcePool.query('SELECT * FROM utenti');
    console.log(`📊 Trovati ${result.rows.length} utenti da migrare`);
    
    for (const user of result.rows) {
      const insertQuery = `
        INSERT INTO utenti (
          id, email, nome, cognome, status, created_at, updated_at, 
          fcm_tokens, notifiche_preferenze, avatar_config, ruolo, premium
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          nome = EXCLUDED.nome,
          cognome = EXCLUDED.cognome,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at,
          fcm_tokens = EXCLUDED.fcm_tokens,
          notifiche_preferenze = EXCLUDED.notifiche_preferenze,
          avatar_config = EXCLUDED.avatar_config,
          ruolo = EXCLUDED.ruolo,
          premium = EXCLUDED.premium
      `;
      
      await targetPool.query(insertQuery, [
        user.id, user.email, user.nome, user.cognome, user.status,
        user.created_at, user.updated_at, user.fcm_tokens,
        user.notifiche_preferenze, user.avatar_config, user.ruolo, user.premium
      ]);
    }
    
    console.log('✅ Migrazione utenti da Keliweb completata');
  } catch (error) {
    console.error('❌ Errore migrazione utenti da Keliweb:', error);
  }
}

/**
 * Migrazione utenti da Firestore
 */
async function migrateUsersFromFirestore() {
  if (!firestoreDb) {
    console.log('⏭️ Salto migrazione utenti da Firestore (Firebase non configurato)');
    return;
  }
  
  console.log('\n🔄 Migrazione utenti da Firestore...');
  
  try {
    const usersSnapshot = await firestoreDb.collection('utenti').get();
    console.log(`📊 Trovati ${usersSnapshot.size} utenti da migrare da Firestore`);
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      
      // Converti dati Firestore in formato PostgreSQL
      const insertQuery = `
        INSERT INTO utenti (
          id, email, nome, cognome, status, created_at, updated_at,
          fcm_tokens, notifiche_preferenze, avatar_config, ruolo, premium
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          nome = EXCLUDED.nome,
          cognome = EXCLUDED.cognome,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at,
          fcm_tokens = EXCLUDED.fcm_tokens,
          notifiche_preferenze = EXCLUDED.notifiche_preferenze,
          avatar_config = EXCLUDED.avatar_config,
          ruolo = EXCLUDED.ruolo,
          premium = EXCLUDED.premium
      `;
      
      await targetPool.query(insertQuery, [
        doc.id, userData.email || '', userData.nome || '', userData.cognome || '',
        userData.status || 'pending', userData.createdAt || new Date(),
        userData.updatedAt || new Date(), userData.fcmTokens || [],
        userData.notifichePreferenze || {}, userData.avatarConfig || {},
        userData.ruolo || null, userData.premium || false
      ]);
    }
    
    console.log('✅ Migrazione utenti da Firestore completata');
  } catch (error) {
    console.error('❌ Errore migrazione utenti da Firestore:', error);
  }
}

/**
 * Migrazione comunicazioni da Keliweb
 */
async function migrateCommunicationsFromKeliweb() {
  console.log('\n🔄 Migrazione comunicazioni da Keliweb...');
  
  try {
    const result = await sourcePool.query('SELECT * FROM comunicazioni');
    console.log(`📊 Trovate ${result.rows.length} comunicazioni da migrare`);
    
    for (const comm of result.rows) {
      const insertQuery = `
        INSERT INTO comunicazioni (
          id, id_utente, titolo, testo, zona, data_creazione,
          likes, dislikes, punti_trasparenza
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          id_utente = EXCLUDED.id_utente,
          titolo = EXCLUDED.titolo,
          testo = EXCLUDED.testo,
          zona = EXCLUDED.zona,
          data_creazione = EXCLUDED.data_creazione,
          likes = EXCLUDED.likes,
          dislikes = EXCLUDED.dislikes,
          punti_trasparenza = EXCLUDED.punti_trasparenza
      `;
      
      await targetPool.query(insertQuery, [
        comm.id, comm.id_utente, comm.titolo, comm.testo, comm.zona,
        comm.data_creazione, comm.likes, comm.dislikes, comm.punti_trasparenza
      ]);
    }
    
    console.log('✅ Migrazione comunicazioni da Keliweb completata');
  } catch (error) {
    console.error('❌ Errore migrazione comunicazioni da Keliweb:', error);
  }
}

/**
 * Migrazione opinioni da Keliweb
 */
async function migrateOpinionsFromKeliweb() {
  console.log('\n🔄 Migrazione opinioni da Keliweb...');
  
  try {
    const result = await sourcePool.query('SELECT * FROM opinioni');
    console.log(`📊 Trovate ${result.rows.length} opinioni da migrare`);
    
    for (const opinion of result.rows) {
      const insertQuery = `
        INSERT INTO opinioni (
          id, text, source, created_at, original_proponente
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          text = EXCLUDED.text,
          source = EXCLUDED.source,
          created_at = EXCLUDED.created_at,
          original_proponente = EXCLUDED.original_proponente
      `;
      
      await targetPool.query(insertQuery, [
        opinion.id, opinion.text, opinion.source,
        opinion.created_at, opinion.original_proponente
      ]);
    }
    
    console.log('✅ Migrazione opinioni da Keliweb completata');
  } catch (error) {
    console.error('❌ Errore migrazione opinioni da Keliweb:', error);
  }
}

/**
 * Migrazione opinioni proposte da Keliweb
 */
async function migrateProposedOpinionsFromKeliweb() {
  console.log('\n🔄 Migrazione opinioni proposte da Keliweb...');
  
  try {
    const result = await sourcePool.query('SELECT * FROM opinioni_proposte');
    console.log(`📊 Trovate ${result.rows.length} opinioni proposte da migrare`);
    
    for (const opinion of result.rows) {
      const insertQuery = `
        INSERT INTO opinioni_proposte (
          id, testo, proponente, proponente_email, voti, votanti, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          testo = EXCLUDED.testo,
          proponente = EXCLUDED.proponente,
          proponente_email = EXCLUDED.proponente_email,
          voti = EXCLUDED.voti,
          votanti = EXCLUDED.votanti,
          created_at = EXCLUDED.created_at
      `;
      
      await targetPool.query(insertQuery, [
        opinion.id, opinion.testo, opinion.proponente, opinion.proponente_email,
        opinion.voti, opinion.votanti, opinion.created_at
      ]);
    }
    
    console.log('✅ Migrazione opinioni proposte da Keliweb completata');
  } catch (error) {
    console.error('❌ Errore migrazione opinioni proposte da Keliweb:', error);
  }
}

/**
 * Migrazione voti da Keliweb
 */
async function migrateVotesFromKeliweb() {
  console.log('\n🔄 Migrazione voti da Keliweb...');
  
  try {
    // Migrazione voti capo stato
    const capoStatoResult = await sourcePool.query('SELECT * FROM voti_capo_stato');
    console.log(`📊 Trovati ${capoStatoResult.rows.length} voti capo stato da migrare`);
    
    for (const vote of capoStatoResult.rows) {
      const insertQuery = `
        INSERT INTO voti_capo_stato (id, nome, userId, timestamp)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          userId = EXCLUDED.userId,
          timestamp = EXCLUDED.timestamp
      `;
      
      await targetPool.query(insertQuery, [vote.id, vote.nome, vote.userId, vote.timestamp]);
    }
    
    // Migrazione voti referendum
    const referendumResult = await sourcePool.query('SELECT * FROM voti_referendum_abrogativi');
    console.log(`📊 Trovati ${referendumResult.rows.length} voti referendum da migrare`);
    
    for (const vote of referendumResult.rows) {
      const insertQuery = `
        INSERT INTO voti_referendum_abrogativi (id, userId, referendumId, timestamp)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          userId = EXCLUDED.userId,
          referendumId = EXCLUDED.referendumId,
          timestamp = EXCLUDED.timestamp
      `;
      
      await targetPool.query(insertQuery, [vote.id, vote.userId, vote.referendumId, vote.timestamp]);
    }
    
    console.log('✅ Migrazione voti da Keliweb completata');
  } catch (error) {
    console.error('❌ Errore migrazione voti da Keliweb:', error);
  }
}

/**
 * Migrazione richieste premium da Keliweb
 */
async function migratePremiumRequestsFromKeliweb() {
  console.log('\n🔄 Migrazione richieste premium da Keliweb...');
  
  try {
    const result = await sourcePool.query('SELECT * FROM premium_requests');
    console.log(`📊 Trovate ${result.rows.length} richieste premium da migrare`);
    
    for (const request of result.rows) {
      const insertQuery = `
        INSERT INTO premium_requests (
          id, userId, status, created_at, approved_at, rejected_at, rejection_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          userId = EXCLUDED.userId,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          approved_at = EXCLUDED.approved_at,
          rejected_at = EXCLUDED.rejected_at,
          rejection_reason = EXCLUDED.rejection_reason
      `;
      
      await targetPool.query(insertQuery, [
        request.id, request.userId, request.status, request.created_at,
        request.approved_at, request.rejected_at, request.rejection_reason
      ]);
    }
    
    console.log('✅ Migrazione richieste premium da Keliweb completata');
  } catch (error) {
    console.error('❌ Errore migrazione richieste premium da Keliweb:', error);
  }
}

/**
 * Migrazione notifiche amministrative da Keliweb
 */
async function migrateAdminNotificationsFromKeliweb() {
  console.log('\n🔄 Migrazione notifiche amministrative da Keliweb...');
  
  try {
    const result = await sourcePool.query('SELECT * FROM admin_notifications');
    console.log(`📊 Trovate ${result.rows.length} notifiche amministrative da migrare`);
    
    for (const notification of result.rows) {
      const insertQuery = `
        INSERT INTO admin_notifications (
          id, type, title, message, userData, created_at, read
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          type = EXCLUDED.type,
          title = EXCLUDED.title,
          message = EXCLUDED.message,
          userData = EXCLUDED.userData,
          created_at = EXCLUDED.created_at,
          read = EXCLUDED.read
      `;
      
      await targetPool.query(insertQuery, [
        notification.id, notification.type, notification.title,
        notification.message, notification.userData, notification.created_at, notification.read
      ]);
    }
    
    console.log('✅ Migrazione notifiche amministrative da Keliweb completata');
  } catch (error) {
    console.error('❌ Errore migrazione notifiche amministrative da Keliweb:', error);
  }
}

/**
 * Funzione principale di migrazione
 */
async function migrateAllData() {
  console.log('🚀 Inizio migrazione dati a Vercel Postgres...');
  console.log('📅 Data migrazione:', new Date().toISOString());
  
  try {
    // Test connessioni
    console.log('\n🔍 Test connessioni database...');
    
    await sourcePool.query('SELECT 1');
    console.log('✅ Connessione database sorgente (Keliweb) OK');
    
    await targetPool.query('SELECT 1');
    console.log('✅ Connessione database destinazione (Vercel Postgres) OK');
    
    // Esegui migrazioni
    await migrateUsersFromKeliweb();
    await migrateUsersFromFirestore();
    await migrateCommunicationsFromKeliweb();
    await migrateOpinionsFromKeliweb();
    await migrateProposedOpinionsFromKeliweb();
    await migrateVotesFromKeliweb();
    await migratePremiumRequestsFromKeliweb();
    await migrateAdminNotificationsFromKeliweb();
    
    console.log('\n🎉 Migrazione completata con successo!');
    console.log('📊 Tutti i dati sono stati migrati a Vercel Postgres');
    
  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:', error);
    process.exit(1);
  } finally {
    // Chiudi connessioni
    await sourcePool.end();
    await targetPool.end();
    console.log('\n🔒 Connessioni database chiuse');
  }
}

/**
 * Funzione per creare backup prima della migrazione
 */
async function createBackup() {
  console.log('\n💾 Creazione backup prima della migrazione...');
  
  try {
    const backupDir = './backups';
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);
    
    // Esporta schema e dati
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const pgDumpCommand = `pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} > ${backupFile}`;
    
    await execAsync(pgDumpCommand, {
      env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
    });
    
    console.log(`✅ Backup creato: ${backupFile}`);
  } catch (error) {
    console.error('❌ Errore creazione backup:', error);
    console.log('⚠️ Continuo senza backup...');
  }
}

// Esegui migrazione se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--backup')) {
    createBackup().then(() => migrateAllData());
  } else {
    migrateAllData();
  }
}

export {
  migrateAllData,
  createBackup,
  migrateUsersFromKeliweb,
  migrateUsersFromFirestore,
  migrateCommunicationsFromKeliweb,
  migrateOpinionsFromKeliweb,
  migrateProposedOpinionsFromKeliweb,
  migrateVotesFromKeliweb,
  migratePremiumRequestsFromKeliweb,
  migrateAdminNotificationsFromKeliweb
};
