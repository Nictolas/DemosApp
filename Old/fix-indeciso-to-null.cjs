const { Pool } = require('pg');
const admin = require('firebase-admin');

// Configurazione database
require('dotenv').config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Configurazione Firebase
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Campi delle opinioni da controllare
const OPINION_FIELDS = [
  'caccia',
  'carne_coltivata', 
  'case_chiuse',
  'cittadina_animale',
  'eutanasia',
  'legalizzazione_canapa',
  'matrimonio_gay',
  'nato',
  'omobitransfobia',
  'salario_minimo',
  'sperimentazione_animale'
];

async function fixIndecisoToNull() {
  console.log('🔍 Iniziando correzione Indeciso -> null...');
  
  try {
    // 1. Leggi tutti gli utenti da Firestore
    console.log('📖 Leggendo utenti da Firestore...');
    const firestoreSnapshot = await db.collection('utenti').get();
    const firestoreUsers = {};
    
    firestoreSnapshot.forEach(doc => {
      const data = doc.data();
      firestoreUsers[doc.id] = data;
    });
    
    console.log(`✅ Trovati ${Object.keys(firestoreUsers).length} utenti su Firestore`);
    
    // 2. Leggi tutti gli utenti da Neon
    console.log('📖 Leggendo utenti da Neon...');
    const neonResult = await pool.query('SELECT id, email, ' + OPINION_FIELDS.join(', ') + ' FROM users');
    const neonUsers = neonResult.rows;
    
    console.log(`✅ Trovati ${neonUsers.length} utenti su Neon`);
    
    // 3. Confronta e trova le differenze
    let corrections = 0;
    let totalChecks = 0;
    
    for (const neonUser of neonUsers) {
      const firestoreUser = Object.values(firestoreUsers).find(u => u.email === neonUser.email);
      
      if (!firestoreUser) {
        console.log(`⚠️ Utente ${neonUser.email} non trovato su Firestore`);
        continue;
      }
      
      totalChecks++;
      
      // Controlla ogni campo opinione
      for (const field of OPINION_FIELDS) {
        const firestoreValue = firestoreUser[field];
        const neonValue = neonUser[field];
        
        // Se Firestore ha null e Neon ha "Indeciso", correggi
        if (firestoreValue === null && neonValue === 'Indeciso') {
          console.log(`🔄 Correggendo ${neonUser.email}.${field}: "Indeciso" -> null`);
          
          await pool.query(
            `UPDATE users SET ${field} = NULL WHERE id = $1`,
            [neonUser.id]
          );
          
          corrections++;
        }
      }
    }
    
    console.log('\n📊 RIEPILOGO:');
    console.log(`✅ Controlli effettuati: ${totalChecks}`);
    console.log(`🔄 Correzioni applicate: ${corrections}`);
    console.log('✅ Correzione completata!');
    
  } catch (error) {
    console.error('❌ Errore durante la correzione:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Esegui la correzione
fixIndecisoToNull();
