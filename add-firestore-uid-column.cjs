require('dotenv').config();
const { Pool } = require('pg');
const admin = require('firebase-admin');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

// Configurazione Firestore - usa direttamente il file JSON
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

async function addFirestoreUidColumn() {
  try {
    console.log('🔧 DEBUG: AGGIUNTA COLONNA FIRESTORE_UID');
    
    // 1. AGGIUNGI COLONNA FIRESTORE_UID
    console.log('🔄 Aggiunta colonna firestore_uid...');
    
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN firestore_uid TEXT UNIQUE
      `);
      console.log('✅ Colonna firestore_uid aggiunta con successo');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Colonna firestore_uid già esistente');
      } else {
        throw error;
      }
    }
    
    // 2. POPOLA LA COLONNA CON I DATI DA FIRESTORE
    console.log('🔄 Popolamento colonna con dati Firestore...');
    
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    let aggiornati = 0;
    let errori = 0;
    let nonTrovati = 0;
    
    for (const doc of utentiSnapshot.docs) {
      try {
        const utente = doc.data();
        const firestoreUid = doc.id; // ID del documento Firestore
        
        if (!utente.email) {
          console.log(`⚠️ Utente ${firestoreUid} senza email, saltato`);
          continue;
        }
        
        // Aggiorna l'utente in Neon con il firestore_uid
        const updateQuery = `
          UPDATE users 
          SET firestore_uid = $1, updated_at = NOW()
          WHERE email = $2
        `;
        
        const result = await pool.query(updateQuery, [firestoreUid, utente.email]);
        
        if (result.rowCount > 0) {
          aggiornati++;
          console.log(`✅ ${utente.nome} ${utente.cognome} (${utente.email}): firestore_uid = ${firestoreUid}`);
        } else {
          nonTrovati++;
          console.log(`⚠️ Utente non trovato: ${utente.email}`);
        }
        
      } catch (error) {
        console.error(`❌ Errore aggiornamento ${doc.id}:`, error.message);
        errori++;
      }
    }
    
    // 3. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN firestore_uid IS NOT NULL THEN 1 END) as with_firestore_uid
      FROM users
    `);
    
    const stats = finalStats.rows[0];
    console.log(`📊 Totale utenti: ${stats.total}`);
    console.log(`📊 Con firestore_uid: ${stats.with_firestore_uid}`);
    
    // 4. MOSTRA ALCUNI ESEMPI
    console.log('\n📊 ESEMPI UTENTI CON FIRESTORE_UID:');
    const sampleUsers = await pool.query(`
      SELECT id, nome, cognome, email, firestore_uid
      FROM users 
      WHERE firestore_uid IS NOT NULL
      LIMIT 5
    `);
    
    sampleUsers.rows.forEach(user => {
      console.log(`👤 ${user.nome} ${user.cognome} (${user.email})`);
      console.log(`   🔗 Neon ID: ${user.id}`);
      console.log(`   🔗 Firestore UID: ${user.firestore_uid}`);
    });
    
    console.log('\n✅ AGGIUNTA COLONNA FIRESTORE_UID COMPLETATA');
    console.log(`📊 STATISTICHE: ${aggiornati} aggiornati, ${nonTrovati} non trovati, ${errori} errori`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante aggiunta colonna:', error);
    await pool.end();
  }
}

addFirestoreUidColumn();
