const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkVotiAmnistiaStructure() {
  try {
    console.log('🔍 Controllo struttura tabella voti_amnistia...\n');

    // 1. Controlla la struttura della tabella
    console.log('1. Struttura tabella:');
    const structureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'voti_amnistia'
      ORDER BY ordinal_position;
    `;
    
    const structureResult = await pool.query(structureQuery);
    console.table(structureResult.rows);

    // 2. Controlla i vincoli di chiave primaria e foreign key
    console.log('\n2. Vincoli di chiave primaria:');
    const primaryKeyQuery = `
      SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'voti_amnistia' 
        AND tc.constraint_type = 'PRIMARY KEY';
    `;
    
    const primaryKeyResult = await pool.query(primaryKeyQuery);
    console.table(primaryKeyResult.rows);

    console.log('\n3. Vincoli di foreign key:');
    const foreignKeyQuery = `
      SELECT 
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'voti_amnistia';
    `;
    
    const foreignKeyResult = await pool.query(foreignKeyQuery);
    if (foreignKeyResult.rows.length > 0) {
      console.table(foreignKeyResult.rows);
    } else {
      console.log('Nessun vincolo di foreign key trovato.');
    }

    // 3. Controlla gli indici
    console.log('\n4. Indici:');
    const indexesQuery = `
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'voti_amnistia';
    `;
    
    const indexesResult = await pool.query(indexesQuery);
    if (indexesResult.rows.length > 0) {
      console.table(indexesResult.rows);
    } else {
      console.log('Nessun indice trovato.');
    }

    // 4. Controlla se ci sono trigger
    console.log('\n5. Trigger:');
    const triggersQuery = `
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'voti_amnistia';
    `;
    
    const triggersResult = await pool.query(triggersQuery);
    if (triggersResult.rows.length > 0) {
      console.table(triggersResult.rows);
    } else {
      console.log('Nessun trigger trovato.');
    }

    // 5. Controlla se i campi timestamp, created_at, updated_at sono referenziati da altre tabelle
    console.log('\n6. Controllo referenze esterne ai campi timestamp:');
    const referencesQuery = `
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'voti_amnistia'
        AND ccu.column_name IN ('timestamp', 'created_at', 'updated_at');
    `;
    
    const referencesResult = await pool.query(referencesQuery);
    if (referencesResult.rows.length > 0) {
      console.log('⚠️  ATTENZIONE: I seguenti campi sono referenziati da altre tabelle:');
      console.table(referencesResult.rows);
    } else {
      console.log('✅ Nessuna referenza esterna ai campi timestamp trovata.');
    }

    // 6. Controlla se ci sono viste che usano questi campi
    console.log('\n7. Controllo viste che potrebbero usare i campi timestamp:');
    const viewsQuery = `
      SELECT 
        table_name,
        view_definition
      FROM information_schema.views 
      WHERE view_definition LIKE '%voti_amnistia%'
        AND (view_definition LIKE '%timestamp%' 
             OR view_definition LIKE '%created_at%' 
             OR view_definition LIKE '%updated_at%');
    `;
    
    const viewsResult = await pool.query(viewsQuery);
    if (viewsResult.rows.length > 0) {
      console.log('⚠️  ATTENZIONE: Le seguenti viste potrebbero usare i campi timestamp:');
      console.table(viewsResult.rows);
    } else {
      console.log('✅ Nessuna vista che usa i campi timestamp trovata.');
    }

    console.log('\n✅ Controllo completato!');

  } catch (error) {
    console.error('❌ Errore durante il controllo:', error);
  } finally {
    await pool.end();
  }
}

checkVotiAmnistiaStructure();
