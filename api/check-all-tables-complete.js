const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkAllTables() {
  try {
    console.log('🔍 CONTROLLO COMPLETO DATABASE NEON...\n');
    
    // 1. Tutte le tabelle esistenti
    console.log('📋 1. TABELLE ESISTENTI:');
    const tablesQuery = `
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    
    tablesResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name} (${row.column_count} colonne)`);
    });
    
    console.log(`\n✅ Totale: ${tablesResult.rows.length} tabelle trovate\n`);
    
    // 2. Controllo tabelle problematiche specifiche
    console.log('🚨 2. TABELLE PROBLEMATICHE (che causano errori 500):');
    
    const problematicTables = [
      'rappresentanti',
      'risposte_opinioni', 
      'voti_governo',
      'categorie_opinioni',
      'categorie_rappresentanti'
    ];
    
    for (const table of problematicTables) {
      try {
        const checkQuery = `SELECT COUNT(*) FROM ${table}`;
        const result = await pool.query(checkQuery);
        console.log(`✅ ${table}: ${result.rows[0].count} record`);
      } catch (error) {
        console.log(`❌ ${table}: NON ESISTE - ${error.message}`);
      }
    }
    
    // 3. Controllo struttura tabella users
    console.log('\n👤 3. STRUTTURA TABELLA USERS:');
    try {
      const userStructureQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position
      `;
      
      const userStructureResult = await pool.query(userStructureQuery);
      
      userStructureResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable}`);
      });
    } catch (error) {
      console.log(`❌ Errore nel leggere struttura users: ${error.message}`);
    }
    
    // 4. Controllo tabelle opinioni
    console.log('\n💭 4. TABELLE OPINIONI:');
    try {
      const opinionTables = ['opinioni', 'voti_opinioni', 'risposte_opinioni'];
      
      for (const table of opinionTables) {
        try {
          const checkQuery = `SELECT COUNT(*) FROM ${table}`;
          const result = await pool.query(checkQuery);
          console.log(`✅ ${table}: ${result.rows[0].count} record`);
          
          // Mostra struttura se esiste
          const structureQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '${table}' 
            ORDER BY ordinal_position
          `;
          const structureResult = await pool.query(structureQuery);
          console.log(`   Colonne: ${structureResult.rows.map(r => r.column_name).join(', ')}`);
        } catch (error) {
          console.log(`❌ ${table}: NON ESISTE`);
        }
      }
    } catch (error) {
      console.log(`❌ Errore nel controllare tabelle opinioni: ${error.message}`);
    }
    
    // 5. Controllo tabelle voti
    console.log('\n🗳️ 5. TABELLE VOTI:');
    try {
      const voteTables = ['voti_grazia', 'voti_capo_stato', 'voti_amnistia', 'voti_ministri', 'voti_iniziative_popolari', 'voti_referendum_abrogativi'];
      
      for (const table of voteTables) {
        try {
          const checkQuery = `SELECT COUNT(*) FROM ${table}`;
          const result = await pool.query(checkQuery);
          console.log(`✅ ${table}: ${result.rows[0].count} record`);
        } catch (error) {
          console.log(`❌ ${table}: NON ESISTE`);
        }
      }
    } catch (error) {
      console.log(`❌ Errore nel controllare tabelle voti: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Errore nel controllo completo:', error);
  } finally {
    await pool.end();
  }
}

checkAllTables();
