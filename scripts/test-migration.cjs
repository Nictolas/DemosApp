const { Pool } = require('pg');
const admin = require('firebase-admin');
require('dotenv').config();

// Configurazione database locale (per test)
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true'
});

// Inizializza Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testMigration() {
  console.log('🧪 Test migrazione...');
  
  try {
    // Test connessione database
    const client = await pool.connect();
    console.log('✅ Connesso al database locale');
    
    // Test query semplice
    const result = await client.query('SELECT COUNT(*) as count FROM utenti');
    console.log(`📊 Utenti nel database: ${result.rows[0].count}`);
    
    client.release();
    
    // Test connessione Firestore
    const snapshot = await db.collection('utenti').limit(1).get();
    console.log(`🔥 Utenti in Firestore: ${snapshot.size} (primo documento)`);
    
    if (!snapshot.empty) {
      const firstDoc = snapshot.docs[0];
      console.log('📄 Primo documento:', firstDoc.id);
      console.log('📋 Dati:', JSON.stringify(firstDoc.data(), null, 2));
    }
    
    console.log('✅ Test completato con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testMigration();
