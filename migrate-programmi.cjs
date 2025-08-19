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

async function migrateProgrammi() {
  try {
    console.log('🔧 DEBUG: MIGRAZIONE PROGRAMMI');
    
    // 1. CREA TABELLA PROGRAMMI SE NON ESISTE
    console.log('🔄 Creazione tabella programmi...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS programmi (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        firestore_id_backup TEXT UNIQUE NOT NULL,
        user_id_backup UUID REFERENCES users(id) ON DELETE SET NULL,
        firestore_uid_backup TEXT,
        nome TEXT NOT NULL,
        descrizione TEXT,
        partito TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ Tabella programmi creata/verificata');
    
    // 2. PRENDI TUTTI I PROGRAMMI DA FIRESTORE
    console.log('🔄 Recupero programmi da Firestore...');
    const programmiSnapshot = await firestore.collection('programmi').get();
    
    if (programmiSnapshot.empty) {
      console.log('⚠️ Nessun programma trovato in Firestore');
      await pool.end();
      return;
    }
    
    console.log(`📊 Trovati ${programmiSnapshot.size} programmi in Firestore`);
    
    let inseriti = 0;
    let errori = 0;
    let utentiNonTrovati = 0;
    
    // 3. MIGRA OGNI PROGRAMMA
    for (const doc of programmiSnapshot.docs) {
      try {
        const programma = doc.data();
        const firestoreId = doc.id;
        const firestoreUserId = programma.userId;
        
        if (!programma.nome) {
          console.log(`⚠️ Programma ${firestoreId} manca nome: ${programma.nome}`);
          continue;
        }
        
        let neonUserId = null;
        
        // Se c'è un userId, trova l'utente in Neon
        if (firestoreUserId) {
          const userQuery = await pool.query(
            'SELECT id FROM users WHERE firestore_uid = $1',
            [firestoreUserId]
          );
          
          if (userQuery.rows.length > 0) {
            neonUserId = userQuery.rows[0].id;
          } else {
            utentiNonTrovati++;
            console.log(`⚠️ Utente non trovato per firestore_uid: ${firestoreUserId}`);
          }
        }
        
        // Converti timestamp
        let createdAt = new Date();
        
        if (programma.createdAt) {
          if (typeof programma.createdAt.toDate === 'function') {
            createdAt = programma.createdAt.toDate();
          } else if (programma.createdAt instanceof Date) {
            createdAt = programma.createdAt;
          } else if (typeof programma.createdAt === 'string') {
            createdAt = new Date(programma.createdAt);
          }
        }
        
        // Inserisci il programma in Neon
        const insertQuery = `
          INSERT INTO programmi (
            firestore_id_backup, user_id_backup, firestore_uid_backup, nome, descrizione, partito, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (firestore_id_backup) DO UPDATE SET
            nome = EXCLUDED.nome,
            descrizione = EXCLUDED.descrizione,
            partito = EXCLUDED.partito,
            updated_at = NOW()
        `;
        
        await pool.query(insertQuery, [
          firestoreId,
          neonUserId,
          firestoreUserId,
          programma.nome,
          programma.descrizione || null,
          programma.partito || null,
          createdAt
        ]);
        
        inseriti++;
        console.log(`✅ Programma migrato: ${programma.nome} (utente: ${firestoreUserId || 'N/A'})`);
        
      } catch (error) {
        console.error(`❌ Errore migrazione programma ${doc.id}:`, error.message);
        errori++;
      }
    }
    
    // 4. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_programmi,
        COUNT(DISTINCT user_id_backup) as utenti_creatori,
        COUNT(CASE WHEN partito IS NOT NULL THEN 1 END) as con_partito
      FROM programmi
    `);
    
    const stats = finalStats.rows[0];
    console.log(`📊 Totale programmi migrati: ${stats.total_programmi}`);
    console.log(`📊 Utenti creatori: ${stats.utenti_creatori}`);
    console.log(`📊 Con partito specificato: ${stats.con_partito}`);
    
    // 5. MOSTRA ALCUNI ESEMPI
    console.log('\n📊 ESEMPI PROGRAMMI MIGRATI:');
    const sampleProgrammi = await pool.query(`
      SELECT p.nome, p.descrizione, p.partito, p.created_at, 
             u.nome as user_nome, u.cognome as user_cognome, p.firestore_uid_backup
      FROM programmi p
      LEFT JOIN users u ON p.user_id_backup = u.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
    
    sampleProgrammi.rows.forEach(programma => {
      console.log(`📋 ${programma.nome}`);
      if (programma.user_nome) {
        console.log(`   👤 Creato da: ${programma.user_nome} ${programma.user_cognome}`);
      } else {
        console.log(`   👤 Creato da: Utente non trovato`);
      }
      console.log(`   📅 Creato il: ${programma.created_at}`);
      if (programma.partito) {
        console.log(`   🏛️ Partito: ${programma.partito}`);
      }
      if (programma.descrizione) {
        console.log(`   📝 Descrizione: ${programma.descrizione.substring(0, 100)}${programma.descrizione.length > 100 ? '...' : ''}`);
      }
      if (programma.firestore_uid_backup) {
        console.log(`   🔗 Firestore UID: ${programma.firestore_uid_backup}`);
      }
    });
    
    console.log('\n✅ MIGRAZIONE PROGRAMMI COMPLETATA');
    console.log(`📊 STATISTICHE: ${inseriti} inseriti, ${utentiNonTrovati} utenti non trovati, ${errori} errori`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    await pool.end();
  }
}

migrateProgrammi();
