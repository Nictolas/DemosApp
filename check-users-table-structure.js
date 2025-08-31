const { Pool } = require('pg');

async function checkUsersTableStructure() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Verificando struttura tabella users...\n');

    // 1. Verifica esistenza tabella
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabella "users" non trovata!');
      return;
    }
    
    console.log('✅ Tabella "users" trovata\n');

    // 2. Ottieni struttura completa della tabella
    const structure = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 STRUTTURA TABELLA USERS:');
    console.log('=' .repeat(80));
    console.log('Nome Colonna'.padEnd(25) + 'Tipo'.padEnd(20) + 'Nullable'.padEnd(10) + 'Default'.padEnd(15) + 'Max Length');
    console.log('=' .repeat(80));

    structure.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'YES' : 'NO';
      const defaultVal = col.column_default || 'NULL';
      const maxLength = col.character_maximum_length || '-';
      
      console.log(
        col.column_name.padEnd(25) + 
        col.data_type.padEnd(20) + 
        nullable.padEnd(10) + 
        defaultVal.padEnd(15) + 
        maxLength
      );
    });

    console.log('=' .repeat(80));
    console.log(`\n📊 Totale colonne: ${structure.rows.length}\n`);

    // 3. Verifica campi specifici per la registrazione
    const requiredFields = [
      'email', 'password_hash', 'nome', 'cognome', 'genere', 
      'data_nascita', 'cittadinanza', 'paese_residenza', 
      'regione_residenza', 'provincia_residenza', 'comune_residenza',
      'ruolo', 'grado_elezione', 'paese_elezione', 'regione_elezione',
      'provincia_elezione', 'comune_elezione', 'grado_candidatura',
      'paese_candidatura', 'regione_candidatura', 'provincia_candidatura',
      'comune_candidatura', 'status', 'created_at', 'updated_at'
    ];

    console.log('🔍 VERIFICA CAMPI REGISTRAZIONE:');
    console.log('-'.repeat(50));

    const existingColumns = structure.rows.map(row => row.column_name);
    
    requiredFields.forEach(field => {
      if (existingColumns.includes(field)) {
        const colInfo = structure.rows.find(row => row.column_name === field);
        console.log(`✅ ${field.padEnd(25)} - ${colInfo.data_type} (${colInfo.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      } else {
        console.log(`❌ ${field.padEnd(25)} - MANCANTE!`);
      }
    });

    // 4. Verifica campi extra nella tabella
    const extraFields = existingColumns.filter(col => !requiredFields.includes(col));
    if (extraFields.length > 0) {
      console.log('\n📝 CAMPI EXTRA NELLA TABELLA:');
      extraFields.forEach(field => {
        const colInfo = structure.rows.find(row => row.column_name === field);
        console.log(`ℹ️  ${field.padEnd(25)} - ${colInfo.data_type} (${colInfo.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    }

    // 5. Verifica tipi di dati critici
    console.log('\n🔍 VERIFICA TIPI DATI CRITICI:');
    console.log('-'.repeat(40));
    
    const criticalFields = ['data_nascita', 'created_at', 'updated_at'];
    criticalFields.forEach(field => {
      if (existingColumns.includes(field)) {
        const colInfo = structure.rows.find(row => row.column_name === field);
        console.log(`📅 ${field.padEnd(20)} - Tipo: ${colInfo.data_type}`);
        
        if (field === 'data_nascita' && colInfo.data_type !== 'date') {
          console.log(`   ⚠️  ATTENZIONE: data_nascita dovrebbe essere 'date', ma è '${colInfo.data_type}'`);
        }
      }
    });

  } catch (error) {
    console.error('💥 Errore durante la verifica:', error);
  } finally {
    await pool.end();
  }
}

// Esegui la verifica
checkUsersTableStructure().catch(console.error);
