const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
const { Pool } = require('pg');
require('dotenv').config();

// Configurazione Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Configurazione Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateRappresentanti() {
  try {
    console.log('🚀 Inizio migrazione rappresentanti e candidati da Firestore a Neon...');
    
    // 1. Aggiungi le colonne mancanti se non esistono
    console.log('🔧 Aggiunta colonne candidati se non esistono...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS candidato_europeo TEXT,
      ADD COLUMN IF NOT EXISTS candidato_camera TEXT,
      ADD COLUMN IF NOT EXISTS candidato_senato TEXT,
      ADD COLUMN IF NOT EXISTS candidato_regionale TEXT,
      ADD COLUMN IF NOT EXISTS candidato_comune TEXT
    `);
    console.log('✅ Colonne candidati aggiunte/verificate');
    
    // 2. Ottieni tutti gli utenti da Firestore
    console.log('📋 Recupero utenti da Firestore...');
    const utentiSnapshot = await getDocs(collection(db, 'utenti'));
    console.log(`✅ Trovati ${utentiSnapshot.size} utenti in Firestore`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    // 3. Per ogni utente, aggiorna rappresentanti e candidati in Neon
    for (const utenteDoc of utentiSnapshot.docs) {
      try {
        const utenteData = utenteDoc.data();
        const firestoreUid = utenteDoc.id;
        
        // Estrai i dati dei rappresentanti
        const rappresentanti = {
          rappresentante_europeo: utenteData.rappresentante_europeo || null,
          rappresentante_camera: utenteData.rappresentante_camera || null,
          rappresentante_senato: utenteData.rappresentante_senato || null,
          rappresentante_regionale: utenteData.rappresentante_regionale || null,
          rappresentante_comune: utenteData.rappresentante_comune || null
        };
        
        // Estrai i dati dei candidati
        const candidati = {
          candidato_europeo: utenteData.candidato_europeo || null,
          candidato_camera: utenteData.candidato_camera || null,
          candidato_senato: utenteData.candidato_senato || null,
          candidato_regionale: utenteData.candidato_regionale || null,
          candidato_comune: utenteData.candidato_comune || null
        };
        
        // Verifica se ci sono dati da migrare
        const hasRappresentanti = Object.values(rappresentanti).some(val => val !== null);
        const hasCandidati = Object.values(candidati).some(val => val !== null);
        
        if (hasRappresentanti || hasCandidati) {
          console.log(`👤 Migrazione per utente ${firestoreUid}:`);
          if (hasRappresentanti) console.log('  📊 Rappresentanti:', rappresentanti);
          if (hasCandidati) console.log('  🗳️ Candidati:', candidati);
          
          // Aggiorna la tabella users in Neon
          const updateQuery = `
            UPDATE users 
            SET 
              rappresentante_europeo = $1,
              rappresentante_camera = $2,
              rappresentante_senato = $3,
              rappresentante_regionale = $4,
              rappresentante_comune = $5,
              candidato_europeo = $6,
              candidato_camera = $7,
              candidato_senato = $8,
              candidato_regionale = $9,
              candidato_comune = $10,
              updated_at = NOW()
            WHERE firestore_uid = $11
          `;
          
          await pool.query(updateQuery, [
            rappresentanti.rappresentante_europeo,
            rappresentanti.rappresentante_camera,
            rappresentanti.rappresentante_senato,
            rappresentanti.rappresentante_regionale,
            rappresentanti.rappresentante_comune,
            candidati.candidato_europeo,
            candidati.candidato_camera,
            candidati.candidato_senato,
            candidati.candidato_regionale,
            candidati.candidato_comune,
            firestoreUid
          ]);
          
          migratedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Errore nella migrazione dell'utente ${utenteDoc.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Migrazione completata!`);
    console.log(`✅ Utenti migrati con successo: ${migratedCount}`);
    console.log(`❌ Errori: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Errore generale nella migrazione:', error);
  } finally {
    await pool.end();
  }
}

// Esegui la migrazione
migrateRappresentanti();
