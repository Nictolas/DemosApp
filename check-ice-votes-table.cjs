const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkICEVotesTable() {
  try {
    console.log('🔍 Verifica tabelle per voti ICE...');
    
    // Verifica tutte le tabelle che contengono "ice" nel nome
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%ice%' OR table_name LIKE '%voti%'
      ORDER BY table_name
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    
    console.log(`📋 Tabelle trovate:`);
    tablesResult.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Verifica se esiste una tabella per i voti ICE
    const votesTables = tablesResult.rows.filter(t => 
      t.table_name.includes('voti') || t.table_name.includes('votes')
    );
    
    if (votesTables.length > 0) {
      console.log('\n🎯 Tabelle per voti trovate:');
      votesTables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
      
      // Verifica la struttura di una tabella voti
      const votesTable = votesTables[0].table_name;
      const structureQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `;
      
      const structureResult = await pool.query(structureQuery, [votesTable]);
      console.log(`\n📋 Struttura tabella ${votesTable}:`);
      structureResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Conta i record
      const countQuery = `SELECT COUNT(*) as total FROM ${votesTable}`;
      const countResult = await pool.query(countQuery);
      console.log(`\n📊 Record totali in ${votesTable}: ${countResult.rows[0].total}`);
      
    } else {
      console.log('\n❌ Nessuna tabella per voti ICE trovata');
      console.log('🔧 Creazione tabella voti_ice...');
      
      // Crea la tabella per i voti ICE
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS voti_ice (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id),
          ice_id VARCHAR(50) REFERENCES ice(id),
          voto BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      await pool.query(createTableQuery);
      console.log('✅ Tabella voti_ice creata');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

checkICEVotesTable();
