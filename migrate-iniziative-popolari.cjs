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

async function migrateIniziativePopolari() {
  try {
    console.log('🔧 DEBUG: MIGRAZIONE INIZIATIVE POPOLARI');
    
    // 1. CREA TABELLA INIZIATIVE_POPOLARI SE NON ESISTE
    console.log('🔄 Creazione tabella iniziative_popolari...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS iniziative_popolari (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        firestoreid TEXT UNIQUE NOT NULL,
        userid UUID REFERENCES users(id) ON DELETE SET NULL,
        firestore_uid_backup TEXT,
        nome TEXT NOT NULL,
        data_inizio DATE,
        data_fine DATE,
        sito_web TEXT,
        status TEXT DEFAULT 'pending',
        quorum TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        accepted_at TIMESTAMP
      )
    `);
    
    console.log('✅ Tabella iniziative_popolari creata/verificata');
    
    // 2. PRENDI TUTTE LE INIZIATIVE DA FIRESTORE
    console.log('🔄 Recupero iniziative da Firestore...');
    const iniziativeSnapshot = await firestore.collection('iniziative_popolari').get();
    
    if (iniziativeSnapshot.empty) {
      console.log('⚠️ Nessuna iniziativa trovata in Firestore');
      await pool.end();
      return;
    }
    
    console.log(`📊 Trovate ${iniziativeSnapshot.size} iniziative in Firestore`);
    
    let inseriti = 0;
    let errori = 0;
    let utentiNonTrovati = 0;
    
    // 3. MIGRA OGNI INIZIATIVA
    for (const doc of iniziativeSnapshot.docs) {
      try {
        const iniziativa = doc.data();
        const firestoreId = doc.id;
        const firestoreUserId = iniziativa.userId;
        
        if (!iniziativa.nome) {
          console.log(`⚠️ Iniziativa ${firestoreId} manca nome: ${iniziativa.nome}`);
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
        
        if (iniziativa.dataInizio) {
          dataInizio = new Date(iniziativa.dataInizio);
        }
        if (iniziativa.dataFine) {
          dataFine = new Date(iniziativa.dataFine);
        }
        
        // Converti timestamp
        let createdAt = new Date();
        let acceptedAt = null;
        
        if (iniziativa.createdAt) {
          if (typeof iniziativa.createdAt.toDate === 'function') {
            createdAt = iniziativa.createdAt.toDate();
          } else if (iniziativa.createdAt instanceof Date) {
            createdAt = iniziativa.createdAt;
          } else if (typeof iniziativa.createdAt === 'string') {
            createdAt = new Date(iniziativa.createdAt);
          }
        }
        
        if (iniziativa.acceptedAt) {
          if (typeof iniziativa.acceptedAt.toDate === 'function') {
            acceptedAt = iniziativa.acceptedAt.toDate();
          } else if (iniziativa.acceptedAt instanceof Date) {
            acceptedAt = iniziativa.acceptedAt;
          } else if (typeof iniziativa.acceptedAt === 'string') {
            acceptedAt = new Date(iniziativa.acceptedAt);
          }
        }
        
        // Inserisci l'iniziativa in Neon
        const insertQuery = `
          INSERT INTO iniziative_popolari (
            firestoreid, userid, firestore_uid_backup, nome, data_inizio, data_fine, 
            sito_web, status, quorum, created_at, updated_at, accepted_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
          ON CONFLICT (firestoreid) DO UPDATE SET
            nome = EXCLUDED.nome,
            data_inizio = EXCLUDED.data_inizio,
            data_fine = EXCLUDED.data_fine,
            sito_web = EXCLUDED.sito_web,
            status = EXCLUDED.status,
            quorum = EXCLUDED.quorum,
            accepted_at = EXCLUDED.accepted_at,
            updated_at = NOW()
        `;
        
        await pool.query(insertQuery, [
          firestoreId,
          neonUserId,
          firestoreUserId,
          iniziativa.nome,
          dataInizio,
          dataFine,
          iniziativa.sitoWeb || null,
          iniziativa.status || 'pending',
          iniziativa.quorum || 'pending',
          createdAt,
          acceptedAt
        ]);
        
        inseriti++;
        console.log(`✅ Iniziativa migrata: ${iniziativa.nome} (utente: ${firestoreUserId || 'N/A'})`);
        
      } catch (error) {
        console.error(`❌ Errore migrazione iniziativa ${doc.id}:`, error.message);
        errori++;
      }
    }
    
    // 4. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_iniziative,
        COUNT(DISTINCT userid) as utenti_creatori,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as in_attesa,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accettate,
        COUNT(CASE WHEN quorum = 'ok' THEN 1 END) as quorum_raggiunto
      FROM iniziative_popolari
    `);
    
    const stats = finalStats.rows[0];
    console.log(`📊 Totale iniziative migrate: ${stats.total_iniziative}`);
    console.log(`📊 Utenti creatori: ${stats.utenti_creatori}`);
    console.log(`📊 In attesa: ${stats.in_attesa}`);
    console.log(`📊 Accettate: ${stats.accettate}`);
    console.log(`📊 Con quorum raggiunto: ${stats.quorum_raggiunto}`);
    
    // 5. MOSTRA ALCUNI ESEMPI
    console.log('\n📊 ESEMPI INIZIATIVE MIGRATE:');
    const sampleIniziative = await pool.query(`
      SELECT ip.nome, ip.status, ip.quorum, ip.data_inizio, ip.data_fine, ip.created_at, 
             u.nome as user_nome, u.cognome as user_cognome, ip.firestore_uid_backup
      FROM iniziative_popolari ip
      LEFT JOIN users u ON ip.userid = u.id
      ORDER BY ip.created_at DESC
      LIMIT 5
    `);
    
    sampleIniziative.rows.forEach(iniziativa => {
      console.log(`📋 ${iniziativa.nome} (${iniziativa.status})`);
      if (iniziativa.user_nome) {
        console.log(`   👤 Creata da: ${iniziativa.user_nome} ${iniziativa.user_cognome}`);
      } else {
        console.log(`   👤 Creata da: Utente non trovato`);
      }
      console.log(`   📅 Creata il: ${iniziativa.created_at}`);
      if (iniziativa.data_inizio && iniziativa.data_fine) {
        console.log(`   📅 Periodo: ${iniziativa.data_inizio} - ${iniziativa.data_fine}`);
      }
      console.log(`   🎯 Quorum: ${iniziativa.quorum}`);
      if (iniziativa.firestore_uid_backup) {
        console.log(`   🔗 Firestore UID: ${iniziativa.firestore_uid_backup}`);
      }
    });
    
    console.log('\n✅ MIGRAZIONE INIZIATIVE POPOLARI COMPLETATA');
    console.log(`📊 STATISTICHE: ${inseriti} inseriti, ${utentiNonTrovati} utenti non trovati, ${errori} errori`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    await pool.end();
  }
}

migrateIniziativePopolari();
