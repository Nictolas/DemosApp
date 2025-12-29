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

async function migrateOpinionSources() {
  try {
    console.log('🔧 DEBUG: MIGRAZIONE FONTI OPINIONI');
    
    // 1. AGGIUNGI COLONNA SE NON ESISTE
    console.log('🔄 Aggiunta colonna fonti_opinioni...');
    
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN fonti_opinioni JSONB
      `);
      console.log('✅ Colonna fonti_opinioni aggiunta con successo');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Colonna fonti_opinioni già esistente');
      } else {
        throw error;
      }
    }
    
    // 2. PRENDI DATI DA FIRESTORE
    console.log('🔄 Recupero dati da Firestore...');
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    let aggiornati = 0;
    let errori = 0;
    let nonTrovati = 0;
    
    for (const doc of utentiSnapshot.docs) {
      try {
        const utente = doc.data();
        
        if (!utente.email || !utente.fonti_opinioni) {
          continue;
        }
        
        // Prepara i dati delle fonti
        const updateData = {
          fonti_opinioni: JSON.stringify(utente.fonti_opinioni),
          updated_at: new Date()
        };
        
        // Crea la query di UPDATE
        const updateQuery = `
          UPDATE users 
          SET fonti_opinioni = $1, updated_at = $2
          WHERE email = $3
        `;
        
        const result = await pool.query(updateQuery, [
          updateData.fonti_opinioni,
          updateData.updated_at,
          utente.email
        ]);
        
        if (result.rowCount > 0) {
          aggiornati++;
          console.log(`✅ Aggiornato utente: ${utente.nome} ${utente.cognome} (${utente.email})`);
          console.log(`   📰 Fonti: ${Object.keys(utente.fonti_opinioni).length} argomenti`);
          Object.entries(utente.fonti_opinioni).forEach(([topic, url]) => {
            console.log(`      - ${topic}: ${url.substring(0, 80)}...`);
          });
        } else {
          nonTrovati++;
          console.log(`⚠️ Utente non trovato: ${utente.email}`);
        }
        
      } catch (error) {
        console.error('❌ Errore aggiornamento utente', doc.id, ':', error.message);
        errori++;
      }
    }
    
    // 3. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN fonti_opinioni IS NOT NULL THEN 1 END) as with_fonti,
        COUNT(CASE WHEN fonti_opinioni IS NOT NULL AND jsonb_typeof(fonti_opinioni) = 'object' THEN 1 END) as with_valid_fonti
      FROM users
    `);
    
    const stats = finalStats.rows[0];
    console.log(`📊 Totale utenti: ${stats.total}`);
    console.log(`📊 Con fonti_opinioni: ${stats.with_fonti}`);
    console.log(`📊 Con fonti valide: ${stats.with_valid_fonti}`);
    
    // 4. MOSTRA ALCUNI ESEMPI MIGRATI
    console.log('\n📊 ESEMPI FONTI MIGRATE:');
    const sampleUsers = await pool.query(`
      SELECT id, name, email, nome, cognome, fonti_opinioni
      FROM users 
      WHERE fonti_opinioni IS NOT NULL
      LIMIT 3
    `);
    
    sampleUsers.rows.forEach(user => {
      console.log(`\n👤 ${user.nome} ${user.cognome} (${user.email}):`);
      // PostgreSQL restituisce già un oggetto JavaScript, non serve JSON.parse
      const fonti = user.fonti_opinioni;
      Object.entries(fonti).forEach(([topic, url]) => {
        console.log(`   📰 ${topic}: ${url.substring(0, 80)}...`);
      });
    });
    
    console.log('\n✅ MIGRAZIONE FONTI OPINIONI COMPLETATA');
    console.log(`📊 STATISTICHE: ${aggiornati} aggiornati, ${nonTrovati} non trovati, ${errori} errori`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    await pool.end();
  }
}

migrateOpinionSources();
