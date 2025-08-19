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

async function migrateVotiCapoStato() {
  try {
    console.log('🔧 DEBUG: MIGRAZIONE VOTI CAPO STATO');
    
    // 1. CREA TABELLA VOTI_CAPO_STATO SE NON ESISTE
    console.log('🔄 Creazione tabella voti_capo_stato...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voti_capo_stato (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        firestore_uid TEXT NOT NULL,
        nome TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(userid, nome)
      )
    `);
    
    console.log('✅ Tabella voti_capo_stato creata/verificata');
    
    // 2. PRENDI TUTTI I VOTI DA FIRESTORE
    console.log('🔄 Recupero voti da Firestore...');
    const votiSnapshot = await firestore.collection('voti_capo_stato').get();
    
    if (votiSnapshot.empty) {
      console.log('⚠️ Nessun voto trovato in Firestore');
      await pool.end();
      return;
    }
    
    console.log(`📊 Trovati ${votiSnapshot.size} voti in Firestore`);
    
    let inseriti = 0;
    let errori = 0;
    let utentiNonTrovati = 0;
    
    // 3. MIGRA OGNI VOTO
    for (const doc of votiSnapshot.docs) {
      try {
        const voto = doc.data();
        const firestoreUserId = voto.userId;
        
        if (!firestoreUserId || !voto.nome) {
          console.log(`⚠️ Voto ${doc.id} mancano dati: userId=${firestoreUserId}, nome=${voto.nome}`);
          continue;
        }
        
        // Trova l'utente in Neon tramite firestore_uid
        const userQuery = await pool.query(
          'SELECT id FROM users WHERE firestore_uid = $1',
          [firestoreUserId]
        );
        
        if (userQuery.rows.length === 0) {
          utentiNonTrovati++;
          console.log(`⚠️ Utente non trovato per firestore_uid: ${firestoreUserId}`);
          continue;
        }
        
        const neonUserId = userQuery.rows[0].id;
        
        // Converti timestamp
        let timestamp = new Date();
        if (voto.timestamp) {
          if (typeof voto.timestamp.toDate === 'function') {
            timestamp = voto.timestamp.toDate();
          } else if (voto.timestamp instanceof Date) {
            timestamp = voto.timestamp;
          } else if (typeof voto.timestamp === 'string') {
            timestamp = new Date(voto.timestamp);
          }
        }
        
        // Inserisci il voto in Neon
        const insertQuery = `
          INSERT INTO voti_capo_stato (userid, firestore_uid, nome, timestamp, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT (userid, nome) DO UPDATE SET
            timestamp = EXCLUDED.timestamp,
            updated_at = NOW()
        `;
        
        await pool.query(insertQuery, [
          neonUserId,
          firestoreUserId,
          voto.nome,
          timestamp
        ]);
        
        inseriti++;
        console.log(`✅ Voto migrato: ${voto.nome} (utente: ${firestoreUserId})`);
        
      } catch (error) {
        console.error(`❌ Errore migrazione voto ${doc.id}:`, error.message);
        errori++;
      }
    }
    
    // 4. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_voti,
        COUNT(DISTINCT userid) as utenti_votanti,
        COUNT(DISTINCT nome) as nomi_diversi
      FROM voti_capo_stato
    `);
    
    const stats = finalStats.rows[0];
    console.log(`📊 Totale voti migrati: ${stats.total_voti}`);
    console.log(`📊 Utenti che hanno votato: ${stats.utenti_votanti}`);
    console.log(`📊 Nomi diversi votati: ${stats.nomi_diversi}`);
    
    // 5. MOSTRA ALCUNI ESEMPI
    console.log('\n📊 ESEMPI VOTI MIGRATI:');
    const sampleVotes = await pool.query(`
      SELECT vcs.nome, vcs.timestamp, u.nome as user_nome, u.cognome as user_cognome, vcs.firestore_uid
      FROM voti_capo_stato vcs
      JOIN users u ON vcs.userid = u.id
      ORDER BY vcs.timestamp DESC
      LIMIT 5
    `);
    
    sampleVotes.rows.forEach(vote => {
      console.log(`🗳️ ${vote.nome}`);
      console.log(`   👤 Votato da: ${vote.user_nome} ${vote.user_cognome}`);
      console.log(`   📅 Timestamp: ${vote.timestamp}`);
      console.log(`   🔗 Firestore UID: ${vote.firestore_uid}`);
    });
    
    console.log('\n✅ MIGRAZIONE VOTI CAPO STATO COMPLETATA');
    console.log(`📊 STATISTICHE: ${inseriti} inseriti, ${utentiNonTrovati} utenti non trovati, ${errori} errori`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    await pool.end();
  }
}

migrateVotiCapoStato();
