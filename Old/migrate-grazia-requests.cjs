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

async function migrateGraziaRequests() {
  try {
    console.log('🔧 DEBUG: MIGRAZIONE GRAZIA REQUESTS');
    
    // 1. CREA TABELLA GRAZIA_REQUESTS SE NON ESISTE
    console.log('🔄 Creazione tabella grazia_requests...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS grazia_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        firestore_id TEXT UNIQUE NOT NULL,
        userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        firestore_uid_backup TEXT NOT NULL,
        nome TEXT NOT NULL,
        url_prova TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ Tabella grazia_requests creata/verificata');
    
    // 2. PRENDI TUTTE LE RICHIESTE DA FIRESTORE
    console.log('🔄 Recupero richieste da Firestore...');
    const requestsSnapshot = await firestore.collection('grazia_requests').get();
    
    if (requestsSnapshot.empty) {
      console.log('⚠️ Nessuna richiesta trovata in Firestore');
      await pool.end();
      return;
    }
    
    console.log(`📊 Trovate ${requestsSnapshot.size} richieste in Firestore`);
    
    let inseriti = 0;
    let errori = 0;
    let utentiNonTrovati = 0;
    
    // 3. MIGRA OGNI RICHIESTA
    for (const doc of requestsSnapshot.docs) {
      try {
        const request = doc.data();
        const firestoreUserId = request.userId;
        const firestoreId = doc.id;
        
        if (!firestoreUserId || !request.nome) {
          console.log(`⚠️ Richiesta ${firestoreId} mancano dati: userId=${firestoreUserId}, nome=${request.nome}`);
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
        let createdAt = new Date();
        if (request.createdAt) {
          if (typeof request.createdAt.toDate === 'function') {
            createdAt = request.createdAt.toDate();
          } else if (request.createdAt instanceof Date) {
            createdAt = request.createdAt;
          } else if (typeof request.createdAt === 'string') {
            createdAt = new Date(request.createdAt);
          }
        }
        
        // Inserisci la richiesta in Neon
        const insertQuery = `
          INSERT INTO grazia_requests (firestore_id, userid, firestore_uid_backup, nome, url_prova, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (firestore_id) DO UPDATE SET
            nome = EXCLUDED.nome,
            url_prova = EXCLUDED.url_prova,
            status = EXCLUDED.status,
            updated_at = NOW()
        `;
        
        await pool.query(insertQuery, [
          firestoreId,
          neonUserId,
          firestoreUserId,
          request.nome,
          request.urlProva || null,
          request.status || 'pending',
          createdAt
        ]);
        
        inseriti++;
        console.log(`✅ Richiesta migrata: ${request.nome} (utente: ${firestoreUserId})`);
        
      } catch (error) {
        console.error(`❌ Errore migrazione richiesta ${doc.id}:`, error.message);
        errori++;
      }
    }
    
    // 4. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_richieste,
        COUNT(DISTINCT userid) as utenti_richiedenti,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as in_attesa,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approvate,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rifiutate
      FROM grazia_requests
    `);
    
    const stats = finalStats.rows[0];
    console.log(`📊 Totale richieste migrate: ${stats.total_richieste}`);
    console.log(`📊 Utenti che hanno richiesto: ${stats.utenti_richiedenti}`);
    console.log(`📊 In attesa: ${stats.in_attesa}`);
    console.log(`📊 Approvate: ${stats.approvate}`);
    console.log(`📊 Rifiutate: ${stats.rifiutate}`);
    
    // 5. MOSTRA ALCUNI ESEMPI
    console.log('\n📊 ESEMPI RICHIESTE MIGRATE:');
    const sampleRequests = await pool.query(`
      SELECT gr.nome, gr.status, gr.url_prova, gr.created_at, u.nome as user_nome, u.cognome as user_cognome, gr.firestore_uid_backup
      FROM grazia_requests gr
      JOIN users u ON gr.userid = u.id
      ORDER BY gr.created_at DESC
      LIMIT 5
    `);
    
    sampleRequests.rows.forEach(request => {
      console.log(`📋 ${request.nome} (${request.status})`);
      console.log(`   👤 Richiesto da: ${request.user_nome} ${request.user_cognome}`);
      console.log(`   📅 Creata il: ${request.created_at}`);
      if (request.url_prova) {
        console.log(`   🔗 Prova: ${request.url_prova}`);
      }
      console.log(`   🔗 Firestore UID: ${request.firestore_uid_backup}`);
    });
    
    console.log('\n✅ MIGRAZIONE GRAZIA REQUESTS COMPLETATA');
    console.log(`📊 STATISTICHE: ${inseriti} inseriti, ${utentiNonTrovati} utenti non trovati, ${errori} errori`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    await pool.end();
  }
}

migrateGraziaRequests();
