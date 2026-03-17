require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verificaFoto() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as totale,
        COUNT(foto_url) FILTER (WHERE foto_url IS NOT NULL AND foto_url != '') as con_foto
      FROM voti_camera
    `);
    
    console.log('\n📊 Statistiche foto scaricate:');
    console.log(`Totale politici in voti_camera: ${result.rows[0].totale}`);
    console.log(`Politici con foto_url: ${result.rows[0].con_foto}`);
    
    // Mostra alcuni esempi di politici con foto
    const esempi = await pool.query(`
      SELECT politico_nome, foto_url 
      FROM voti_camera 
      WHERE foto_url IS NOT NULL AND foto_url != ''
      LIMIT 5
    `);
    
    if (esempi.rows.length > 0) {
      console.log('\n📸 Esempi politici con foto:');
      esempi.rows.forEach(p => {
        console.log(`  - ${p.politico_nome}: ${p.foto_url.substring(0, 60)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

verificaFoto();
