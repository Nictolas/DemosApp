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

async function fixMissingData() {
  try {
    console.log('🔧 DEBUG: CORREZIONE DATI MANCANTI');
    
    // 1. PRENDI TUTTI I DATI DA FIRESTORE
    console.log('🔄 DEBUG: Recupero dati da Firestore...');
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    if (utentiSnapshot.empty) {
      throw new Error('Nessun utente trovato in Firestore');
    }
    
    console.log('✅ DEBUG: Trovati', utentiSnapshot.size, 'utenti in Firestore');
    
    // 2. FUNZIONE PER CONVERTIRE DATE
    const convertDate = (dateValue) => {
      if (!dateValue) return null;
      
      try {
        // Se è già una data valida
        if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
          return dateValue;
        }
        
        // Se è una stringa, prova a convertirla
        if (typeof dateValue === 'string') {
          const parsed = new Date(dateValue);
          if (!isNaN(parsed.getTime())) {
            return parsed;
          }
        }
        
        // Se è un timestamp Firestore
        if (dateValue && dateValue.toDate) {
          return dateValue.toDate();
        }
        
        return null;
      } catch (error) {
        console.log(`⚠️ Errore conversione data: ${dateValue}`, error.message);
        return null;
      }
    };
    
    // 3. AGGIORNA I DATI MANCANTI
    let aggiornati = 0;
    let errori = 0;
    let nonTrovati = 0;
    
    for (const doc of utentiSnapshot.docs) {
      try {
        const utente = doc.data();
        
        if (!utente.email) {
          console.log(`⚠️ Utente ${doc.id} senza email, saltato`);
          continue;
        }
        
        // Prepara i dati mancanti da aggiornare
        const updateData = {
          // Dati geografici di residenza (mancanti)
          comune_residenza: utente.comune_residenza || null,
          
          // Dati personali (mancanti o da correggere)
          data_nascita: convertDate(utente.data_nascita),
          
          // Aggiorna timestamp
          updated_at: new Date()
        };
        
        // Crea la query di UPDATE dinamica usando email
        const updateFields = Object.keys(updateData).map(key => `${key} = $${Object.keys(updateData).indexOf(key) + 1}`).join(', ');
        const updateValues = Object.values(updateData);
        
        const updateQuery = `
          UPDATE users 
          SET ${updateFields}
          WHERE email = $${updateValues.length + 1}
        `;
        
        const result = await pool.query(updateQuery, [...updateValues, utente.email]);
        
        if (result.rowCount > 0) {
          aggiornati++;
          console.log(`✅ Aggiornato utente: ${utente.nome} ${utente.cognome} (${utente.email})`);
          console.log(`   🏠 Comune Residenza: ${utente.comune_residenza || 'N/A'}`);
          console.log(`   📅 Data Nascita: ${utente.data_nascita || 'N/A'}`);
        } else {
          nonTrovati++;
          console.log(`⚠️ Utente non trovato nel database: ${utente.email} (${utente.nome} ${utente.cognome})`);
        }
        
      } catch (error) {
        console.error('❌ Errore aggiornamento utente', doc.id, ':', error.message);
        errori++;
      }
    }
    
    // 4. VERIFICA FINALE
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN comune_residenza IS NOT NULL THEN 1 END) as with_comune_residenza,
        COUNT(CASE WHEN data_nascita IS NOT NULL THEN 1 END) as with_data_nascita
      FROM users
    `);
    
    console.log('✅ DEBUG: CORREZIONE COMPLETATA');
    console.log('📊 STATISTICHE FINALI:');
    console.log(`- Firestore utenti: ${utentiSnapshot.size}`);
    console.log(`- Aggiornati: ${aggiornati}`);
    console.log(`- Non trovati: ${nonTrovati}`);
    console.log(`- Errori: ${errori}`);
    console.log(`- Users total: ${finalStats.rows[0].total}`);
    console.log(`- Users con comune_residenza: ${finalStats.rows[0].with_comune_residenza}`);
    console.log(`- Users con data_nascita: ${finalStats.rows[0].with_data_nascita}`);
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Errore durante correzione:', error);
    await pool.end();
    process.exit(1);
  }
}

// Esegui la correzione
fixMissingData();
