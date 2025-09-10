require('dotenv').config();
const { Pool } = require('pg');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function addMissingColumnsToUsers() {
  try {
    console.log('🔧 AGGIUNTA COLONNE MANCANTI ALLA TABELLA USERS');
    
    // 1. VERIFICA STRUTTURA ATTUALE
    console.log('🔄 Verifica struttura attuale tabella users...');
    
    const currentColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Colonne attuali in users:', currentColumns.rows.length);
    currentColumns.rows.forEach(col => {
      console.log(`   📋 ${col.column_name}: ${col.data_type}`);
    });
    
    // 2. DEFINISCI LE COLONNE MANCANTI
    const missingColumns = [
      { name: 'data_nascita', type: 'DATE' },
      { name: 'genere', type: 'VARCHAR(50)' },
      { name: 'cittadinanza', type: 'VARCHAR(100)' },
      { name: 'paese_residenza', type: 'VARCHAR(100)' },
      { name: 'regione_residenza', type: 'VARCHAR(100)' },
      { name: 'provincia_residenza', type: 'VARCHAR(100)' },
      { name: 'comune_residenza', type: 'VARCHAR(100)' },
      { name: 'paese_elezione', type: 'VARCHAR(100)' },
      { name: 'regione_elezione', type: 'VARCHAR(100)' },
      { name: 'provincia_elezione', type: 'VARCHAR(100)' },
      { name: 'comune_elezione', type: 'VARCHAR(100)' },
      { name: 'grado_elezione', type: 'VARCHAR(100)' },
      { name: 'paese_candidatura', type: 'VARCHAR(100)' },
      { name: 'regione_candidatura', type: 'VARCHAR(100)' },
      { name: 'provincia_candidatura', type: 'VARCHAR(100)' },
      { name: 'comune_candidatura', type: 'VARCHAR(100)' },
      { name: 'grado_candidatura', type: 'VARCHAR(100)' },
      { name: 'energia_nucleare', type: 'TEXT' },
      { name: 'sperimentazione_animale', type: 'TEXT' },
      { name: 'legalizzazione_canapa', type: 'TEXT' },
      { name: 'caccia', type: 'TEXT' },
      { name: 'cittadina_animale', type: 'TEXT' },
      { name: 'nato', type: 'TEXT' },
      { name: 'matrimonio_gay', type: 'TEXT' },
      { name: 'salario_minimo', type: 'TEXT' },
      { name: 'carne_coltivata', type: 'TEXT' },
      { name: 'case_chiuse', type: 'TEXT' },
      { name: 'eutanasia', type: 'TEXT' },
      { name: 'omobitransfobia', type: 'TEXT' },
      { name: 'avatar_config', type: 'TEXT' },
      { name: 'test_europeo', type: 'VARCHAR(255)' },
      { name: 'test_camera', type: 'VARCHAR(255)' },
      { name: 'test_senato', type: 'VARCHAR(255)' },
      { name: 'test_regionale', type: 'VARCHAR(255)' },
      { name: 'test_comune', type: 'VARCHAR(255)' }
    ];
    
    // 3. AGGIUNGI LE COLONNE MANCANTI
    console.log('🔄 Aggiunta colonne mancanti...');
    
    for (const column of missingColumns) {
      try {
        // Verifica se la colonna esiste già
        const columnExists = currentColumns.rows.find(c => c.column_name === column.name);
        
        if (!columnExists) {
          console.log(`   ➕ Aggiungo colonna: ${column.name} (${column.type})`);
          
          await pool.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
          console.log(`   ✅ Colonna ${column.name} aggiunta`);
        } else {
          console.log(`   ℹ️ Colonna ${column.name} già esistente`);
        }
      } catch (error) {
        console.error(`   ❌ Errore aggiunta colonna ${column.name}:`, error.message);
      }
    }
    
    // 4. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Colonne finali in users:', finalColumns.rows.length);
    finalColumns.rows.forEach(col => {
      console.log(`   📋 ${col.column_name}: ${col.data_type}`);
    });
    
    // 5. VERIFICA DATI ESISTENTI
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    console.log(`📊 Totale utenti in users: ${usersCount.rows[0].total}`);
    
    if (parseInt(usersCount.rows[0].total) > 0) {
      const sampleUser = await pool.query('SELECT * FROM users LIMIT 1');
      console.log('\n📊 ESEMPIO UTENTE:');
      console.log('   ID:', sampleUser.rows[0].id);
      console.log('   Email:', sampleUser.rows[0].email);
      console.log('   Nome:', sampleUser.rows[0].nome);
      console.log('   Cognome:', sampleUser.rows[0].cognome);
      console.log('   Ruolo:', sampleUser.rows[0].ruolo);
      console.log('   Status:', sampleUser.rows[0].status);
    }
    
    console.log('\n✅ COLONNE AGGIUNTE CON SUCCESSO');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante aggiunta colonne:', error);
    await pool.end();
  }
}

addMissingColumnsToUsers();
