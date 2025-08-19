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

async function checkMissingData() {
  try {
    console.log('🔍 DEBUG: CONTROLLO DATI MANCANTI');
    
    // 1. CONTROLLA DATI IN FIRESTORE
    console.log('\n📊 ANALISI DATI FIRESTORE:');
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    let firestoreStats = {
      total: utentiSnapshot.size,
      withEmail: 0,
      withNome: 0,
      withCognome: 0,
      withRegione: 0,
      withProvincia: 0,
      withComune: 0,
      withRegioneResidenza: 0,
      withProvinciaResidenza: 0,
      withComuneResidenza: 0,
      withPaeseResidenza: 0,
      withDataNascita: 0,
      withGenere: 0,
      withCittadinanza: 0,
      withOpinions: 0
    };
    
    for (const doc of utentiSnapshot.docs) {
      const utente = doc.data();
      
      if (utente.email) firestoreStats.withEmail++;
      if (utente.nome) firestoreStats.withNome++;
      if (utente.cognome) firestoreStats.withCognome++;
      if (utente.regione) firestoreStats.withRegione++;
      if (utente.provincia) firestoreStats.withProvincia++;
      if (utente.comune) firestoreStats.withComune++;
      if (utente.regione_residenza) firestoreStats.withRegioneResidenza++;
      if (utente.provincia_residenza) firestoreStats.withProvinciaResidenza++;
      if (utente.comune_residenza) firestoreStats.withComuneResidenza++;
      if (utente.paese_residenza) firestoreStats.withPaeseResidenza++;
      if (utente.data_nascita) firestoreStats.withDataNascita++;
      if (utente.genere) firestoreStats.withGenere++;
      if (utente.cittadinanza) firestoreStats.withCittadinanza++;
      
      // Controlla se ha almeno un'opinione
      if (utente.energia_nucleare !== undefined || utente.sperimentazione_animale !== undefined || 
          utente.legalizzazione_canapa !== undefined || utente.caccia !== undefined) {
        firestoreStats.withOpinions++;
      }
    }
    
    console.log(`📊 Firestore - Totale utenti: ${firestoreStats.total}`);
    console.log(`📊 Firestore - Con email: ${firestoreStats.withEmail}`);
    console.log(`📊 Firestore - Con nome: ${firestoreStats.withNome}`);
    console.log(`📊 Firestore - Con cognome: ${firestoreStats.withCognome}`);
    console.log(`📊 Firestore - Con regione: ${firestoreStats.withRegione}`);
    console.log(`📊 Firestore - Con provincia: ${firestoreStats.withProvincia}`);
    console.log(`📊 Firestore - Con comune: ${firestoreStats.withComune}`);
    console.log(`📊 Firestore - Con regione_residenza: ${firestoreStats.withRegioneResidenza}`);
    console.log(`📊 Firestore - Con provincia_residenza: ${firestoreStats.withProvinciaResidenza}`);
    console.log(`📊 Firestore - Con comune_residenza: ${firestoreStats.withComuneResidenza}`);
    console.log(`📊 Firestore - Con paese_residenza: ${firestoreStats.withPaeseResidenza}`);
    console.log(`📊 Firestore - Con data_nascita: ${firestoreStats.withDataNascita}`);
    console.log(`📊 Firestore - Con genere: ${firestoreStats.withGenere}`);
    console.log(`📊 Firestore - Con cittadinanza: ${firestoreStats.withCittadinanza}`);
    console.log(`📊 Firestore - Con opinioni: ${firestoreStats.withOpinions}`);
    
    // 2. CONTROLLA DATI IN NEON
    console.log('\n📊 ANALISI DATI NEON:');
    const neonStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email,
        COUNT(CASE WHEN nome IS NOT NULL AND nome != '' THEN 1 END) as with_nome,
        COUNT(CASE WHEN cognome IS NOT NULL AND cognome != '' THEN 1 END) as with_cognome,
        COUNT(CASE WHEN regione IS NOT NULL THEN 1 END) as with_regione,
        COUNT(CASE WHEN provincia IS NOT NULL THEN 1 END) as with_provincia,
        COUNT(CASE WHEN comune IS NOT NULL THEN 1 END) as with_comune,
        COUNT(CASE WHEN regione_residenza IS NOT NULL THEN 1 END) as with_regione_residenza,
        COUNT(CASE WHEN provincia_residenza IS NOT NULL THEN 1 END) as with_provincia_residenza,
        COUNT(CASE WHEN comune_residenza IS NOT NULL THEN 1 END) as with_comune_residenza,
        COUNT(CASE WHEN paese_residenza IS NOT NULL THEN 1 END) as with_paese_residenza,
        COUNT(CASE WHEN data_nascita IS NOT NULL THEN 1 END) as with_data_nascita,
        COUNT(CASE WHEN genere IS NOT NULL THEN 1 END) as with_genere,
        COUNT(CASE WHEN cittadinanza IS NOT NULL THEN 1 END) as with_cittadinanza,
        COUNT(CASE WHEN energia_nucleare IS NOT NULL THEN 1 END) as with_opinions
      FROM users
    `);
    
    const neon = neonStats.rows[0];
    console.log(`📊 Neon - Totale utenti: ${neon.total}`);
    console.log(`📊 Neon - Con email: ${neon.with_email}`);
    console.log(`📊 Neon - Con nome: ${neon.with_nome}`);
    console.log(`📊 Neon - Con cognome: ${neon.with_cognome}`);
    console.log(`📊 Neon - Con regione: ${neon.with_regione}`);
    console.log(`📊 Neon - Con provincia: ${neon.with_provincia}`);
    console.log(`📊 Neon - Con comune: ${neon.with_comune}`);
    console.log(`📊 Neon - Con regione_residenza: ${neon.with_regione_residenza}`);
    console.log(`📊 Neon - Con provincia_residenza: ${neon.with_provincia_residenza}`);
    console.log(`📊 Neon - Con comune_residenza: ${neon.with_comune_residenza}`);
    console.log(`📊 Neon - Con paese_residenza: ${neon.with_paese_residenza}`);
    console.log(`📊 Neon - Con data_nascita: ${neon.with_data_nascita}`);
    console.log(`📊 Neon - Con genere: ${neon.with_genere}`);
    console.log(`📊 Neon - Con cittadinanza: ${neon.with_cittadinanza}`);
    console.log(`📊 Neon - Con opinioni: ${neon.with_opinions}`);
    
    // 3. CONTROLLA ALCUNI ESEMPI SPECIFICI
    console.log('\n📊 ESEMPI SPECIFICI DA FIRESTORE:');
    const sampleDocs = utentiSnapshot.docs.slice(0, 3);
    
    for (const doc of sampleDocs) {
      const utente = doc.data();
      console.log(`\n👤 ${utente.nome} ${utente.cognome} (${utente.email}):`);
      console.log(`   📍 Regione: ${utente.regione || 'N/A'}`);
      console.log(`   📍 Provincia: ${utente.provincia || 'N/A'}`);
      console.log(`   📍 Comune: ${utente.comune || 'N/A'}`);
      console.log(`   🏠 Regione Residenza: ${utente.regione_residenza || 'N/A'}`);
      console.log(`   🏠 Provincia Residenza: ${utente.provincia_residenza || 'N/A'}`);
      console.log(`   🏠 Comune Residenza: ${utente.comune_residenza || 'N/A'}`);
      console.log(`   🏠 Paese Residenza: ${utente.paese_residenza || 'N/A'}`);
      console.log(`   📅 Data Nascita: ${utente.data_nascita || 'N/A'}`);
      console.log(`   👤 Genere: ${utente.genere || 'N/A'}`);
      console.log(`   🏛️ Cittadinanza: ${utente.cittadinanza || 'N/A'}`);
    }
    
    await pool.end();
    console.log('\n✅ ANALISI COMPLETATA');
    
  } catch (error) {
    console.error('❌ Errore durante analisi:', error);
    await pool.end();
  }
}

checkMissingData();
