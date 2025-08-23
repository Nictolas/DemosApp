require('dotenv').config();
const { Pool } = require('pg');
const admin = require('firebase-admin');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configurazione Firestore
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

async function checkMigrationStatus() {
  try {
    console.log('🔍 VERIFICA STATO MIGRAZIONE INIZIATIVE POPOLARI');
    console.log('=' .repeat(60));
    
    // 1. Conta record in Firestore
    console.log('📊 Controllo Firestore...');
    const firestoreSnapshot = await firestore.collection('iniziative_popolari').get();
    const firestoreCount = firestoreSnapshot.size;
    console.log(`✅ Firestore: ${firestoreCount} iniziative`);
    
    // 2. Conta record in Neon
    console.log('📊 Controllo Neon...');
    const neonResult = await pool.query('SELECT COUNT(*) FROM iniziative_popolari');
    const neonCount = parseInt(neonResult.rows[0].count);
    console.log(`✅ Neon: ${neonCount} iniziative`);
    
    // 3. Confronta
    console.log('\n📈 STATISTICHE MIGRAZIONE:');
    if (firestoreCount === neonCount) {
      console.log('🎉 MIGRAZIONE COMPLETATA! Tutte le iniziative sono state migrate.');
    } else if (firestoreCount > neonCount) {
      console.log(`⚠️ MIGRAZIONE INCOMPLETA: Mancano ${firestoreCount - neonCount} iniziative`);
    } else {
      console.log(`⚠️ ANOMALIA: Neon ha più record di Firestore (${neonCount - firestoreCount} in più)`);
    }
    
    // 4. Mostra dettagli Firestore
    console.log('\n📋 DETTAGLI FIRESTORE:');
    const firestoreIds = [];
    firestoreSnapshot.forEach(doc => {
      firestoreIds.push(doc.id);
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.nome || 'Nome mancante'} (${data.userId || 'No userId'})`);
    });
    
    // 5. Mostra dettagli Neon
    console.log('\n📋 DETTAGLI NEON:');
    const neonResult2 = await pool.query('SELECT firestoreid, nome, userid FROM iniziative_popolari');
    neonResult2.rows.forEach(row => {
      console.log(`  - ${row.firestoreid}: ${row.nome || 'Nome mancante'} (${row.userid || 'No userId'})`);
    });
    
    // 6. Trova iniziative mancanti
    if (firestoreCount > neonCount) {
      console.log('\n🔍 INIZIATIVE MANCANTI IN NEON:');
      const neonFirestoreIds = neonResult2.rows.map(row => row.firestoreid);
      const missingIds = firestoreIds.filter(id => !neonFirestoreIds.includes(id));
      
      missingIds.forEach(id => {
        const doc = firestoreSnapshot.docs.find(d => d.id === id);
        if (doc) {
          const data = doc.data();
          console.log(`  ❌ ${id}: ${data.nome || 'Nome mancante'}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkMigrationStatus();
