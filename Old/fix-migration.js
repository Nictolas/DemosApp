#!/usr/bin/env node

/**
 * Completa migrazione dati correggendo problemi
 */

import { Pool } from 'pg';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Configurazione database Neon
const neonPool = new Pool({
  connectionString: 'postgres://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
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

async function migrateOpinioni() {
  console.log('🔥 Migrazione opinioni con correzioni...');
  
  try {
    const opinioniSnapshot = await firestore.collection('opinioni').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of opinioniSnapshot.docs) {
      const data = doc.data();
      
      // Verifica che i campi obbligatori esistano
      if (!data.text) {
        console.log(`⚠️ Skippata opinione ${doc.id}: campo 'text' mancante`);
        skipped++;
        continue;
      }
      
      // Usa un valore di default per source se mancante
      const source = data.source || 'unknown';
      
      try {
        await neonPool.query(`
          INSERT INTO opinioni (id, text, source, created_at, original_proponente)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [
          doc.id,
          data.text,
          source,
          data.created_at?.toDate() || new Date(),
          data.original_proponente || null
        ]);
        migrated++;
      } catch (error) {
        console.error(`❌ Errore inserimento opinione ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Migrate ${migrated} opinioni, skippate ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore migrazione opinioni:', error);
  }
}

async function migrateOpinioniProposte() {
  console.log('📝 Migrazione opinioni proposte...');
  
  try {
    const opinioniProposteSnapshot = await firestore.collection('opinioni_proposte').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of opinioniProposteSnapshot.docs) {
      const data = doc.data();
      
      // Verifica campi obbligatori
      if (!data.testo || !data.proponente || !data.proponente_email) {
        console.log(`⚠️ Skippata opinione proposta ${doc.id}: campi obbligatori mancanti`);
        skipped++;
        continue;
      }
      
      try {
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
        migrated++;
      } catch (error) {
        console.error(`❌ Errore inserimento opinione proposta ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Migrate ${migrated} opinioni proposte, skippate ${skipped}`);
    
  } catch (error) {
    console.error('❌ Errore migrazione opinioni proposte:', error);
  }
}

async function checkMigrationStatus() {
  console.log('📊 Stato migrazione...');
  
  try {
    const utentiCount = await neonPool.query('SELECT COUNT(*) as count FROM utenti');
    const comunicazioniCount = await neonPool.query('SELECT COUNT(*) as count FROM comunicazioni');
    const opinioniCount = await neonPool.query('SELECT COUNT(*) as count FROM opinioni');
    const opinioniProposteCount = await neonPool.query('SELECT COUNT(*) as count FROM opinioni_proposte');
    
    console.log(`👥 Utenti: ${utentiCount.rows[0].count}`);
    console.log(`💬 Comunicazioni: ${comunicazioniCount.rows[0].count}`);
    console.log(`💭 Opinion: ${opinioniCount.rows[0].count}`);
    console.log(`📝 Opinion proposte: ${opinioniProposteCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Errore verifica stato:', error);
  }
}

async function completeMigration() {
  console.log('🚀 Completamento migrazione...');
  console.log('📅 Data operazione:', new Date().toISOString());
  
  try {
    await migrateOpinioni();
    await migrateOpinioniProposte();
    await checkMigrationStatus();
    
    console.log('\n🎉 Migrazione completata con successo!');
    console.log('📊 Database Neon popolato con tutti i dati esistenti');
    
  } catch (error) {
    console.error('\n❌ Errore durante il completamento:', error);
  } finally {
    await neonPool.end();
    console.log('\n🔒 Connessione chiusa');
  }
}

// Esegui completamento migrazione
completeMigration();
