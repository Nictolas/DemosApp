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

async function checkElectionData() {
  try {
    console.log('🔍 DEBUG: CONTROLLO DATI ELEZIONE MANCANTI');
    
    // 1. CONTROLLA DATI IN FIRESTORE
    console.log('\n📊 ANALISI DATI FIRESTORE:');
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    let firestoreStats = {
      total: utentiSnapshot.size,
      withGradoElezione: 0,
      withPaeseElezione: 0,
      withGradoCandidatura: 0,
      withPaeseCandidatura: 0,
      withRegione: 0,
      withProvincia: 0,
      withComune: 0
    };
    
    for (const doc of utentiSnapshot.docs) {
      const utente = doc.data();
      
      if (utente.grado_elezione) firestoreStats.withGradoElezione++;
      if (utente.paese_elezione) firestoreStats.withPaeseElezione++;
      if (utente.grado_candidatura) firestoreStats.withGradoCandidatura++;
      if (utente.paese_candidatura) firestoreStats.withPaeseCandidatura++;
      if (utente.regione) firestoreStats.withRegione++;
      if (utente.provincia) firestoreStats.withProvincia++;
      if (utente.comune) firestoreStats.withComune++;
    }
    
    console.log(`📊 Firestore - Totale utenti: ${firestoreStats.total}`);
    console.log(`📊 Firestore - Con grado_elezione: ${firestoreStats.withGradoElezione}`);
    console.log(`📊 Firestore - Con paese_elezione: ${firestoreStats.withPaeseElezione}`);
    console.log(`📊 Firestore - Con grado_candidatura: ${firestoreStats.withGradoCandidatura}`);
    console.log(`📊 Firestore - Con paese_candidatura: ${firestoreStats.withPaeseCandidatura}`);
    console.log(`📊 Firestore - Con regione: ${firestoreStats.withRegione}`);
    console.log(`📊 Firestore - Con provincia: ${firestoreStats.withProvincia}`);
    console.log(`📊 Firestore - Con comune: ${firestoreStats.withComune}`);
    
    // 2. CONTROLLA DATI IN NEON
    console.log('\n📊 ANALISI DATI NEON:');
    const neonStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN grado_elezione IS NOT NULL THEN 1 END) as with_grado_elezione,
        COUNT(CASE WHEN paese_elezione IS NOT NULL THEN 1 END) as with_paese_elezione,
        COUNT(CASE WHEN grado_candidatura IS NOT NULL THEN 1 END) as with_grado_candidatura,
        COUNT(CASE WHEN paese_candidatura IS NOT NULL THEN 1 END) as with_paese_candidatura,
        COUNT(CASE WHEN regione IS NOT NULL THEN 1 END) as with_regione,
        COUNT(CASE WHEN provincia IS NOT NULL THEN 1 END) as with_provincia,
        COUNT(CASE WHEN comune IS NOT NULL THEN 1 END) as with_comune
      FROM users
    `);
    
    const neon = neonStats.rows[0];
    console.log(`📊 Neon - Totale utenti: ${neon.total}`);
    console.log(`📊 Neon - Con grado_elezione: ${neon.with_grado_elezione}`);
    console.log(`📊 Neon - Con paese_elezione: ${neon.with_paese_elezione}`);
    console.log(`📊 Neon - Con grado_candidatura: ${neon.with_grado_candidatura}`);
    console.log(`📊 Neon - Con paese_candidatura: ${neon.with_paese_candidatura}`);
    console.log(`📊 Neon - Con regione: ${neon.with_regione}`);
    console.log(`📊 Neon - Con provincia: ${neon.with_provincia}`);
    console.log(`📊 Neon - Con comune: ${neon.with_comune}`);
    
    // 3. CONTROLLA UTENTI CON GRADO ELEZIONE MA SENZA DATI GEOGRAFICI
    console.log('\n📊 UTENTI CON GRADO ELEZIONE MA SENZA DATI GEOGRAFICI:');
    const usersWithElectionButNoGeo = await pool.query(`
      SELECT id, name, email, nome, cognome, 
             grado_elezione, paese_elezione, grado_candidatura, paese_candidatura,
             regione, provincia, comune
      FROM users 
      WHERE grado_elezione IS NOT NULL 
        AND (regione IS NULL OR provincia IS NULL OR comune IS NULL)
      LIMIT 10
    `);
    
    usersWithElectionButNoGeo.rows.forEach(user => {
      console.log(`\n👤 ${user.nome} ${user.cognome} (${user.email}):`);
      console.log(`   🏛️ Grado Elezione: ${user.grado_elezione || 'N/A'}`);
      console.log(`   🏛️ Paese Elezione: ${user.paese_elezione || 'N/A'}`);
      console.log(`   🏛️ Grado Candidatura: ${user.grado_candidatura || 'N/A'}`);
      console.log(`   🏛️ Paese Candidatura: ${user.paese_candidatura || 'N/A'}`);
      console.log(`   📍 Regione: ${user.regione || 'N/A'}`);
      console.log(`   📍 Provincia: ${user.provincia || 'N/A'}`);
      console.log(`   📍 Comune: ${user.comune || 'N/A'}`);
    });
    
    // 4. CONTROLLA ALCUNI ESEMPI SPECIFICI DA FIRESTORE
    console.log('\n📊 ESEMPI SPECIFICI DA FIRESTORE:');
    const sampleDocs = utentiSnapshot.docs.slice(0, 5);
    
    for (const doc of sampleDocs) {
      const utente = doc.data();
      console.log(`\n👤 ${utente.nome} ${utente.cognome} (${utente.email}):`);
      console.log(`   🏛️ Grado Elezione: ${utente.grado_elezione || 'N/A'}`);
      console.log(`   🏛️ Paese Elezione: ${utente.paese_elezione || 'N/A'}`);
      console.log(`   🏛️ Grado Candidatura: ${utente.grado_candidatura || 'N/A'}`);
      console.log(`   🏛️ Paese Candidatura: ${utente.paese_candidatura || 'N/A'}`);
      console.log(`   📍 Regione: ${utente.regione || 'N/A'}`);
      console.log(`   📍 Provincia: ${utente.provincia || 'N/A'}`);
      console.log(`   📍 Comune: ${utente.comune || 'N/A'}`);
    }
    
    await pool.end();
    console.log('\n✅ ANALISI COMPLETATA');
    
  } catch (error) {
    console.error('❌ Errore durante analisi:', error);
    await pool.end();
  }
}

checkElectionData();
