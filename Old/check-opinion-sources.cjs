require('dotenv').config();
const { Pool } = require('pg');
const admin = require('firebase-admin');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

// Configurazione Firestore - usa direttamente il file JSON
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

async function checkOpinionSources() {
  try {
    console.log('🔍 DEBUG: CONTROLLO FONTI OPINIONI');
    
    // 1. CONTROLLA DATI IN FIRESTORE
    console.log('\n📊 ANALISI DATI FIRESTORE:');
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    let firestoreStats = {
      total: utentiSnapshot.size,
      withFontiOpinioni: 0,
      withFontiCount: 0
    };
    
    let fontiExamples = [];
    
    for (const doc of utentiSnapshot.docs) {
      const utente = doc.data();
      
      if (utente.fonti_opinioni) {
        firestoreStats.withFontiOpinioni++;
        
        // Conta quante fonti ha questo utente
        const fontiCount = Object.keys(utente.fonti_opinioni).length;
        firestoreStats.withFontiCount += fontiCount;
        
        // Salva alcuni esempi
        if (fontiExamples.length < 3) {
          fontiExamples.push({
            nome: utente.nome,
            cognome: utente.cognome,
            email: utente.email,
            fonti: utente.fonti_opinioni
          });
        }
      }
    }
    
    console.log(`📊 Firestore - Totale utenti: ${firestoreStats.total}`);
    console.log(`📊 Firestore - Con fonti_opinioni: ${firestoreStats.withFontiOpinioni}`);
    console.log(`📊 Firestore - Totale fonti: ${firestoreStats.withFontiCount}`);
    
    // 2. MOSTRA ESEMPI DA FIRESTORE
    console.log('\n📊 ESEMPI FONTI DA FIRESTORE:');
    fontiExamples.forEach(example => {
      console.log(`\n👤 ${example.nome} ${example.cognome} (${example.email}):`);
      Object.entries(example.fonti).forEach(([topic, url]) => {
        console.log(`   📰 ${topic}: ${url}`);
      });
    });
    
    // 3. CONTROLLA SE ESISTE IN NEON
    console.log('\n📊 CONTROLLO NEON:');
    
    // Prima controlla se la colonna esiste
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'fonti_opinioni'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ Colonna fonti_opinioni esiste in Neon');
      
      const neonStats = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN fonti_opinioni IS NOT NULL THEN 1 END) as with_fonti
        FROM users
      `);
      
      const neon = neonStats.rows[0];
      console.log(`📊 Neon - Totale utenti: ${neon.total}`);
      console.log(`📊 Neon - Con fonti_opinioni: ${neon.with_fonti}`);
      
    } else {
      console.log('❌ Colonna fonti_opinioni NON esiste in Neon');
    }
    
    await pool.end();
    console.log('\n✅ ANALISI COMPLETATA');
    
  } catch (error) {
    console.error('❌ Errore durante analisi:', error);
    await pool.end();
  }
}

checkOpinionSources();
