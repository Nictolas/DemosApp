const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testClassificaQuery() {
  try {
    console.log('🔍 Test query classifica (simulazione codice)\n');
    
    const normalizedData = [
      { id: 'fd394acf-3607-4a05-a7f9-4990bafa1b4d', nome: 'Matrimonio Egualitario' },
      { id: '2b12ab5b-7247-432b-a46e-3425e075d3a6', nome: 'Cittadinanza' },
      { id: '7d17b85f-a3d5-4302-9c7d-f018becd12c4', nome: 'Contro l\'Autonomia Differenziata' },
      { id: '96ce467d-1fd3-48cb-a3f6-32b2f1c3b8ed', nome: 'Cannabis Legale' }
    ];
    
    console.log('📊 Test conteggio voti per ogni referendum:\n');
    
    const classifica = await Promise.all(normalizedData.map(async (ref) => {
      const refId = String(ref.id);
      const refIdNoDash = refId.replace(/-/g, '');
      
      // Query esatta come nel codice
      const votiQuery = `
        SELECT COUNT(*) as count 
        FROM voti_referendum_abrogativi 
        WHERE referendum_id::text = $1 
           OR REPLACE(referendum_id::text, '-', '') = $2
           OR referendum_id::text = $3
           OR REPLACE(referendum_id::text, '-', '') = $4
      `;
      
      console.log(`  Test per "${ref.nome}":`);
      console.log(`    ID: ${refId}`);
      console.log(`    ID senza trattini: ${refIdNoDash}`);
      console.log(`    Parametri query: [${refId}, ${refIdNoDash}, ${refIdNoDash}, ${refId}]`);
      
      const votiResult = await pool.query(votiQuery, [refId, refIdNoDash, refIdNoDash, refId]);
      const votiCount = parseInt(votiResult.rows[0]?.count || 0);
      
      console.log(`    ✅ Risultato: ${votiCount} voti\n`);
      
      return {
        nome: ref.nome,
        voti: votiCount
      };
    }));
    
    console.log('\n📈 Classifica finale:');
    classifica.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.nome}: ${c.voti} voti`);
    });
    
    // Test anche con query semplificata
    console.log('\n🔍 Test con query semplificata (solo match esatto):');
    for (const ref of normalizedData) {
      const refId = String(ref.id);
      const simpleQuery = await pool.query(`
        SELECT COUNT(*) as count 
        FROM voti_referendum_abrogativi 
        WHERE referendum_id::text = $1
      `, [refId]);
      console.log(`  ${ref.nome}: ${simpleQuery.rows[0].count} voti`);
    }
    
    await pool.end();
    console.log('\n✅ Test completato');
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
    process.exit(1);
  }
}

testClassificaQuery();


