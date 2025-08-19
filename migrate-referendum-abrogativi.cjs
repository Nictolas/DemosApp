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

async function migrateReferendumAbrogativi() {
  try {
    console.log('🔧 DEBUG: MIGRAZIONE REFERENDUM ABROGATIVI');
    
    // 1. CREA TABELLA REFERENDUM_ABROGATIVI SE NON ESISTE
    console.log('🔄 Creazione tabella referendum_abrogativi...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referendum_abrogativi (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        firestore_id_backup TEXT UNIQUE NOT NULL,
        userid UUID REFERENCES users(id) ON DELETE SET NULL,
        firestore_uid_backup TEXT,
        nome TEXT NOT NULL,
        data_inizio DATE,
        data_fine DATE,
        status TEXT DEFAULT 'pending',
        quorum TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        accepted_at TIMESTAMP
      )
    `);
    
    console.log('✅ Tabella referendum_abrogativi creata/verificata');
    
    // 2. PRENDI TUTTI I REFERENDUM DA FIRESTORE
    console.log('🔄 Recupero referendum da Firestore...');
    const referendumSnapshot = await firestore.collection('referendum_abrogativi').get();
    
    if (referendumSnapshot.empty) {
      console.log('⚠️ Nessun referendum trovato in Firestore');
      await pool.end();
      return;
    }
    
    console.log(`📊 Trovati ${referendumSnapshot.size} referendum in Firestore`);
    
    let inseriti = 0;
    let errori = 0;
    let utentiNonTrovati = 0;
    
    // 3. MIGRA OGNI REFERENDUM
    for (const doc of referendumSnapshot.docs) {
      try {
        const referendum = doc.data();
        const firestoreId = doc.id;
        const firestoreUserId = referendum.userId;
        
        if (!referendum.nome) {
          console.log(`⚠️ Referendum ${firestoreId} manca nome: ${referendum.nome}`);
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
        
        // Converti date
        let dataInizio = null;
        let dataFine = null;
        
        if (referendum.dataInizio) {
          dataInizio = new Date(referendum.dataInizio);
        }
        if (referendum.dataFine) {
          dataFine = new Date(referendum.dataFine);
        }
        
        // Converti timestamp
        let createdAt = new Date();
        let acceptedAt = null;
        
        if (referendum.createdAt) {
          if (typeof referendum.createdAt.toDate === 'function') {
            createdAt = referendum.createdAt.toDate();
          } else if (referendum.createdAt instanceof Date) {
            createdAt = referendum.createdAt;
          } else if (typeof referendum.createdAt === 'string') {
            createdAt = new Date(referendum.createdAt);
          }
        }
        
        if (referendum.acceptedAt) {
          if (typeof referendum.acceptedAt.toDate === 'function') {
            acceptedAt = referendum.acceptedAt.toDate();
          } else if (referendum.acceptedAt instanceof Date) {
            acceptedAt = referendum.acceptedAt;
          } else if (typeof referendum.acceptedAt === 'string') {
            acceptedAt = new Date(referendum.acceptedAt);
          }
        }
        
        // Inserisci il referendum in Neon
        const insertQuery = `
          INSERT INTO referendum_abrogativi (
            firestore_id_backup, userid, firestore_uid_backup, nome, data_inizio, data_fine, 
            status, quorum, created_at, updated_at, accepted_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
          ON CONFLICT (firestore_id_backup) DO UPDATE SET
            nome = EXCLUDED.nome,
            data_inizio = EXCLUDED.data_inizio,
            data_fine = EXCLUDED.data_fine,
            status = EXCLUDED.status,
            quorum = EXCLUDED.quorum,
            accepted_at = EXCLUDED.accepted_at,
            updated_at = NOW()
        `;
        
        await pool.query(insertQuery, [
          firestoreId,
          neonUserId,
          firestoreUserId,
          referendum.nome,
          dataInizio,
          dataFine,
          referendum.status || 'pending',
          referendum.quorum || 'pending',
          createdAt,
          acceptedAt
        ]);
        
        inseriti++;
        console.log(`✅ Referendum migrato: ${referendum.nome} (utente: ${firestoreUserId || 'N/A'})`);
        
      } catch (error) {
        console.error(`❌ Errore migrazione referendum ${doc.id}:`, error.message);
        errori++;
      }
    }
    
    // 4. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_referendum,
        COUNT(DISTINCT userid) as utenti_creatori,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as in_attesa,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accettati,
        COUNT(CASE WHEN quorum = 'ok' THEN 1 END) as quorum_raggiunto
      FROM referendum_abrogativi
    `);
    
    const stats = finalStats.rows[0];
    console.log(`📊 Totale referendum migrati: ${stats.total_referendum}`);
    console.log(`📊 Utenti creatori: ${stats.utenti_creatori}`);
    console.log(`📊 In attesa: ${stats.in_attesa}`);
    console.log(`📊 Accettati: ${stats.accettati}`);
    console.log(`📊 Con quorum raggiunto: ${stats.quorum_raggiunto}`);
    
    // 5. MOSTRA ALCUNI ESEMPI
    console.log('\n📊 ESEMPI REFERENDUM MIGRATI:');
    const sampleReferendum = await pool.query(`
      SELECT ra.nome, ra.status, ra.quorum, ra.data_inizio, ra.data_fine, ra.created_at, 
             u.nome as user_nome, u.cognome as user_cognome, ra.firestore_uid_backup
      FROM referendum_abrogativi ra
      LEFT JOIN users u ON ra.userid = u.id
      ORDER BY ra.created_at DESC
      LIMIT 5
    `);
    
    sampleReferendum.rows.forEach(referendum => {
      console.log(`🗳️ ${referendum.nome} (${referendum.status})`);
      if (referendum.user_nome) {
        console.log(`   👤 Creato da: ${referendum.user_nome} ${referendum.user_cognome}`);
      } else {
        console.log(`   👤 Creato da: Utente non trovato`);
      }
      console.log(`   📅 Creato il: ${referendum.created_at}`);
      if (referendum.data_inizio && referendum.data_fine) {
        console.log(`   📅 Periodo: ${referendum.data_inizio} - ${referendum.data_fine}`);
      }
      console.log(`   🎯 Quorum: ${referendum.quorum}`);
      if (referendum.firestore_uid_backup) {
        console.log(`   🔗 Firestore UID: ${referendum.firestore_uid_backup}`);
      }
    });
    
    console.log('\n✅ MIGRAZIONE REFERENDUM ABROGATIVI COMPLETATA');
    console.log(`📊 STATISTICHE: ${inseriti} inseriti, ${utentiNonTrovati} utenti non trovati, ${errori} errori`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    await pool.end();
  }
}

migrateReferendumAbrogativi();
