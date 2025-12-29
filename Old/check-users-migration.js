#!/usr/bin/env node

/**
 * VERIFICA MIGRAZIONE UTENTI
 * Confronta i dati tra Firestore "utenti" e Neon "users"
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

console.log('🔍 VERIFICA MIGRAZIONE UTENTI');
console.log('============================');

async function checkUsersMigration() {
  try {
    // 1. Conta utenti in Firestore
    console.log('\n📊 CONTEGGIO UTENTI:');
    console.log('====================');
    
    const firestoreSnapshot = await firestore.collection('utenti').get();
    const firestoreCount = firestoreSnapshot.size;
    console.log(`🔥 Firestore "utenti": ${firestoreCount} documenti`);
    
    // 2. Conta utenti in Neon
    const neonResult = await pool.query('SELECT COUNT(*) FROM users');
    const neonCount = parseInt(neonResult.rows[0].count);
    console.log(`💾 Neon "users": ${neonCount} record`);
    
    // 3. Conta anche nella tabella utenti (legacy)
    const utentiResult = await pool.query('SELECT COUNT(*) FROM utenti');
    const utentiCount = parseInt(utentiResult.rows[0].count);
    console.log(`💾 Neon "utenti" (legacy): ${utentiCount} record`);
    
    console.log(`\n📈 DIFFERENZA: ${firestoreCount - neonCount} utenti mancanti in Neon`);
    
    // 4. Analizza alcuni esempi di utenti in Firestore
    console.log('\n📋 ESEMPI UTENTI IN FIRESTORE:');
    console.log('===============================');
    
    const sampleDocs = firestoreSnapshot.docs.slice(0, 5);
    for (const doc of sampleDocs) {
      const data = doc.data();
      console.log(`\n👤 ID: ${doc.id}`);
      console.log(`   📧 Email: ${data.email || 'N/A'}`);
      console.log(`   👤 Nome: ${data.nome || 'N/A'}`);
      console.log(`   👤 Cognome: ${data.cognome || 'N/A'}`);
      console.log(`   🏷️ Ruolo: ${data.ruolo || 'N/A'}`);
      console.log(`   📅 Created: ${data.created_at || data.createdAt || 'N/A'}`);
      console.log(`   🔑 Password Hash: ${data.password_hash ? 'Presente' : 'Mancante'}`);
    }
    
    // 5. Verifica se questi utenti esistono in Neon
    console.log('\n🔍 VERIFICA ESISTENZA IN NEON:');
    console.log('===============================');
    
    for (const doc of sampleDocs) {
      const data = doc.data();
      const email = data.email;
      
      if (email) {
        // Cerca in users
        const userResult = await pool.query('SELECT id, email, nome, cognome, ruolo FROM users WHERE email = $1', [email]);
        const utenteResult = await pool.query('SELECT id, email, nome, cognome, ruolo FROM utenti WHERE email = $1', [email]);
        
        console.log(`\n📧 Email: ${email}`);
        console.log(`   💾 In "users": ${userResult.rows.length > 0 ? '✅ Trovato' : '❌ Non trovato'}`);
        console.log(`   💾 In "utenti": ${utenteResult.rows.length > 0 ? '✅ Trovato' : '❌ Non trovato'}`);
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          console.log(`   👤 Dati Neon: ${user.nome} ${user.cognome} (${user.ruolo})`);
        }
      }
    }
    
    // 6. Trova utenti mancanti
    console.log('\n❌ UTENTI MANCANTI IN NEON:');
    console.log('============================');
    
    let missingCount = 0;
    for (const doc of firestoreSnapshot.docs) {
      const data = doc.data();
      const email = data.email;
      
      if (email) {
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        const utenteResult = await pool.query('SELECT id FROM utenti WHERE email = $1', [email]);
        
        if (userResult.rows.length === 0 && utenteResult.rows.length === 0) {
          console.log(`❌ ${email} (${data.nome} ${data.cognome}) - Non trovato in Neon`);
          missingCount++;
          
          if (missingCount >= 10) {
            console.log('... (mostrando solo i primi 10)');
            break;
          }
        }
      }
    }
    
    console.log(`\n📊 TOTALE UTENTI MANCANTI: ${missingCount} (su ${firestoreCount})`);
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
  } finally {
    await pool.end();
    console.log('\n🔚 Connessione database chiusa');
  }
}

checkUsersMigration();
