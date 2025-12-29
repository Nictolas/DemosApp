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

async function migrateByEmail() {
  try {
    console.log('🚀 DEBUG: MIGRAZIONE PER EMAIL - Aggiornamento dati utenti');
    
    // 1. PRENDI TUTTI I DATI DA FIRESTORE
    console.log('🔄 DEBUG: Recupero dati da Firestore...');
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    if (utentiSnapshot.empty) {
      throw new Error('Nessun utente trovato in Firestore');
    }
    
    console.log('✅ DEBUG: Trovati', utentiSnapshot.size, 'utenti in Firestore');
    
    // 2. FUNZIONE PER CONVERTIRE VALORI OPINIONI
    const convertOpinionValue = (value) => {
      if (value === true) return 'Favorevole';
      if (value === false) return 'Contrario';
      if (value === 'Indeciso' || value === 'indeciso') return 'Indeciso';
      if (value === 'Favorevole' || value === 'favorevole') return 'Favorevole';
      if (value === 'Contrario' || value === 'contrario') return 'Contrario';
      return 'Indeciso'; // Default per valori null/undefined
    };
    
    // 3. FUNZIONE PER CONVERTIRE DATE
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
    
    // 4. AGGIORNA TUTTI GLI UTENTI PER EMAIL
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
        
        // Prepara i dati da aggiornare
        const updateData = {
          // Dati personali
          nome: utente.nome || '',
          cognome: utente.cognome || '',
          password_hash: utente.password_hash || '',
          ruolo: utente.ruolo || 'Elettore',
          status: utente.status || 'pending',
          
          // Dati geografici
          regione: utente.regione || null,
          provincia: utente.provincia || null,
          comune: utente.comune || null,
          regione_residenza: utente.regione_residenza || utente.regione || null,
          provincia_residenza: utente.provincia_residenza || utente.provincia || null,
          paese_residenza: utente.paese_residenza || null,
          
          // Dati aggiuntivi
          data_nascita: convertDate(utente.data_nascita),
          genere: utente.genere || null,
          cittadinanza: utente.cittadinanza || null,
          paese_elezione: utente.paese_elezione || null,
          paese_candidatura: utente.paese_candidatura || null,
          grado_elezione: utente.grado_elezione || null,
          grado_candidatura: utente.grado_candidatura || null,
          
          // Opinioni (convertite)
          energia_nucleare: convertOpinionValue(utente.energia_nucleare),
          sperimentazione_animale: convertOpinionValue(utente.sperimentazione_animale),
          legalizzazione_canapa: convertOpinionValue(utente.legalizzazione_canapa),
          caccia: convertOpinionValue(utente.caccia),
          cittadina_animale: convertOpinionValue(utente.cittadina_animale),
          nato: convertOpinionValue(utente.nato),
          matrimonio_gay: convertOpinionValue(utente.matrimonio_gay),
          salario_minimo: convertOpinionValue(utente.salario_minimo),
          carne_coltivata: convertOpinionValue(utente.carne_coltivata),
          case_chiuse: convertOpinionValue(utente.case_chiuse),
          eutanasia: convertOpinionValue(utente.eutanasia),
          omobitransfobia: convertOpinionValue(utente.omobitransfobia),
          
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
        } else {
          nonTrovati++;
          console.log(`⚠️ Utente non trovato nel database: ${utente.email} (${utente.nome} ${utente.cognome})`);
        }
        
      } catch (error) {
        console.error('❌ Errore aggiornamento utente', doc.id, ':', error.message);
        errori++;
      }
    }
    
    // 5. VERIFICA FINALE
    const finalUsersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const usersWithOpinions = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
         OR sperimentazione_animale IS NOT NULL 
         OR legalizzazione_canapa IS NOT NULL
    `);
    
    const usersWithGeographic = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE regione IS NOT NULL 
         OR provincia IS NOT NULL 
         OR comune IS NOT NULL
    `);
    
    console.log('✅ DEBUG: MIGRAZIONE COMPLETATA');
    console.log('📊 STATISTICHE FINALI:');
    console.log(`- Firestore utenti: ${utentiSnapshot.size}`);
    console.log(`- Aggiornati: ${aggiornati}`);
    console.log(`- Non trovati: ${nonTrovati}`);
    console.log(`- Errori: ${errori}`);
    console.log(`- Users total: ${finalUsersCount.rows[0].total}`);
    console.log(`- Users con opinioni: ${usersWithOpinions.rows[0].count}`);
    console.log(`- Users con dati geografici: ${usersWithGeographic.rows[0].count}`);
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    await pool.end();
    process.exit(1);
  }
}

// Esegui la migrazione
migrateByEmail();
