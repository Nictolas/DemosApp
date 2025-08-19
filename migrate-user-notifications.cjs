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

async function migrateUserNotifications() {
  try {
    console.log('🔧 DEBUG: MIGRAZIONE USER NOTIFICATIONS');
    
    // 1. CREA TABELLA USER_NOTIFICATIONS SE NON ESISTE
    console.log('🔄 Creazione tabella user_notifications...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        firestore_id_backup TEXT UNIQUE NOT NULL,
        userid UUID REFERENCES users(id) ON DELETE CASCADE,
        firestore_uid_backup TEXT,
        titolo TEXT NOT NULL,
        messaggio TEXT NOT NULL,
        tipo TEXT DEFAULT 'info',
        letta BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ Tabella user_notifications creata/verificata');
    
    // 2. PRENDI TUTTE LE NOTIFICHE DA FIRESTORE
    console.log('🔄 Recupero notifiche da Firestore...');
    const notificationsSnapshot = await firestore.collection('user_notifications').get();
    
    if (notificationsSnapshot.empty) {
      console.log('⚠️ Nessuna notifica trovata in Firestore');
      await pool.end();
      return;
    }
    
    console.log(`📊 Trovate ${notificationsSnapshot.size} notifiche in Firestore`);
    
    let inseriti = 0;
    let errori = 0;
    let utentiNonTrovati = 0;
    
    // 3. MIGRA OGNI NOTIFICA
    for (const doc of notificationsSnapshot.docs) {
      try {
        const notification = doc.data();
        const firestoreId = doc.id;
        const firestoreUserId = notification.userId;
        
        if (!notification.titolo || !notification.messaggio) {
          console.log(`⚠️ Notifica ${firestoreId} mancano dati: titolo=${notification.titolo}, messaggio=${notification.messaggio}`);
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
        
        if (notification.createdAt) {
          if (typeof notification.createdAt.toDate === 'function') {
            createdAt = notification.createdAt.toDate();
          } else if (notification.createdAt instanceof Date) {
            createdAt = notification.createdAt;
          } else if (typeof notification.createdAt === 'string') {
            createdAt = new Date(notification.createdAt);
          }
        }
        
        // Inserisci la notifica in Neon
        const insertQuery = `
          INSERT INTO user_notifications (
            firestore_id_backup, userid, firestore_uid_backup, titolo, messaggio, tipo, letta, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (firestore_id_backup) DO UPDATE SET
            titolo = EXCLUDED.titolo,
            messaggio = EXCLUDED.messaggio,
            tipo = EXCLUDED.tipo,
            letta = EXCLUDED.letta,
            updated_at = NOW()
        `;
        
        await pool.query(insertQuery, [
          firestoreId,
          neonUserId,
          firestoreUserId,
          notification.titolo,
          notification.messaggio,
          notification.tipo || 'info',
          notification.letta || false,
          createdAt
        ]);
        
        inseriti++;
        console.log(`✅ Notifica migrata: ${notification.titolo} (utente: ${firestoreUserId || 'N/A'})`);
        
      } catch (error) {
        console.error(`❌ Errore migrazione notifica ${doc.id}:`, error.message);
        errori++;
      }
    }
    
    // 4. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_notifiche,
        COUNT(DISTINCT userid) as utenti_notificati,
        COUNT(CASE WHEN letta = TRUE THEN 1 END) as lette,
        COUNT(CASE WHEN letta = FALSE THEN 1 END) as non_lette,
        COUNT(CASE WHEN tipo = 'info' THEN 1 END) as tipo_info,
        COUNT(CASE WHEN tipo = 'warning' THEN 1 END) as tipo_warning,
        COUNT(CASE WHEN tipo = 'error' THEN 1 END) as tipo_error
      FROM user_notifications
    `);
    
    const stats = finalStats.rows[0];
    console.log(`📊 Totale notifiche migrate: ${stats.total_notifiche}`);
    console.log(`📊 Utenti notificati: ${stats.utenti_notificati}`);
    console.log(`📊 Lette: ${stats.lette}`);
    console.log(`📊 Non lette: ${stats.non_lette}`);
    console.log(`📊 Tipo info: ${stats.tipo_info}`);
    console.log(`📊 Tipo warning: ${stats.tipo_warning}`);
    console.log(`📊 Tipo error: ${stats.tipo_error}`);
    
    // 5. MOSTRA ALCUNI ESEMPI
    console.log('\n📊 ESEMPI NOTIFICHE MIGRATE:');
    const sampleNotifications = await pool.query(`
      SELECT un.titolo, un.messaggio, un.tipo, un.letta, un.created_at, 
             u.nome as user_nome, u.cognome as user_cognome, un.firestore_uid_backup
      FROM user_notifications un
      LEFT JOIN users u ON un.userid = u.id
      ORDER BY un.created_at DESC
      LIMIT 5
    `);
    
    sampleNotifications.rows.forEach(notification => {
      console.log(`📢 ${notification.titolo} (${notification.tipo})`);
      if (notification.user_nome) {
        console.log(`   👤 Per: ${notification.user_nome} ${notification.user_cognome}`);
      } else {
        console.log(`   👤 Per: Utente non trovato`);
      }
      console.log(`   📅 Creata il: ${notification.created_at}`);
      console.log(`   📖 Letta: ${notification.letta ? 'Sì' : 'No'}`);
      console.log(`   💬 Messaggio: ${notification.messaggio.substring(0, 100)}${notification.messaggio.length > 100 ? '...' : ''}`);
      if (notification.firestore_uid_backup) {
        console.log(`   🔗 Firestore UID: ${notification.firestore_uid_backup}`);
      }
    });
    
    console.log('\n✅ MIGRAZIONE USER NOTIFICATIONS COMPLETATA');
    console.log(`📊 STATISTICHE: ${inseriti} inseriti, ${utentiNonTrovati} utenti non trovati, ${errori} errori`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    await pool.end();
  }
}

migrateUserNotifications();
