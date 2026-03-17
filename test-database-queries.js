const { Pool } = require('pg');

async function testDatabaseQueries() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🧪 TEST QUERY DATABASE - Verifico possibili problemi...\n');

    // 1. Test connessione base
    console.log('1️⃣ Test connessione base...');
    const client = await pool.connect();
    console.log('✅ Connessione riuscita\n');
    client.release();

    // 2. Test esistenza tabella users
    console.log('2️⃣ Test esistenza tabella users...');
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ Tabella users trovata\n');
    } else {
      console.log('❌ Tabella users NON trovata!\n');
      return;
    }

    // 3. Test struttura tabella users
    console.log('3️⃣ Test struttura tabella users...');
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log(`📊 Colonne trovate: ${structure.rows.length}`);
    console.log('📋 Prime 10 colonne:');
    structure.rows.slice(0, 10).forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.column_name.padEnd(20)} - ${col.data_type.padEnd(15)} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    console.log('');

    // 4. Test campi critici per registrazione
    console.log('4️⃣ Test campi critici per registrazione...');
    const criticalFields = ['email', 'password_hash', 'nome', 'cognome', 'data_nascita'];
    
    criticalFields.forEach(field => {
      const colInfo = structure.rows.find(row => row.column_name === field);
      if (colInfo) {
        console.log(`✅ ${field.padEnd(20)} - ${colInfo.data_type.padEnd(15)} (${colInfo.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      } else {
        console.log(`❌ ${field.padEnd(20)} - MANCANTE!`);
      }
    });
    console.log('');

    // 5. Test query di inserimento (solo struttura, senza eseguire)
    console.log('5️⃣ Test query di inserimento (struttura)...');
    const insertFields = [
      'email', 'password_hash', 'nome', 'cognome', 'genere', 'data_nascita', 
      'cittadinanza', 'paese_residenza', 'regione_residenza', 'provincia_residenza', 
      'comune_residenza', 'ruolo', 'grado_elezione', 'paese_elezione', 
      'regione_elezione', 'provincia_elezione', 'comune_elezione', 'grado_candidatura', 
      'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 
      'comune_candidatura', 'status', 'created_at', 'updated_at'
    ];

    console.log('📝 Campi richiesti per INSERT:');
    insertFields.forEach((field, index) => {
      const colInfo = structure.rows.find(row => row.column_name === field);
      if (colInfo) {
        console.log(`   ${(index + 1).toString().padStart(2, '0')}. ${field.padEnd(25)} - ${colInfo.data_type.padEnd(15)} ✅`);
      } else {
        console.log(`   ${(index + 1).toString().padStart(2, '0')}. ${field.padEnd(25)} - MANCANTE ❌`);
      }
    });
    console.log('');

    // 6. Test tipi di dati problematici
    console.log('6️⃣ Test tipi di dati problematici...');
    const problematicFields = structure.rows.filter(col => 
      col.data_type === 'timestamp' || 
      col.data_type === 'date' || 
      col.data_type === 'time'
    );
    
    if (problematicFields.length > 0) {
      console.log('⚠️  Campi con tipi di dati potenzialmente problematici:');
      problematicFields.forEach(field => {
        console.log(`   📅 ${field.column_name.padEnd(20)} - ${field.data_type.padEnd(15)} (${field.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } else {
      console.log('✅ Nessun campo con tipi di dati problematici trovato');
    }
    console.log('');

    // 7. Test campi extra non previsti
    console.log('7️⃣ Test campi extra non previsti...');
    const extraFields = structure.rows.filter(col => !insertFields.includes(col.column_name));
    
    if (extraFields.length > 0) {
      console.log(`📝 Campi extra trovati (${extraFields.length}):`);
      extraFields.forEach(field => {
        console.log(`   ℹ️  ${field.column_name.padEnd(20)} - ${field.data_type.padEnd(15)} (${field.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } else {
      console.log('✅ Nessun campo extra trovato');
    }

  } catch (error) {
    console.error('💥 Errore durante i test:', error);
    console.error('📋 Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Esegui i test
testDatabaseQueries().catch(console.error);
