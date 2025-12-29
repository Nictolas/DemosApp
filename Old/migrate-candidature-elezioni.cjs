require('dotenv').config();
const { Pool } = require('pg');
const admin = require('firebase-admin');
const fs = require('fs');

// Configurazione Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Configurazione Firestore
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateCandidatureElezioni() {
  console.log('🚀 Iniziando migrazione candidature ed elezioni...');
  
  try {
    // Ottieni tutti gli utenti da Firestore
    console.log('📥 Recuperando utenti da Firestore...');
    const firestoreUsersSnapshot = await db.collection('utenti').get();
    const firestoreUsers = [];
    
    firestoreUsersSnapshot.forEach(doc => {
      const userData = doc.data();
      firestoreUsers.push({
        id: doc.id,
        ...userData
      });
    });
    
    console.log(`✅ Trovati ${firestoreUsersSnapshot.size} utenti in Firestore`);
    
    // Ottieni tutti gli utenti da Neon per il mapping
    console.log('📥 Recuperando utenti da Neon per il mapping...');
    const { rows: neonUsers } = await pool.query('SELECT id, email FROM users');
    console.log(`✅ Trovati ${neonUsers.length} utenti in Neon`);
    
    // Crea una mappa email -> id per il mapping
    const emailToIdMap = {};
    neonUsers.forEach(user => {
      if (user.email) {
        emailToIdMap[user.email.toLowerCase()] = user.id;
      }
    });
    
    console.log(`📋 Mappa email creata per ${Object.keys(emailToIdMap).length} utenti`);
    
    // Conta quanti utenti hanno dati di candidatura/elezione
    let usersWithCandidature = 0;
    let usersWithElezioni = 0;
    
    firestoreUsers.forEach(user => {
      if (user.candidato_attivo || user.status_candidatura || user.grado_candidatura) {
        usersWithCandidature++;
      }
      if (user.grado_elezione || user.paese_elezione) {
        usersWithElezioni++;
      }
    });
    
    console.log(`🎯 Utenti con dati candidatura: ${usersWithCandidature}`);
    console.log(`🗳️ Utenti con dati elezioni: ${usersWithElezioni}`);
    
    // Prepara le query di aggiornamento
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const firestoreUser of firestoreUsers) {
      try {
        // Trova l'utente corrispondente in Neon tramite email
        const neonUserId = emailToIdMap[firestoreUser.email?.toLowerCase()];
        
        if (!neonUserId) {
          console.log(`⚠️ Utente non trovato in Neon: ${firestoreUser.email}`);
          skippedCount++;
          continue;
        }
        
        // Prepara i dati di candidatura ed elezione
        const candidatureData = {
          candidato_attivo: firestoreUser.candidato_attivo || null,
          status_candidatura: firestoreUser.status_candidatura || null,
          grado_candidatura: firestoreUser.grado_candidatura || null,
          paese_candidatura: firestoreUser.paese_candidatura || null,
          regione_candidatura: firestoreUser.regione_candidatura || null,
          provincia_candidatura: firestoreUser.provincia_candidatura || null,
          comune_candidatura: firestoreUser.comune_candidatura || null,
          data_candidatura: firestoreUser.data_candidatura || null,
          note_candidatura: firestoreUser.note_candidatura || null
        };
        
        const elezioniData = {
          grado_elezione: firestoreUser.grado_elezione || null,
          paese_elezione: firestoreUser.paese_elezione || null,
          regione_elezione: firestoreUser.regione_elezione || null,
          provincia_elezione: firestoreUser.provincia_elezione || null,
          comune_elezione: firestoreUser.comune_elezione || null
        };
        
        // Verifica se ci sono dati da aggiornare
        const hasCandidatureData = Object.values(candidatureData).some(val => val !== null);
        const hasElezioniData = Object.values(elezioniData).some(val => val !== null);
        
        if (!hasCandidatureData && !hasElezioniData) {
          continue; // Salta se non ci sono dati da aggiornare
        }
        
        // Costruisci la query di aggiornamento
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        // Aggiungi campi candidatura
        if (hasCandidatureData) {
          Object.entries(candidatureData).forEach(([key, value]) => {
            if (value !== null) {
              updateFields.push(`${key} = $${paramIndex}`);
              updateValues.push(value);
              paramIndex++;
            }
          });
        }
        
        // Aggiungi campi elezioni
        if (hasElezioniData) {
          Object.entries(elezioniData).forEach(([key, value]) => {
            if (value !== null) {
              updateFields.push(`${key} = $${paramIndex}`);
              updateValues.push(value);
              paramIndex++;
            }
          });
        }
        
        if (updateFields.length > 0) {
          updateValues.push(neonUserId);
          
          const updateQuery = `
            UPDATE users 
            SET ${updateFields.join(', ')}, 
                updated_at = NOW()
            WHERE id = $${paramIndex}
          `;
          
          await pool.query(updateQuery, updateValues);
          updatedCount++;
          
          console.log(`✅ Aggiornato utente: ${firestoreUser.email} (${updateFields.length} campi)`);
        }
        
      } catch (error) {
        console.error(`❌ Errore nell'aggiornamento dell'utente ${firestoreUser.email}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Migrazione completata!');
    console.log(`📊 Riepilogo:`);
    console.log(`   ✅ Utenti aggiornati: ${updatedCount}`);
    console.log(`   ⚠️ Utenti saltati: ${skippedCount}`);
    console.log(`   ❌ Errori: ${errorCount}`);
    console.log(`   🎯 Utenti con candidature in Firestore: ${usersWithCandidature}`);
    console.log(`   🗳️ Utenti con elezioni in Firestore: ${usersWithElezioni}`);
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Esegui la migrazione
migrateCandidatureElezioni();
