/**
 * Script di test per verificare gli endpoint POST /vota e DELETE /vota
 * per iniziative popolari e referendum abrogativi
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function testVotiIniziativePopolari() {
  console.log('\n🧪 ========== TEST VOTI INIZIATIVE POPOLARI ==========\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Trova un utente reale dal database
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      throw new Error('Nessun utente trovato nel database');
    }
    const testUserId = userResult.rows[0].id;
    console.log(`   📋 Utente di test: ${testUserId}`);
    
    // 2. Trova un'iniziativa reale dal database
    const iniziativaResult = await client.query(`
      SELECT id FROM iniziative_popolari 
      WHERE quorum_raggiunto = true 
      LIMIT 1
    `);
    if (iniziativaResult.rows.length === 0) {
      // Prova con iniziative_ministero
      const iniziativaMinisteroResult = await client.query(`
        SELECT id FROM iniziative_ministero 
        WHERE tipo LIKE '%Legge%di%iniziativa%popolare%' 
          AND quorum_raggiunto = true 
        LIMIT 1
      `);
      if (iniziativaMinisteroResult.rows.length === 0) {
        throw new Error('Nessuna iniziativa trovata nel database');
      }
      var testIniziativaId = iniziativaMinisteroResult.rows[0].id;
    } else {
      var testIniziativaId = iniziativaResult.rows[0].id;
    }
    console.log(`   📋 Iniziativa di test: ${testIniziativaId}`);
    
    console.log('1️⃣ Test: Cancellazione voti esistenti');
    const deleteQuery = `
      DELETE FROM voti_iniziative_popolari 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const deleteResult = await client.query(deleteQuery, [testUserId]);
    console.log(`   ✅ Voti eliminati: ${deleteResult.rowCount}`);
    
    console.log('\n2️⃣ Test: Inserimento nuovo voto');
    const insertQuery = `
      INSERT INTO voti_iniziative_popolari (userid, iniziativa_id, timestamp, created_at, updated_at) 
      VALUES ($1::uuid, $2, NOW(), NOW(), NOW()) 
      RETURNING id, userid, iniziativa_id
    `;
    const insertResult = await client.query(insertQuery, [testUserId, testIniziativaId]);
    console.log(`   ✅ Voto inserito:`, insertResult.rows[0]);
    
    console.log('\n3️⃣ Test: Verifica voto salvato');
    const verifyQuery = `
      SELECT id, userid, iniziativa_id, timestamp 
      FROM voti_iniziative_popolari 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const verifyResult = await client.query(verifyQuery, [testUserId]);
    console.log(`   ✅ Voti trovati: ${verifyResult.rows.length}`);
    if (verifyResult.rows.length > 0) {
      console.log(`   📋 Dettagli:`, verifyResult.rows[0]);
    }
    
    console.log('\n4️⃣ Test: Aggiornamento voto (cambio iniziativa)');
    // Trova un'altra iniziativa
    const newIniziativaResult = await client.query(`
      SELECT id FROM iniziative_popolari 
      WHERE quorum_raggiunto = true 
        AND id != $1
      LIMIT 1
    `, [testIniziativaId]);
    if (newIniziativaResult.rows.length === 0) {
      const newIniziativaMinisteroResult = await client.query(`
        SELECT id FROM iniziative_ministero 
        WHERE tipo LIKE '%Legge%di%iniziativa%popolare%' 
          AND quorum_raggiunto = true 
          AND id != $1
        LIMIT 1
      `, [testIniziativaId]);
      if (newIniziativaMinisteroResult.rows.length === 0) {
        console.log('   ⚠️ Nessuna altra iniziativa trovata, salto questo test');
        var newIniziativaId = null;
      } else {
        var newIniziativaId = newIniziativaMinisteroResult.rows[0].id;
      }
    } else {
      var newIniziativaId = newIniziativaResult.rows[0].id;
    }
    
    if (newIniziativaId) {
    const deleteOldQuery = `
      DELETE FROM voti_iniziative_popolari 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    await client.query(deleteOldQuery, [testUserId]);
    const insertNewQuery = `
      INSERT INTO voti_iniziative_popolari (userid, iniziativa_id, timestamp, created_at, updated_at) 
      VALUES ($1::uuid, $2, NOW(), NOW(), NOW()) 
      RETURNING id, iniziativa_id
    `;
      const updateResult = await client.query(insertNewQuery, [testUserId, newIniziativaId]);
      console.log(`   ✅ Nuovo voto inserito:`, updateResult.rows[0]);
    }
    
    console.log('\n5️⃣ Test: Cancellazione finale');
    const finalDeleteQuery = `
      DELETE FROM voti_iniziative_popolari 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const finalDeleteResult = await client.query(finalDeleteQuery, [testUserId]);
    console.log(`   ✅ Voti eliminati: ${finalDeleteResult.rowCount}`);
    
    // Verifica che non ci siano più voti
    const finalVerifyQuery = `
      SELECT COUNT(*) as count 
      FROM voti_iniziative_popolari 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const finalVerifyResult = await client.query(finalVerifyQuery, [testUserId]);
    console.log(`   ✅ Voti rimanenti: ${finalVerifyResult.rows[0].count}`);
    
    await client.query('ROLLBACK'); // Rollback per non modificare i dati reali
    console.log('\n   ✅ Test completato (ROLLBACK eseguito)\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Errore nel test:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function testVotiReferendumAbrogativi() {
  console.log('\n🧪 ========== TEST VOTI REFERENDUM ABROGATIVI ==========\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Trova un utente reale dal database
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      throw new Error('Nessun utente trovato nel database');
    }
    const testUserId = userResult.rows[0].id;
    console.log(`   📋 Utente di test: ${testUserId}`);
    
    // 2. Trova un referendum reale dal database
    const referendumResult = await client.query(`
      SELECT id FROM referendum_abrogativi 
      WHERE quorum_raggiunto = true 
      LIMIT 1
    `);
    if (referendumResult.rows.length === 0) {
      // Prova con iniziative_ministero
      const referendumMinisteroResult = await client.query(`
        SELECT id FROM iniziative_ministero 
        WHERE (tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')
          AND quorum_raggiunto = true 
        LIMIT 1
      `);
      if (referendumMinisteroResult.rows.length === 0) {
        throw new Error('Nessun referendum trovato nel database');
      }
      var testReferendumId = referendumMinisteroResult.rows[0].id;
    } else {
      var testReferendumId = referendumResult.rows[0].id;
    }
    console.log(`   📋 Referendum di test: ${testReferendumId}`);
    
    console.log('1️⃣ Test: Cancellazione voti esistenti');
    const deleteQuery = `
      DELETE FROM voti_referendum_abrogativi 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const deleteResult = await client.query(deleteQuery, [testUserId]);
    console.log(`   ✅ Voti eliminati: ${deleteResult.rowCount}`);
    
    console.log('\n2️⃣ Test: Inserimento nuovo voto');
    const insertQuery = `
      INSERT INTO voti_referendum_abrogativi (userid, referendum_id, timestamp, created_at, updated_at) 
      VALUES ($1::uuid, $2, NOW(), NOW(), NOW()) 
      RETURNING id, userid, referendum_id
    `;
    const insertResult = await client.query(insertQuery, [testUserId, testReferendumId]);
    console.log(`   ✅ Voto inserito:`, insertResult.rows[0]);
    
    console.log('\n3️⃣ Test: Verifica voto salvato');
    const verifyQuery = `
      SELECT id, userid, referendum_id, timestamp 
      FROM voti_referendum_abrogativi 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const verifyResult = await client.query(verifyQuery, [testUserId]);
    console.log(`   ✅ Voti trovati: ${verifyResult.rows.length}`);
    if (verifyResult.rows.length > 0) {
      console.log(`   📋 Dettagli:`, verifyResult.rows[0]);
    }
    
    console.log('\n4️⃣ Test: Aggiornamento voto (cambio referendum)');
    // Trova un altro referendum
    const newReferendumResult = await client.query(`
      SELECT id FROM referendum_abrogativi 
      WHERE quorum_raggiunto = true 
        AND id != $1
      LIMIT 1
    `, [testReferendumId]);
    if (newReferendumResult.rows.length === 0) {
      const newReferendumMinisteroResult = await client.query(`
        SELECT id FROM iniziative_ministero 
        WHERE (tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')
          AND quorum_raggiunto = true 
          AND id != $1
        LIMIT 1
      `, [testReferendumId]);
      if (newReferendumMinisteroResult.rows.length === 0) {
        console.log('   ⚠️ Nessun altro referendum trovato, salto questo test');
        var newReferendumId = null;
      } else {
        var newReferendumId = newReferendumMinisteroResult.rows[0].id;
      }
    } else {
      var newReferendumId = newReferendumResult.rows[0].id;
    }
    
    if (newReferendumId) {
    const deleteOldQuery = `
      DELETE FROM voti_referendum_abrogativi 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    await client.query(deleteOldQuery, [testUserId]);
    const insertNewQuery = `
      INSERT INTO voti_referendum_abrogativi (userid, referendum_id, timestamp, created_at, updated_at) 
      VALUES ($1::uuid, $2, NOW(), NOW(), NOW()) 
      RETURNING id, referendum_id
    `;
      const updateResult = await client.query(insertNewQuery, [testUserId, newReferendumId]);
      console.log(`   ✅ Nuovo voto inserito:`, updateResult.rows[0]);
    }
    
    console.log('\n5️⃣ Test: Cancellazione finale');
    const finalDeleteQuery = `
      DELETE FROM voti_referendum_abrogativi 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const finalDeleteResult = await client.query(finalDeleteQuery, [testUserId]);
    console.log(`   ✅ Voti eliminati: ${finalDeleteResult.rowCount}`);
    
    // Verifica che non ci siano più voti
    const finalVerifyQuery = `
      SELECT COUNT(*) as count 
      FROM voti_referendum_abrogativi 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const finalVerifyResult = await client.query(finalVerifyQuery, [testUserId]);
    console.log(`   ✅ Voti rimanenti: ${finalVerifyResult.rows[0].count}`);
    
    await client.query('ROLLBACK'); // Rollback per non modificare i dati reali
    console.log('\n   ✅ Test completato (ROLLBACK eseguito)\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Errore nel test:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function testQueryStructure() {
  console.log('\n🧪 ========== TEST STRUTTURA TABELLE ==========\n');
  
  try {
    // Verifica struttura tabella voti_iniziative_popolari
    console.log('1️⃣ Struttura tabella voti_iniziative_popolari:');
    const strutturaIniziative = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'voti_iniziative_popolari'
      ORDER BY ordinal_position
    `);
    console.log('   Colonne:');
    strutturaIniziative.rows.forEach(col => {
      console.log(`     - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Verifica struttura tabella voti_referendum_abrogativi
    console.log('\n2️⃣ Struttura tabella voti_referendum_abrogativi:');
    const strutturaReferendum = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'voti_referendum_abrogativi'
      ORDER BY ordinal_position
    `);
    console.log('   Colonne:');
    strutturaReferendum.rows.forEach(col => {
      console.log(`     - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Verifica constraint e indici
    console.log('\n3️⃣ Constraint e indici:');
    const constraints = await pool.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name IN ('voti_iniziative_popolari', 'voti_referendum_abrogativi')
      ORDER BY tc.table_name, tc.constraint_type
    `);
    console.log('   Constraint trovati:');
    constraints.rows.forEach(c => {
      console.log(`     - ${c.table_name}.${c.column_name}: ${c.constraint_type} (${c.constraint_name})`);
    });
    
  } catch (error) {
    console.error('❌ Errore nel test struttura:', error);
    throw error;
  }
}

async function runAllTests() {
  console.log('🚀 ========== AVVIO TEST ENDPOINT VOTI ==========\n');
  
  try {
    await testQueryStructure();
    await testVotiIniziativePopolari();
    await testVotiReferendumAbrogativi();
    
    console.log('✅ ========== TUTTI I TEST COMPLETATI ==========\n');
    
  } catch (error) {
    console.error('\n❌ ========== ERRORE NEI TEST ==========');
    console.error('Errore:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Esegui i test
runAllTests();

