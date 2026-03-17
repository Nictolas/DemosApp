const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkStructure() {
  try {
    console.log('🔍 Verifica struttura tabella voti_referendum_abrogativi\n');
    
    // 1. Verifica colonne
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'voti_referendum_abrogativi' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colonne della tabella:');
    columnsResult.rows.forEach(r => {
      const length = r.character_maximum_length ? `(${r.character_maximum_length})` : '';
      console.log(`  - ${r.column_name}: ${r.data_type}${length} ${r.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'}`);
    });
    
    // 2. Verifica dati di esempio
    console.log('\n📊 Dati di esempio (primi 5):');
    const sampleResult = await pool.query(`
      SELECT id, userid, referendum_id, timestamp, created_at
      FROM voti_referendum_abrogativi 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    sampleResult.rows.forEach((r, i) => {
      console.log(`\n  Record ${i + 1}:`);
      console.log(`    id: ${r.id} (tipo: ${typeof r.id})`);
      console.log(`    userid: ${r.userid} (tipo: ${typeof r.userid})`);
      console.log(`    referendum_id: ${r.referendum_id} (tipo: ${typeof r.referendum_id}, lunghezza: ${r.referendum_id?.length || 0})`);
      console.log(`    timestamp: ${r.timestamp}`);
    });
    
    // 3. Verifica conteggio voti per referendum
    console.log('\n📈 Conteggio voti per referendum_id:');
    const countResult = await pool.query(`
      SELECT referendum_id, COUNT(*) as count
      FROM voti_referendum_abrogativi
      GROUP BY referendum_id
      ORDER BY count DESC
    `);
    
    countResult.rows.forEach(r => {
      console.log(`  - referendum_id: "${r.referendum_id}" (tipo: ${typeof r.referendum_id}, lunghezza: ${r.referendum_id?.length || 0}) => ${r.count} voti`);
    });
    
    // 4. Verifica referendum in normalizedData
    console.log('\n🔍 Verifica referendum mostrati nella pagina:');
    const referendumIds = [
      'fd394acf-3607-4a05-a7f9-4990bafa1b4d',
      '2b12ab5b-7247-432b-a46e-3425e075d3a6',
      '7d17b85f-a3d5-4302-9c7d-f018becd12c4',
      '96ce467d-1fd3-48cb-a3f6-32b2f1c3b8ed'
    ];
    
    for (const refId of referendumIds) {
      const refIdNoDash = refId.replace(/-/g, '');
      
      // Test query esatta
      const exactQuery = await pool.query(`
        SELECT COUNT(*) as count 
        FROM voti_referendum_abrogativi 
        WHERE referendum_id::text = $1
      `, [refId]);
      
      // Test query senza trattini
      const noDashQuery = await pool.query(`
        SELECT COUNT(*) as count 
        FROM voti_referendum_abrogativi 
        WHERE REPLACE(referendum_id::text, '-', '') = $1
      `, [refIdNoDash]);
      
      // Test query con LIKE
      const likeQuery = await pool.query(`
        SELECT COUNT(*) as count 
        FROM voti_referendum_abrogativi 
        WHERE referendum_id::text LIKE $1
      `, [`%${refId.substring(0, 8)}%`]);
      
      console.log(`\n  Referendum ID: ${refId}`);
      console.log(`    Query esatta (referendum_id::text = '${refId}'): ${exactQuery.rows[0].count} voti`);
      console.log(`    Query senza trattini (REPLACE = '${refIdNoDash}'): ${noDashQuery.rows[0].count} voti`);
      console.log(`    Query LIKE ('%${refId.substring(0, 8)}%'): ${likeQuery.rows[0].count} voti`);
      
      // Mostra tutti i referendum_id che contengono parte di questo ID
      const allMatching = await pool.query(`
        SELECT DISTINCT referendum_id, COUNT(*) as count
        FROM voti_referendum_abrogativi
        WHERE referendum_id::text LIKE $1 OR REPLACE(referendum_id::text, '-', '') LIKE $2
        GROUP BY referendum_id
      `, [`%${refId.substring(0, 8)}%`, `%${refIdNoDash.substring(0, 8)}%`]);
      
      if (allMatching.rows.length > 0) {
        console.log(`    ID simili trovati nel database:`);
        allMatching.rows.forEach(m => {
          console.log(`      - "${m.referendum_id}" => ${m.count} voti`);
        });
      }
    }
    
    await pool.end();
    console.log('\n✅ Verifica completata');
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
    process.exit(1);
  }
}

checkStructure();



